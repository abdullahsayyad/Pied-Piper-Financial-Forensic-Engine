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
import { buildRingMap } from './utils/detectRings';
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
    const [detectionResults, setDetectionResults] = useState(null);
    const [assistantOpen, setAssistantOpen] = useState(false);

    // Simulation
    const sim = useSimulation(nodes, edges);

    // Rings (Derived from Detection Engine results)
    const rings = useMemo(() => {
        if (!detectionResults || !detectionResults.allRings) return [];

        const RING_COLORS = [
            'rgba(255, 107, 53, 0.25)',   // orange
            'rgba(168, 85, 247, 0.25)',   // purple
            'rgba(236, 72, 153, 0.25)',   // pink
            'rgba(34, 211, 238, 0.25)',   // cyan
            'rgba(250, 204, 21, 0.25)',   // yellow
            'rgba(52, 211, 153, 0.25)',   // green
        ];

        return detectionResults.allRings.reduce((acc, ring, i) => {
            let color = RING_COLORS[i % RING_COLORS.length];

            if (ring.pattern_type === 'cycle' || ring.pattern_type === 'cycle_length_3') {
                const score = ring.risk_score || 0;
                if (score < 10) return acc; // Skip low risk cycles

                if (score < 30) color = 'rgba(250, 204, 21, 0.6)'; // Yellow
                else if (score < 60) color = 'rgba(251, 146, 60, 0.6)'; // Orange
                else color = 'rgba(239, 68, 68, 0.6)'; // Red
            }

            acc.push({
                ringId: ring.ring_id,
                members: ring.member_accounts,
                color: color,
                patternType: ring.pattern_type
            });
            return acc;
        }, []);
    }, [detectionResults]);

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
            complete: async (results) => {
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

                // ── Detection via JS Engine (SRS §3.1.3) ──
                addLog('Running detection engine...', 'info');
                const detections = await runAllDetections(graph);
                setDetectionResults(detections); // STORE RESULTS

                addLog(`Detection engine: ${detections.allRings.length} patterns found`, 'info');

                // ── Scoring (SRS §3.1.4) ──
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

                // Initialize simulation suspicion map with computed scores
                sim.initializeSuspicion(scores);

                addLog(`Dataset loaded: ${validRows.length} records, ${n.length} accounts`, 'success');
                addLog(`Processing completed in ${elapsed}ms`, 'success');

                if (detections.allRings.length > 0) {
                    addLog(`Threat Detected: ${detections.allRings.length} rings/patterns identified`, 'threat');
                } else {
                    addLog('No suspicious patterns detected', 'info');
                }
            },
            error: (err) => {
                addLog(`Parse error: ${err.message}`, 'threat');
            },
        });
    }, [addLog, sim]);

    // Export (SRS §3.1.6 — exact JSON schema)
    const handleExportReport = useCallback(async () => {
        const processingTimeSeconds = (procTime || 0) / 1000;

        // Use stored results if available, otherwise re-run (fallback)
        let detections = detectionResults;
        if (!detections && graphData) {
            detections = await runAllDetections(graphData);
        } else if (!detections) {
            detections = { allRings: [], suspiciousAccounts: [] };
        }

        const scores = graphData ? computeSuspicionScores(graphData, detections) : new Map();

        const report = buildJsonReport({
            graph: graphData,
            detections,
            scores,
            processingTimeSeconds,
        });

        downloadJsonReport(report, datasetName ? `${datasetName}_report.json` : undefined);
        addLog('Intel report exported (SRS format)', 'success');
    }, [graphData, procTime, addLog, detectionResults, datasetName]);

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
                <div style={{ flex: 3, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <RingTable
                        rings={rings}
                        suspicionMap={sim.suspicionMap}
                    />
                </div>

                {/* Timeline Strip */}
                <div style={{ flex: 2, minWidth: 0, borderLeft: '1px solid var(--border-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <TimelineStrip edges={edges} currentTime={sim.currentTime} hasActiveThreats={sim.hasActiveThreats} />
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
