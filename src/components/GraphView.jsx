import { useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';

/* ── Risk-coded node colors (matte, no gradients) ── */
function riskColor(score) {
    if (score <= 40) return '#5B7FA4';  // Slate Blue
    if (score <= 70) return '#FFC857';  // Amber
    return '#FF3B3B';                    // Deep Red
}

function riskTier(score) {
    if (score <= 20) return 'NOMINAL';
    if (score <= 40) return 'LOW';
    if (score <= 70) return 'ELEVATED';
    return 'SEVERE';
}

function nodeRadius(score) {
    return 8 + (score / 100) * 10; // 8 → 18
}

export default function GraphView({
    elements,
    suspicionMap,
    activeEdges,
    showRings,
    ringMap,
    suspicionThreshold,
    amountThreshold,
    highlightNodeId,
    onNodeSelect,
}) {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const simRef = useRef(null);
    const nodesDataRef = useRef([]);
    const linksDataRef = useRef([]);
    const initializedRef = useRef(false);
    const zoomRef = useRef(null);

    // Convert Cytoscape format → D3 format (only on new data)
    const { d3Nodes, d3Links } = useMemo(() => {
        if (!elements || elements.length === 0) return { d3Nodes: [], d3Links: [] };

        const nodeItems = [];
        const linkItems = [];

        for (const el of elements) {
            if (el.data.source) {
                // Edge
                linkItems.push({
                    id: el.data.id,
                    source: el.data.source,
                    target: el.data.target,
                    amount: el.data.amount || 0,
                    timestamp: el.data.timestamp || '',
                });
            } else {
                // Node
                nodeItems.push({
                    id: el.data.id,
                    label: el.data.label || el.data.id,
                    totalSent: el.data.totalSent || 0,
                    totalReceived: el.data.totalReceived || 0,
                    txCount: el.data.txCount || 0,
                    ringId: el.data.ringId || null,
                    ringColor: el.data.ringColor || null,
                });
            }
        }

        return { d3Nodes: nodeItems, d3Links: linkItems };
    }, [elements]);

    // Initialize D3 force simulation + SVG
    useEffect(() => {
        if (d3Nodes.length === 0 || !containerRef.current) {
            initializedRef.current = false;
            return;
        }

        // Prevent re-init on same data
        if (initializedRef.current) return;
        initializedRef.current = true;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Clear previous
        d3.select(container).selectAll('*').remove();

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'transparent');

        svgRef.current = svg;

        // Defs for arrowheads
        const defs = svg.append('defs');

        defs.append('marker')
            .attr('id', 'arrow-normal')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-4L10,0L0,4')
            .attr('fill', 'rgba(90, 127, 164, 0.35)');

        defs.append('marker')
            .attr('id', 'arrow-active')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-4L10,0L0,4')
            .attr('fill', 'rgba(0, 194, 255, 0.5)');

        defs.append('marker')
            .attr('id', 'arrow-threat')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-4L10,0L0,4')
            .attr('fill', 'rgba(255, 59, 59, 0.5)');

        // Zoom
        const g = svg.append('g');
        const zoom = d3.zoom()
            .scaleExtent([0.2, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        svg.call(zoom);
        zoomRef.current = { svg, zoom };

        // Deep copy data for D3 mutation
        const nodes = d3Nodes.map(d => ({ ...d }));
        const links = d3Links.map(d => ({ ...d }));
        nodesDataRef.current = nodes;
        linksDataRef.current = links;

        // Force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.4))
            .force('charge', d3.forceManyBody().strength(-400).distanceMax(500))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(20))
            .force('x', d3.forceX(width / 2).strength(0.03))
            .force('y', d3.forceY(height / 2).strength(0.03))
            .alphaDecay(0.01)
            .velocityDecay(0.3);

        simRef.current = simulation;

        // Links (edges)
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('class', 'graph-link')
            .attr('stroke', 'rgba(90, 127, 164, 0.15)')
            .attr('stroke-width', d => 0.6 + (Math.min(d.amount, 3000) / 3000) * 2)
            .attr('marker-end', 'url(#arrow-normal)');

        // Node groups
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', 'graph-node')
            .style('cursor', 'pointer');

        // Ring boundary (rendered first, behind the node)
        node.append('circle')
            .attr('class', 'ring-boundary')
            .attr('r', 16)
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,2');

        // Threat glow (behind node)
        node.append('circle')
            .attr('class', 'threat-glow')
            .attr('r', 14)
            .attr('fill', 'rgba(255, 59, 59, 0)')
            .attr('stroke', 'none');

        // Main node circle
        node.append('circle')
            .attr('class', 'node-circle')
            .attr('r', 10)
            .attr('fill', '#5B7FA4')
            .attr('stroke', '#3A5570')
            .attr('stroke-width', 1.5);

        // Labels
        node.append('text')
            .text(d => d.label)
            .attr('dy', 20)
            .attr('text-anchor', 'middle')
            .attr('fill', '#7A8FA3')
            .attr('font-size', '8px')
            .attr('font-family', "'IBM Plex Mono', monospace")
            .attr('font-weight', 500)
            .style('paint-order', 'stroke')
            .style('stroke', '#0B0F14')
            .style('stroke-width', '2px');

        // Drag behavior
        const drag = d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.1).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });

        node.call(drag);

        // Click handler
        node.on('click', (event, d) => {
            event.stopPropagation();
            onNodeSelect?.({
                id: d.id,
                label: d.label,
                totalSent: d.totalSent,
                totalReceived: d.totalReceived,
                txCount: d.txCount,
                ringId: d.ringId,
            });
        });

        // Double-click zoom
        node.on('dblclick', (event, d) => {
            event.stopPropagation();
            svg.transition().duration(400).call(
                zoom.transform,
                d3.zoomIdentity.translate(width / 2, height / 2).scale(2.5).translate(-d.x, -d.y)
            );
        });

        // Click background to deselect
        svg.on('click', () => onNodeSelect?.(null));

        // Tick
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Resize handler
        const handleResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            svg.attr('width', w).attr('height', h);
            simulation.force('center', d3.forceCenter(w / 2, h / 2));
            simulation.force('x', d3.forceX(w / 2).strength(0.03));
            simulation.force('y', d3.forceY(h / 2).strength(0.03));
            simulation.alpha(0.1).restart();
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        return () => {
            simulation.stop();
            resizeObserver.disconnect();
            initializedRef.current = false;
        };
    }, [d3Nodes, d3Links, onNodeSelect]);

    // Update node/edge visuals based on suspicion (reactive)
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg || !suspicionMap || suspicionMap.size === 0) return;

        const g = svg.select('g');

        // Update nodes
        g.selectAll('.graph-node').each(function (d) {
            const score = suspicionMap.get(d.id) || 0;
            const color = riskColor(score);
            const r = nodeRadius(score);
            const el = d3.select(this);

            // Main circle
            el.select('.node-circle')
                .transition().duration(250)
                .attr('r', r)
                .attr('fill', color)
                .attr('stroke', score > 70 ? 'rgba(255, 59, 59, 0.5)' : '#3A5570');

            // Threat glow
            el.select('.threat-glow')
                .transition().duration(250)
                .attr('r', r + 5)
                .attr('fill', score > 70 ? 'rgba(255, 59, 59, 0.08)' : 'rgba(255, 59, 59, 0)');

            // Ring boundary
            const ringInfo = ringMap?.get(d.id);
            el.select('.ring-boundary')
                .transition().duration(250)
                .attr('r', r + 8)
                .attr('stroke', (showRings && ringInfo) ? '#FFC857' : 'transparent');

            // Dimming
            const dimmed = suspicionThreshold > 0 && score < suspicionThreshold;
            el.transition().duration(200).style('opacity', dimmed ? 0.08 : 1);
        });

        // Update edges
        g.selectAll('.graph-link').each(function (d) {
            const edgeId = d.id;
            const srcScore = suspicionMap.get(d.source.id || d.source) || 0;
            const amount = d.amount || 0;
            const isActive = activeEdges?.has(edgeId);
            const isSuspicious = srcScore > 60;
            const el = d3.select(this);

            const dimmed = amountThreshold > 0 && amount < amountThreshold;

            let color, marker;
            if (isSuspicious) {
                color = 'rgba(255, 59, 59, 0.3)';
                marker = 'url(#arrow-threat)';
            } else if (isActive) {
                color = 'rgba(0, 194, 255, 0.3)';
                marker = 'url(#arrow-active)';
            } else {
                color = 'rgba(90, 127, 164, 0.15)';
                marker = 'url(#arrow-normal)';
            }

            el.transition().duration(200)
                .attr('stroke', color)
                .attr('marker-end', marker)
                .style('opacity', dimmed ? 0.04 : 1);
        });
    }, [suspicionMap, activeEdges, showRings, ringMap, suspicionThreshold, amountThreshold]);

    // Highlight search
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg || !highlightNodeId) return;

        const g = svg.select('g');
        g.selectAll('.graph-node').each(function (d) {
            if (d.id === highlightNodeId) {
                const el = d3.select(this);
                el.select('.node-circle')
                    .attr('stroke', '#00C2FF')
                    .attr('stroke-width', 3);

                // Zoom to node
                if (zoomRef.current) {
                    const { svg: svgEl, zoom } = zoomRef.current;
                    const w = containerRef.current.clientWidth;
                    const h = containerRef.current.clientHeight;
                    svgEl.transition().duration(400).call(
                        zoom.transform,
                        d3.zoomIdentity.translate(w / 2, h / 2).scale(2).translate(-d.x, -d.y)
                    );
                }
            }
        });
    }, [highlightNodeId]);

    // Idle state
    if (!elements || elements.length === 0) {
        return (
            <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
            }}>
                {/* Radar sweep */}
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                    {[1, 2, 3].map((i) => (
                        <div key={i} style={{
                            position: 'absolute', inset: `${(3 - i) * 12}px`,
                            border: '1px solid rgba(0,194,255,0.06)', borderRadius: '50%',
                        }} />
                    ))}
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'conic-gradient(from 0deg, transparent 0deg, rgba(0,194,255,0.06) 30deg, transparent 60deg)',
                        animation: 'radar-sweep 6s linear infinite',
                    }} />
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '4px', height: '4px',
                        background: '#00C2FF',
                        boxShadow: '0 0 6px #00C2FF',
                    }} />
                </div>
                <span className="label" style={{ letterSpacing: '3px' }}>AWAITING DATASET</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Load CSV to initialize tactical network</span>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Subtle radial gradient overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0,194,255,0.015) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 1,
            }} />
        </div>
    );
}

export { riskTier, riskColor };
