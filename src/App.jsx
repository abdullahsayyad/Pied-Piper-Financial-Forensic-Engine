import { useState, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import CommandBar from './components/CommandBar';
import PatternControls from './components/PatternControls';
import SystemLog from './components/SystemLog';
import GraphView from './components/GraphView';
import IntelligencePanel from './components/IntelligencePanel';
import RingTable from './components/RingTable';
import TimelineStrip from './components/TimelineStrip';
import InvestigationAssistant from './components/InvestigationAssistant';
import useSimulation from './hooks/useSimulation';
import { transformCsvToElements, computeStats } from './utils/transformData';
import { detectRings, buildRingMap } from './utils/detectRings';
import { validateCsv } from './utils/validation';
import { buildGraph } from './utils/graphBuilder';
import { runAllDetections } from './utils/detectionEngine';
import { computeSuspicionScores } from './utils/scoringEngine';
import { buildJsonReport, downloadJsonReport } from './utils/jsonExporter';

function getTimestamp() {
    const d = new Date();
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function App() {
    const [rawRows, setRawRows] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [elements, setElements] = useState([]);
    const [stats, setStats] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [datasetName, setDatasetName] = useState('');
    const [procTime, setProcTime] = useState(null);
    const [suspicionThreshold, setSuspicionThreshold] = useState(0);
    const [amountThreshold, setAmountThreshold] = useState(0);
    const [searchNodeId, setSearchNodeId] = useState(null);
    const [logEntries, setLogEntries] = useState([
        { time: getTimestamp(), message: 'System initialized. Awaiting dataset.', type: 'info' },
    ]);
    const [patterns, setPatterns] = useState({ cycles: false, smurfing: false, shells: false });
    const [graphData, setGraphData] = useState(null);
    const [assistantOpen, setAssistantOpen] = useState(false);

    // Simulation
    const sim = useSimulation(nodes, edges);

    // Rings
    const rings = useMemo(() => {
        if (nodes.length === 0) return [];
        return detectRings(nodes, edges);
    }, [nodes, edges]);

    const ringMap = useMemo(() => buildRingMap(rings), [rings]);
    const showRings = rings.length > 0;

    // Investigation context (memoized for stability)
    const investigationContext = useMemo(() => ({
        accountCount: stats?.uniqueAccounts || 0,
        transactionCount: stats?.transactionCount || 0,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        ringCount: rings.length,
        datasetName: datasetName,
    }), [stats, nodes.length, edges.length, rings.length, datasetName]);

    // Enriched elements
    const enrichedElements = useMemo(() => {
        if (elements.length === 0) return [];
        return elements.map((el) => {
            if (el.data.source) return el;
            const ring = ringMap.get(el.data.id);
            return {
                ...el,
                data: { ...el.data, ringId: ring?.ringId || null, ringColor: ring?.color || null },
            };
        });
    }, [elements, ringMap]);

    // Alert level
    const alertLevel = useMemo(() => {
        if (!sim.suspicionMap || sim.suspicionMap.size === 0) return 'LOW';
        let max = 0;
        for (const [, s] of sim.suspicionMap) {
            if (s > max) max = s;
        }
        if (max >= 80) return 'CRITICAL';
        if (max >= 60) return 'HIGH';
        if (max >= 40) return 'ELEVATED';
        return 'LOW';
    }, [sim.suspicionMap]);

    // Add log entry
    const addLog = useCallback((message, type = 'info') => {
        setLogEntries((prev) => {
            const entries = [...prev, { time: getTimestamp(), message, type }];
            return entries.slice(-100);
        });
    }, []);

    // Load dataset
    const handleLoadDataset = useCallback((file) => {
        const start = performance.now();
        addLog(`Loading dataset: ${file.name}`, 'info');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const headers = results.meta.fields || [];

                // ── SRS Strict Validation ──
                const validation = validateCsv(headers, results.data);

                if (!validation.valid && validation.validRows.length === 0) {
                    for (const err of validation.errors) {
                        addLog(`VALIDATION: ${err}`, 'threat');
                    }
                    return;
                }

                if (validation.invalidCount > 0) {
                    addLog(`WARNING: ${validation.invalidCount} invalid rows skipped`, 'warning');
                    for (const err of validation.errors.slice(0, 3)) {
                        addLog(`  → ${err}`, 'warning');
                    }
                }

                const validRows = validation.validRows;

                // ── Graph Construction (SRS §3.1.2) ──
                const graph = buildGraph(validRows);
                setGraphData(graph);
                addLog(`Graph built: ${graph.accountCount} nodes, ${graph.edgeCount} edges`, 'success');

                // ── Detection Stubs (SRS §3.1.3) ──
                const detections = runAllDetections(graph);
                addLog(`Detection engine: ${detections.allRings.length} patterns found`, 'info');

                // ── Scoring Stub (SRS §3.1.4) ──
                const scores = computeSuspicionScores(graph, detections);

                // ── UI Data (existing format for existing components) ──
                const { nodes: n, edges: e, elements: els } = transformCsvToElements(validRows);
                const networkStats = computeStats(validRows);

                const elapsed = Math.round(performance.now() - start);

                setRawRows(validRows);
                setNodes(n);
                setEdges(e);
                setElements(els);
                setStats(networkStats);
                setDatasetName(file.name);
                setProcTime(elapsed);
                setSelectedNode(null);

                addLog(`Dataset loaded: ${validRows.length} records, ${n.length} accounts`, 'success');
                addLog(`Processing completed in ${elapsed}ms`, 'success');

                // Detect rings (existing UI-powering detection)
                const detectedRings = detectRings(n, e);
                if (detectedRings.length > 0) {
                    for (const ring of detectedRings) {
                        addLog(`Cycle detected: ${ring.ringId} (${ring.members.length} nodes)`, 'warning');
                    }
                } else {
                    addLog('No cycle networks detected', 'info');
                }
            },
            error: (err) => {
                addLog(`Parse error: ${err.message}`, 'threat');
            },
        });
    }, [addLog]);

    // Export (SRS §3.1.6 — exact JSON schema)
    const handleExportReport = useCallback(() => {
        const processingTimeSeconds = (procTime || 0) / 1000;
        const detections = graphData ? runAllDetections(graphData) : { allRings: [] };
        const scores = graphData ? computeSuspicionScores(graphData, detections) : new Map();

        const report = buildJsonReport({
            graph: graphData,
            detections,
            scores,
            processingTimeSeconds,
        });

        downloadJsonReport(report);
        addLog('Intel report exported (SRS format)', 'success');
    }, [graphData, procTime, addLog]);

    // Node select
    const handleNodeSelect = useCallback((nodeData) => {
        if (nodeData) {
            const ring = ringMap.get(nodeData.id);
            setSelectedNode({ ...nodeData, ringId: ring?.ringId || null });
            addLog(`Target acquired: ${nodeData.id}`, 'info');
        } else {
            setSelectedNode(null);
        }
    }, [ringMap, addLog]);

    // Simulation wrappers with logging
    const handleInject = useCallback(() => {
        sim.injectSuspicious();
        addLog('⚠ Threat injected into network', 'threat');
    }, [sim, addLog]);

    const handlePlay = useCallback(() => {
        sim.play();
        addLog('Simulation engine: RUN', 'success');
    }, [sim, addLog]);

    const handlePause = useCallback(() => {
        sim.pause();
        addLog('Simulation engine: HALT', 'warning');
    }, [sim, addLog]);

    const handleReset = useCallback(() => {
        sim.reset();
        addLog('Simulation engine: RESET', 'info');
    }, [sim, addLog]);

    // Search
    const handleSearch = useCallback((id) => {
        if (!id) return;
        const trimmed = id.trim();
        setSearchNodeId(trimmed);
        addLog(`Search target: ${trimmed}`, 'info');
        setTimeout(() => setSearchNodeId(null), 100);
    }, [addLog]);

    // Pattern toggles
    const handleTogglePattern = useCallback((key) => {
        setPatterns((p) => {
            const next = { ...p, [key]: !p[key] };
            const label = key === 'cycles' ? 'Cycle Networks' : key === 'smurfing' ? 'Smurfing Aggregation' : 'Shell Chain Structures';
            addLog(`${next[key] ? 'Enabled' : 'Disabled'}: ${label}`, next[key] ? 'success' : 'info');
            return next;
        });
    }, [addLog]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100vw',
            height: '100vh',
            position: 'relative',
            zIndex: 1,
        }}>
            {/* ═══ TOP: COMMAND BAR ═══ */}
            <CommandBar
                systemActive={true}
                datasetName={datasetName}
                recordCount={stats?.transactionCount || 0}
                processingTime={procTime}
                alertLevel={alertLevel}
                onLoadDataset={handleLoadDataset}
                onExportReport={handleExportReport}
                onInvestigate={() => setAssistantOpen(true)}
            />

            {/* ═══ MIDDLE: 3-column ═══ */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* ── Left: Pattern Controls + System Log ── */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '220px', minWidth: '220px' }}>
                    <PatternControls
                        patterns={patterns}
                        onTogglePattern={handleTogglePattern}
                        isPlaying={sim.isPlaying}
                        speed={sim.speed}
                        timeStep={sim.timeStep}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onSpeedChange={sim.setSpeed}
                        onInject={handleInject}
                        onReset={handleReset}
                        suspicionThreshold={suspicionThreshold}
                        onSuspicionThreshold={setSuspicionThreshold}
                        amountThreshold={amountThreshold}
                        onAmountThreshold={setAmountThreshold}
                        onSearch={handleSearch}
                    />
                    <SystemLog entries={logEntries} />
                </div>

                {/* ── Center: Graph ── */}
                <div style={{ flex: 1, position: 'relative', minWidth: 0, borderLeft: '1px solid var(--border-base)' }}>
                    <GraphView
                        elements={enrichedElements}
                        suspicionMap={sim.suspicionMap}
                        activeEdges={sim.activeEdges}
                        showRings={showRings}
                        ringMap={ringMap}
                        suspicionThreshold={suspicionThreshold}
                        amountThreshold={amountThreshold}
                        highlightNodeId={searchNodeId}
                        onNodeSelect={handleNodeSelect}
                    />
                </div>

                {/* ── Right: Intelligence Panel ── */}
                {selectedNode && (
                    <IntelligencePanel
                        node={selectedNode}
                        suspicionMap={sim.suspicionMap}
                        edges={edges}
                        onClose={() => setSelectedNode(null)}
                    />
                )}
            </div>

            {/* ═══ BOTTOM: Ring Table + Timeline ═══ */}
            <div style={{
                display: 'flex',
                height: '180px',
                minHeight: '180px',
                borderTop: '1px solid var(--border-base)',
            }}>
                {/* Ring Table */}
                <div style={{ flex: 3, minWidth: 0 }}>
                    <RingTable
                        rings={rings}
                        suspicionMap={sim.suspicionMap}
                    />
                </div>

                {/* Timeline Strip */}
                <div style={{ flex: 2, minWidth: 0, borderLeft: '1px solid var(--border-base)' }}>
                    <TimelineStrip edges={edges} />
                </div>
            </div>

            {/* ═══ INVESTIGATION ASSISTANT ═══ */}
            <InvestigationAssistant
                isOpen={assistantOpen}
                onClose={() => setAssistantOpen(false)}
                context={investigationContext}
            />
        </div>
    );
}
