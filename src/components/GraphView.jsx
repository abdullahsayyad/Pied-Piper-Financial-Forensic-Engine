import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { HoverCard, HoverCardTrigger, HoverCardContent } from './ui/hover-card';

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

/* Muted cluster palette for hull backgrounds */
const CLUSTER_COLORS = [
    'rgba(0, 194, 255, 0.04)',   // cyan
    'rgba(255, 200, 87, 0.04)',  // amber
    'rgba(130, 180, 130, 0.04)', // green
    'rgba(180, 140, 200, 0.04)', // purple
    'rgba(200, 140, 100, 0.04)', // copper
    'rgba(100, 180, 200, 0.04)', // teal
    'rgba(200, 100, 140, 0.04)', // rose
    'rgba(160, 160, 100, 0.04)', // olive
];

const CLUSTER_STROKE_COLORS = [
    'rgba(0, 194, 255, 0.12)',
    'rgba(255, 200, 87, 0.12)',
    'rgba(130, 180, 130, 0.12)',
    'rgba(180, 140, 200, 0.12)',
    'rgba(200, 140, 100, 0.12)',
    'rgba(100, 180, 200, 0.12)',
    'rgba(200, 100, 140, 0.12)',
    'rgba(160, 160, 100, 0.12)',
];

/* ══════════════════════════════════════════
   GRAPH LAYOUT HELPERS (pure, no React)
   ══════════════════════════════════════════ */

/**
 * BFS to find connected components.
 * Returns array of { id, nodes, links, cx, cy }.
 * Also stamps each node with .clusterId.
 */
/**
 * Build weighted adjacency: edge weight = number of transactions between pair.
 */
function buildEdgeWeights(links) {
    const weights = new Map(); // "a|b" -> count
    for (const l of links) {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        const key = sId < tId ? `${sId}|${tId}` : `${tId}|${sId}`;
        weights.set(key, (weights.get(key) || 0) + 1);
    }
    return weights;
}

/**
 * Weighted label propagation for community detection.
 * Each node starts as its own community.
 * Iteratively, each node moves to the community with the
 * strongest total transaction frequency among its neighbors.
 * Converges to frequency-based clusters.
 */
function labelPropagation(nodeIds, links, maxIter = 15) {
    const weights = buildEdgeWeights(links);

    // Build weighted adjacency
    const adj = new Map();
    for (const id of nodeIds) adj.set(id, []);
    for (const l of links) {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        const key = sId < tId ? `${sId}|${tId}` : `${tId}|${sId}`;
        const w = weights.get(key) || 1;
        if (adj.has(sId)) adj.get(sId).push({ neighbor: tId, weight: w });
        if (adj.has(tId)) adj.get(tId).push({ neighbor: sId, weight: w });
    }

    // Initialize: each node in its own community
    const label = new Map();
    const ids = [...nodeIds];
    ids.forEach((id, i) => label.set(id, i));

    for (let iter = 0; iter < maxIter; iter++) {
        let changed = false;
        // Shuffle order for randomness
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }

        for (const nodeId of ids) {
            const neighbors = adj.get(nodeId);
            if (!neighbors || neighbors.length === 0) continue;

            // Sum weights of each neighboring community
            const communityWeight = new Map();
            for (const { neighbor, weight } of neighbors) {
                const nLabel = label.get(neighbor);
                communityWeight.set(nLabel, (communityWeight.get(nLabel) || 0) + weight);
            }

            // Find community with highest total weight
            let bestLabel = label.get(nodeId);
            let bestWeight = 0;
            for (const [lbl, w] of communityWeight) {
                if (w > bestWeight || (w === bestWeight && lbl < bestLabel)) {
                    bestWeight = w;
                    bestLabel = lbl;
                }
            }

            if (bestLabel !== label.get(nodeId)) {
                label.set(nodeId, bestLabel);
                changed = true;
            }
        }

        if (!changed) break; // Converged
    }

    return label;
}

/**
 * Detect communities using BFS + label propagation.
 * 1. BFS finds connected components
 * 2. Label propagation subdivides large components by tx frequency
 * Returns array of { id, nodes, links, cx, cy }, stamps node.clusterId.
 */
function getConnectedComponents(nodes, links) {
    const adj = new Map();
    for (const n of nodes) adj.set(n.id, []);
    for (const l of links) {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        if (adj.has(sId)) adj.get(sId).push(tId);
        if (adj.has(tId)) adj.get(tId).push(sId);
    }

    // Phase 1: BFS connected components
    const visited = new Set();
    const rawComponents = [];

    for (const n of nodes) {
        if (visited.has(n.id)) continue;
        const compNodeIds = new Set();
        const queue = [n.id];
        while (queue.length > 0) {
            const curr = queue.shift();
            if (visited.has(curr)) continue;
            visited.add(curr);
            compNodeIds.add(curr);
            for (const neighbor of (adj.get(curr) || [])) {
                if (!visited.has(neighbor)) queue.push(neighbor);
            }
        }
        const compNodes = nodes.filter(nd => compNodeIds.has(nd.id));
        const compLinks = links.filter(l => {
            const sId = l.source.id || l.source;
            const tId = l.target.id || l.target;
            return compNodeIds.has(sId) && compNodeIds.has(tId);
        });
        rawComponents.push({ nodes: compNodes, links: compLinks });
    }

    // Phase 2: Label propagation for large components
    const components = [];
    let clusterId = 0;

    for (const comp of rawComponents) {
        if (comp.nodes.length <= 5) {
            // Small component — keep as single cluster
            for (const n of comp.nodes) n.clusterId = clusterId;
            components.push({ id: clusterId, nodes: comp.nodes, links: comp.links, cx: 0, cy: 0 });
            clusterId++;
        } else {
            // Run label propagation to subdivide
            const nodeIdSet = new Set(comp.nodes.map(n => n.id));
            const labels = labelPropagation(nodeIdSet, comp.links);

            // Group nodes by community label
            const communities = new Map();
            for (const n of comp.nodes) {
                const lbl = labels.get(n.id);
                if (!communities.has(lbl)) communities.set(lbl, []);
                communities.get(lbl).push(n);
            }

            for (const [, communityNodes] of communities) {
                const communityIds = new Set(communityNodes.map(n => n.id));
                const communityLinks = comp.links.filter(l => {
                    const sId = l.source.id || l.source;
                    const tId = l.target.id || l.target;
                    return communityIds.has(sId) && communityIds.has(tId);
                });

                for (const n of communityNodes) n.clusterId = clusterId;
                components.push({ id: clusterId, nodes: communityNodes, links: communityLinks, cx: 0, cy: 0 });
                clusterId++;
            }
        }
    }

    // Sort largest first
    components.sort((a, b) => b.nodes.length - a.nodes.length);
    components.forEach((c, i) => {
        c.id = i;
        for (const n of c.nodes) n.clusterId = i;
    });
    return components;
}

/**
 * Assign initial positions and cluster centers in a grid layout.
 */
function layoutComponentsInGrid(components, width, height) {
    const count = components.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));
    const cellW = width / cols;
    const cellH = height / rows;

    components.forEach((comp, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = cellW * (col + 0.5);
        const cy = cellH * (row + 0.5);
        comp.cx = cx;
        comp.cy = cy;

        // Spread nodes around component center
        const spread = Math.min(cellW, cellH) * 0.3;
        comp.nodes.forEach((n, j) => {
            const angle = (j / comp.nodes.length) * 2 * Math.PI;
            const r = spread * Math.sqrt((j + 1) / comp.nodes.length);
            n.x = cx + r * Math.cos(angle);
            n.y = cy + r * Math.sin(angle);
        });
    });

    return components;
}

/**
 * For large graphs, filter to top-K strongest edges per node.
 */
function getVisibleEdgeIds(links, k) {
    const nodeEdges = new Map();
    for (const l of links) {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        if (!nodeEdges.has(sId)) nodeEdges.set(sId, []);
        if (!nodeEdges.has(tId)) nodeEdges.set(tId, []);
        nodeEdges.get(sId).push(l);
        nodeEdges.get(tId).push(l);
    }

    const visible = new Set();
    for (const [, edges] of nodeEdges) {
        const sorted = edges.slice().sort((a, b) => (b.amount || 0) - (a.amount || 0));
        for (let i = 0; i < Math.min(k, sorted.length); i++) {
            visible.add(sorted[i].id);
        }
    }
    return visible;
}

/**
 * Build adjacency set for fast neighbor lookups.
 */
function buildAdjacency(links) {
    const adj = new Map(); // nodeId -> Set of neighbor nodeIds
    const edgeMap = new Map(); // nodeId -> Set of edge ids connected to it
    for (const l of links) {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        if (!adj.has(sId)) adj.set(sId, new Set());
        if (!adj.has(tId)) adj.set(tId, new Set());
        adj.get(sId).add(tId);
        adj.get(tId).add(sId);
        if (!edgeMap.has(sId)) edgeMap.set(sId, new Set());
        if (!edgeMap.has(tId)) edgeMap.set(tId, new Set());
        edgeMap.get(sId).add(l.id);
        edgeMap.get(tId).add(l.id);
    }
    return { adj, edgeMap };
}

/**
 * Compute padded convex hull path for a set of points.
 */
function computeHullPath(points, padding) {
    if (points.length < 3) {
        // For 1-2 nodes, draw a circle around them
        if (points.length === 1) {
            const [x, y] = points[0];
            const r = padding + 20;
            return `M${x - r},${y} A${r},${r} 0 1,0 ${x + r},${y} A${r},${r} 0 1,0 ${x - r},${y}Z`;
        }
        if (points.length === 2) {
            // Capsule shape
            const [[x1, y1], [x2, y2]] = points;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len * (padding + 15);
            const ny = dx / len * (padding + 15);
            return `M${x1 + nx},${y1 + ny} L${x2 + nx},${y2 + ny}
                    A${padding + 15},${padding + 15} 0 0,1 ${x2 - nx},${y2 - ny}
                    L${x1 - nx},${y1 - ny}
                    A${padding + 15},${padding + 15} 0 0,1 ${x1 + nx},${y1 + ny}Z`;
        }
    }

    const hull = d3.polygonHull(points);
    if (!hull) return '';

    // Pad the hull outward
    const cx = d3.mean(hull, p => p[0]);
    const cy = d3.mean(hull, p => p[1]);
    const padded = hull.map(([x, y]) => {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return [x + (dx / dist) * padding, y + (dy / dist) * padding];
    });

    return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.8))(padded);
}

/* ══════════════════════════════════════════ */

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
    const componentsRef = useRef([]);
    const adjacencyRef = useRef({ adj: new Map(), edgeMap: new Map() });
    const initializedRef = useRef(false);
    const zoomRef = useRef(null);
    const flowGroupRef = useRef(null);
    const flowFrameRef = useRef(null);
    const flowDotsRef = useRef([]);
    const activeEdgesRef = useRef(new Set());
    const suspicionMapRef = useRef(new Map());
    const currentZoomScale = useRef(1);
    const focusedNodeRef = useRef(null);
    const [hoverInfo, setHoverInfo] = useState(null);

    // Convert Cytoscape format → D3 format
    const { d3Nodes, d3Links } = useMemo(() => {
        if (!elements || elements.length === 0) return { d3Nodes: [], d3Links: [] };

        const nodeItems = [];
        const linkItems = [];

        for (const el of elements) {
            if (el.data.source) {
                linkItems.push({
                    id: el.data.id,
                    source: el.data.source,
                    target: el.data.target,
                    amount: el.data.amount || 0,
                    timestamp: el.data.timestamp || '',
                });
            } else {
                nodeItems.push({
                    id: el.data.id,
                    label: el.data.label || el.data.id,
                    totalSent: el.data.totalSent || 0,
                    totalReceived: el.data.totalReceived || 0,
                    txCount: el.data.txCount || 0,
                    inCount: el.data.inCount || 0,
                    outCount: el.data.outCount || 0,
                    ringId: el.data.ringId || null,
                    ringColor: el.data.ringColor || null,
                });
            }
        }

        return { d3Nodes: nodeItems, d3Links: linkItems };
    }, [elements]);

    // ══ Initialize D3 force simulation + SVG ══
    useEffect(() => {
        if (d3Nodes.length === 0 || !containerRef.current) {
            initializedRef.current = false;
            return;
        }
        if (initializedRef.current) return;
        initializedRef.current = true;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        d3.select(container).selectAll('*').remove();

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'transparent');

        svgRef.current = svg;

        // ── Arrow markers + pulse animation ──
        const defs = svg.append('defs');
        const markerConfigs = [
            { id: 'arrow-normal', fill: 'rgba(90, 127, 164, 0.20)' },
            { id: 'arrow-active', fill: 'rgba(0, 194, 255, 0.35)' },
            { id: 'arrow-threat', fill: 'rgba(255, 59, 59, 0.35)' },
            { id: 'arrow-focus', fill: 'rgba(0, 230, 255, 0.7)' },
        ];
        for (const mc of markerConfigs) {
            defs.append('marker')
                .attr('id', mc.id)
                .attr('viewBox', '0 -4 8 8')
                .attr('refX', 18).attr('refY', 0)
                .attr('markerWidth', 4).attr('markerHeight', 4)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-3L8,0L0,3')
                .attr('fill', mc.fill);
        }

        // Deep copy
        const nodes = d3Nodes.map(d => ({ ...d }));
        const links = d3Links.map(d => ({ ...d }));
        nodesDataRef.current = nodes;
        linksDataRef.current = links;

        // ── Cluster Detection & Layout ──
        const components = getConnectedComponents(nodes, links);
        layoutComponentsInGrid(components, width, height);
        componentsRef.current = components;

        // Build adjacency for focus interactions
        const { adj, edgeMap } = buildAdjacency(links);
        adjacencyRef.current = { adj, edgeMap };

        // ── Dynamic Force Scaling ──
        const N = nodes.length;
        const chargeStrength = N <= 50 ? -500 : N <= 150 ? -350 : -250;
        const linkDistance = N <= 50 ? 200 : N <= 150 ? 160 : 120;
        const linkStrengthVal = N <= 50 ? 0.35 : 0.25;
        const collisionRadius = N <= 50 ? 40 : N <= 150 ? 32 : 26;
        const alphaDecayVal = N <= 50 ? 0.035 : 0.045;

        // Edge filtering for large graphs
        const visibleEdgeIds = N > 100 ? getVisibleEdgeIds(links, 5) : null;
        const visibleLinks = visibleEdgeIds ? links.filter(l => visibleEdgeIds.has(l.id)) : links;

        // ── Zoom ──
        const g = svg.append('g');
        const zoom = d3.zoom()
            .scaleExtent([0.1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                const scale = event.transform.k;
                currentZoomScale.current = scale;

                // LOD: labels
                g.selectAll('.node-label')
                    .style('opacity', scale > 1.5 ? 0.85 : 0);

                // LOD: weak edges
                if (visibleEdgeIds) {
                    g.selectAll('.graph-link-weak')
                        .style('display', scale > 2.0 ? 'block' : 'none');
                }

                // LOD: node size at extreme zoom out
                if (scale < 0.4) {
                    g.selectAll('.node-circle').attr('r', function (d) {
                        const score = suspicionMapRef.current?.get(d.id) || 0;
                        return nodeRadius(score) * 0.5;
                    });
                } else {
                    g.selectAll('.node-circle').attr('r', function (d) {
                        const score = suspicionMapRef.current?.get(d.id) || 0;
                        return nodeRadius(score);
                    });
                }

                // Update hulls on zoom (they need re-render during simulation)
                updateHulls();
            });
        svg.call(zoom);
        zoomRef.current = { svg, zoom };

        // ── Render Layers (order matters: hulls → edges → flow → nodes) ──
        const hullGroup = g.append('g').attr('class', 'hull-layer');
        const edgeGroup = g.append('g').attr('class', 'edge-layer');
        const flowGroup = g.append('g').attr('class', 'flow-layer');
        const nodeGroup = g.append('g').attr('class', 'node-layer');
        flowGroupRef.current = flowGroup;

        // ── Cluster Hulls ──
        const hullPaths = hullGroup.selectAll('path')
            .data(components.filter(c => c.nodes.length >= 2))
            .join('path')
            .attr('class', 'cluster-hull')
            .attr('fill', (d, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length])
            .attr('stroke', (d, i) => CLUSTER_STROKE_COLORS[i % CLUSTER_STROKE_COLORS.length])
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,3')
            .style('pointer-events', 'none');

        function updateHulls() {
            hullPaths.attr('d', comp => {
                const pts = comp.nodes.map(n => [n.x, n.y]);
                return computeHullPath(pts, 30);
            });
        }

        // ── Per-Cluster Gravity Force ──
        // Each node is attracted to its cluster center, not a global center
        function clusterForce(alpha) {
            for (const comp of components) {
                // Compute live cluster centroid
                let sx = 0, sy = 0;
                for (const n of comp.nodes) { sx += n.x; sy += n.y; }
                comp.cx = sx / comp.nodes.length;
                comp.cy = sy / comp.nodes.length;
            }

            for (const n of nodes) {
                const comp = components[n.clusterId];
                if (!comp) continue;
                // Gentle pull toward cluster center
                n.vx += (comp.cx - n.x) * alpha * 0.08;
                n.vy += (comp.cy - n.y) * alpha * 0.08;
            }
        }

        // ── Inter-Cluster Repulsion ──
        function clusterRepulsion(alpha) {
            if (components.length <= 1) return;
            const repulsionStrength = 600;
            for (let i = 0; i < components.length; i++) {
                for (let j = i + 1; j < components.length; j++) {
                    const a = components[i], b = components[j];
                    let dx = b.cx - a.cx;
                    let dy = b.cy - a.cy;
                    let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    // Scale repulsion by cluster size
                    const minDist = (Math.sqrt(a.nodes.length) + Math.sqrt(b.nodes.length)) * 40;
                    if (dist < minDist) {
                        const force = repulsionStrength * alpha / (dist * dist);
                        const fx = dx / dist * force;
                        const fy = dy / dist * force;
                        for (const n of a.nodes) { n.vx -= fx; n.vy -= fy; }
                        for (const n of b.nodes) { n.vx += fx; n.vy += fy; }
                    }
                }
            }
        }

        // ── Force Simulation ──
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(linkDistance).strength(linkStrengthVal))
            .force('charge', d3.forceManyBody().strength(chargeStrength).distanceMax(400))
            .force('collision', d3.forceCollide().radius(collisionRadius))
            .force('clusterGravity', clusterForce)
            .force('clusterRepulsion', clusterRepulsion)
            // Gentle boundary force to keep nodes on screen
            .force('x', d3.forceX(width / 2).strength(0.015))
            .force('y', d3.forceY(height / 2).strength(0.015))
            .alphaDecay(alphaDecayVal)
            .velocityDecay(0.4);

        simRef.current = simulation;

        // Stabilization
        simulation.on('end', () => simulation.stop());

        // ── Edges (curved paths, very low default opacity) ──
        const link = edgeGroup.selectAll('.graph-link-primary')
            .data(visibleLinks)
            .join('path')
            .attr('class', 'graph-link graph-link-primary')
            .attr('fill', 'none')
            .attr('stroke', 'rgba(90, 127, 164, 0.07)')
            .attr('stroke-width', d => 0.4 + (Math.min(d.amount, 5000) / 5000) * 1.2)
            .attr('marker-end', 'url(#arrow-normal)');

        // ── Edge Hit Areas (invisible wider paths for click targets) ──
        const edgeHitArea = edgeGroup.selectAll('.edge-hit-area')
            .data(visibleLinks)
            .join('path')
            .attr('class', 'edge-hit-area')
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 12)
            .style('cursor', 'pointer');

        // Weak edges (hidden by default)
        let weakLink = null;
        if (visibleEdgeIds) {
            const weakLinks = links.filter(l => !visibleEdgeIds.has(l.id));
            if (weakLinks.length > 0) {
                weakLink = edgeGroup.selectAll('.graph-link-weak')
                    .data(weakLinks)
                    .join('path')
                    .attr('class', 'graph-link graph-link-weak')
                    .attr('fill', 'none')
                    .attr('stroke', 'rgba(90, 127, 164, 0.03)')
                    .attr('stroke-width', 0.3)
                    .style('display', 'none');
            }
        }

        // Pulse dot layer for transaction focus animation
        const pulseGroup = g.append('g').attr('class', 'pulse-layer').style('pointer-events', 'none');
        let pulseAnimFrame = null;

        // ── Nodes ──
        const node = nodeGroup.selectAll('g')
            .data(nodes)
            .join('g')
            .attr('class', 'graph-node')
            .style('cursor', 'pointer');

        // Ring boundary
        node.append('circle')
            .attr('class', 'ring-boundary')
            .attr('r', 16)
            .attr('fill', 'none')
            .attr('stroke', 'transparent')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,2');

        // Threat glow
        node.append('circle')
            .attr('class', 'threat-glow')
            .attr('r', 14)
            .attr('fill', 'rgba(255, 59, 59, 0)')
            .attr('stroke', 'none');

        // Main node circle
        node.append('circle')
            .attr('class', 'node-circle')
            .attr('r', 10)
            .attr('fill', d => {
                if (d.ringColor) return d.ringColor;
                const score = suspicionMapRef.current?.get(d.id) || 0;
                return riskColor(score);
            })
            .attr('stroke', d => {
                if (d.ringColor) return d3.color(d.ringColor).darker(0.5);
                return '#3A5570';
            })
            .attr('stroke-width', 1.5);

        // Labels (hidden by default)
        node.append('text')
            .attr('class', 'node-label')
            .text(d => d.label)
            .attr('dy', 22)
            .attr('text-anchor', 'middle')
            .attr('fill', '#7A8FA3')
            .attr('font-size', '8px')
            .attr('font-family', "'IBM Plex Mono', monospace")
            .attr('font-weight', 500)
            .style('paint-order', 'stroke')
            .style('stroke', '#0B0F14')
            .style('stroke-width', '2px')
            .style('opacity', 0)
            .style('pointer-events', 'none');

        // ══ Focus Interaction Mode (Node-level) ══
        function clearAllFocus() {
            node.transition().duration(200).style('opacity', 1);
            link.transition().duration(200)
                .attr('stroke', 'rgba(90, 127, 164, 0.07)')
                .attr('stroke-width', d => 0.4 + (Math.min(d.amount, 5000) / 5000) * 1.2)
                .attr('marker-end', 'url(#arrow-normal)');
            if (weakLink) weakLink.transition().duration(200)
                .style('display', 'none')
                .style('opacity', 1)
                .attr('stroke', 'rgba(90, 127, 164, 0.03)')
                .attr('stroke-width', 0.3);
            hullPaths.transition().duration(200).style('opacity', 1);
            focusedNodeRef.current = null;
            // Stop pulse animation
            if (pulseAnimFrame) { cancelAnimationFrame(pulseAnimFrame); pulseAnimFrame = null; }
            pulseGroup.selectAll('*').remove();
        }

        function applyFocus(focusNodeId) {
            if (!focusNodeId) { clearAllFocus(); return; }

            focusedNodeRef.current = focusNodeId;
            const neighbors = adjacencyRef.current.adj.get(focusNodeId) || new Set();
            const connectedEdges = adjacencyRef.current.edgeMap.get(focusNodeId) || new Set();

            // Dim non-related nodes
            node.transition().duration(200)
                .style('opacity', d => {
                    if (d.id === focusNodeId) return 1;
                    if (neighbors.has(d.id)) return 0.85;
                    return 0.08;
                });

            // Highlight connected edges, dim others
            link.transition().duration(200)
                .attr('stroke', d => {
                    if (connectedEdges.has(d.id)) return 'rgba(0, 194, 255, 0.4)';
                    return 'rgba(90, 127, 164, 0.02)';
                })
                .attr('stroke-width', d => {
                    if (connectedEdges.has(d.id)) return 1.5 + (Math.min(d.amount, 5000) / 5000) * 2;
                    return 0.3;
                });

            if (weakLink) {
                weakLink.transition().duration(200)
                    .style('display', 'block')
                    .attr('stroke', d => {
                        if (connectedEdges.has(d.id)) return 'rgba(0, 194, 255, 0.35)';
                        return 'rgba(90, 127, 164, 0.02)';
                    })
                    .attr('stroke-width', d => {
                        if (connectedEdges.has(d.id)) return 1.2;
                        return 0.2;
                    })
                    .style('opacity', d => connectedEdges.has(d.id) ? 1 : 0.02);
            }

            const focusCluster = nodes.find(n => n.id === focusNodeId)?.clusterId;
            hullPaths.transition().duration(200)
                .style('opacity', (d, i) => i === focusCluster ? 1 : 0.2);
        }

        // ══ Transaction Focus (Edge-level selection) ══
        function applyTransactionFocus(edgeData) {
            if (!edgeData) { clearAllFocus(); return; }

            focusedNodeRef.current = '__transaction__';
            const senderId = edgeData.source.id || edgeData.source;
            const receiverId = edgeData.target.id || edgeData.target;

            // Sender + receiver neighbors for context
            const senderNeighbors = adjacencyRef.current.adj.get(senderId) || new Set();
            const receiverNeighbors = adjacencyRef.current.adj.get(receiverId) || new Set();
            const relevantNodes = new Set([senderId, receiverId]);
            // Include immediate neighbors at reduced opacity
            for (const n of senderNeighbors) relevantNodes.add(n);
            for (const n of receiverNeighbors) relevantNodes.add(n);

            // Nodes: sender/receiver full, neighbors moderate, rest faded
            node.transition().duration(250)
                .style('opacity', d => {
                    if (d.id === senderId || d.id === receiverId) return 1;
                    if (relevantNodes.has(d.id)) return 0.35;
                    return 0.06;
                });

            // Show labels for sender and receiver
            node.each(function (d) {
                if (d.id === senderId || d.id === receiverId) {
                    d3.select(this).select('.node-label').style('opacity', 0.9);
                }
            });

            // Edges: selected edge bright, connected edges moderate, rest near-invisible
            const senderEdges = adjacencyRef.current.edgeMap.get(senderId) || new Set();
            const receiverEdges = adjacencyRef.current.edgeMap.get(receiverId) || new Set();

            link.transition().duration(250)
                .attr('stroke', d => {
                    if (d.id === edgeData.id) return 'rgba(0, 230, 255, 0.7)';
                    if (senderEdges.has(d.id) || receiverEdges.has(d.id)) return 'rgba(0, 194, 255, 0.15)';
                    return 'rgba(90, 127, 164, 0.015)';
                })
                .attr('stroke-width', d => {
                    if (d.id === edgeData.id) return 2.5;
                    if (senderEdges.has(d.id) || receiverEdges.has(d.id)) return 0.8;
                    return 0.2;
                })
                .attr('marker-end', d => {
                    if (d.id === edgeData.id) return 'url(#arrow-focus)';
                    return 'url(#arrow-normal)';
                });

            if (weakLink) {
                weakLink.transition().duration(250)
                    .style('display', 'block')
                    .attr('stroke', d => {
                        if (d.id === edgeData.id) return 'rgba(0, 230, 255, 0.7)';
                        if (senderEdges.has(d.id) || receiverEdges.has(d.id)) return 'rgba(0, 194, 255, 0.12)';
                        return 'rgba(90, 127, 164, 0.01)';
                    })
                    .attr('stroke-width', d => {
                        if (d.id === edgeData.id) return 2.5;
                        if (senderEdges.has(d.id) || receiverEdges.has(d.id)) return 0.6;
                        return 0.15;
                    })
                    .style('opacity', d => (senderEdges.has(d.id) || receiverEdges.has(d.id)) ? 1 : 0.01);
            }
            hullPaths.transition().duration(250).style('opacity', 0.15);

            // ── Directional Pulse Animation ──
            if (pulseAnimFrame) { cancelAnimationFrame(pulseAnimFrame); pulseAnimFrame = null; }
            pulseGroup.selectAll('*').remove();

            const pulse = { progress: 0 };
            function animatePulse() {
                pulse.progress += 0.006;
                if (pulse.progress > 1) pulse.progress = 0;

                const sx = edgeData.source.x, sy = edgeData.source.y;
                const tx = edgeData.target.x, ty = edgeData.target.y;
                if (sx == null || tx == null) { pulseAnimFrame = requestAnimationFrame(animatePulse); return; }

                const t = pulse.progress;
                const x = sx + (tx - sx) * t;
                const y = sy + (ty - sy) * t;
                const fadeIn = Math.min(t / 0.1, 1);
                const fadeOut = Math.min((1 - t) / 0.1, 1);
                const alpha = 0.8 * fadeIn * fadeOut;

                pulseGroup.selectAll('*').remove();
                // Glow
                pulseGroup.append('circle')
                    .attr('cx', x).attr('cy', y).attr('r', 5)
                    .attr('fill', 'rgba(0, 230, 255, 0.15)');
                // Core dot
                pulseGroup.append('circle')
                    .attr('cx', x).attr('cy', y).attr('r', 2.5)
                    .attr('fill', `rgba(0, 230, 255, ${alpha})`);

                pulseAnimFrame = requestAnimationFrame(animatePulse);
            }
            pulseAnimFrame = requestAnimationFrame(animatePulse);
        }

        // ── Edge click handler ──
        edgeHitArea.on('click', function (event, d) {
            event.stopPropagation();
            pinnedNodeId = null; // Clear any node pin
            applyTransactionFocus(d);
        });

        edgeHitArea.on('mouseenter', function () {
            d3.select(this).style('cursor', 'pointer');
        });

        // ── Pinned node tracking (click-to-lock) ──
        let pinnedNodeId = null;

        // ── Drag ──
        let isDragging = false;
        const drag = d3.drag()
            .on('start', (event, d) => {
                isDragging = true;
                setHoverInfo(null);
                if (!event.active) simulation.alphaTarget(0.08).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                isDragging = false;
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });

        node.call(drag);

        // ── Hover: show HoverCard + apply focus ──
        node.on('mouseenter', function (event, d) {
            if (isDragging) return;
            const svgNode = svg.node();
            const transform = d3.zoomTransform(svgNode);
            const x = transform.applyX(d.x);
            const y = transform.applyY(d.y);
            setHoverInfo({ x, y, data: d });

            // Apply hover focus (works even when pinned — shows this node's context)
            applyFocus(d.id);

            // Show hovered node label
            d3.select(this).select('.node-label').style('opacity', 0.9);
        });

        node.on('mouseleave', function () {
            setHoverInfo(null);
            // If a node is pinned (clicked), restore its focus instead of clearing
            if (pinnedNodeId) {
                applyFocus(pinnedNodeId);
            } else if (focusedNodeRef.current !== '__transaction__') {
                applyFocus(null);
            }
        });

        // Click handler — pin focus + open side panel (toggle on re-click)
        node.on('click', (event, d) => {
            event.stopPropagation();
            if (pinnedNodeId === d.id) {
                // Same node clicked again → deselect
                pinnedNodeId = null;
                clearAllFocus();
                onNodeSelect?.(null);
            } else {
                pinnedNodeId = d.id;
                applyFocus(d.id);
                onNodeSelect?.({
                    id: d.id,
                    label: d.label,
                    totalSent: d.totalSent,
                    totalReceived: d.totalReceived,
                    txCount: d.txCount,
                    ringId: d.ringId,
                });
            }
        });

        // Double-click zoom
        node.on('dblclick', (event, d) => {
            event.stopPropagation();
            svg.transition().duration(400).call(
                zoom.transform,
                d3.zoomIdentity.translate(width / 2, height / 2).scale(2.5).translate(-d.x, -d.y)
            );
        });

        // Click background to deselect and clear focus
        svg.on('click', () => {
            pinnedNodeId = null;
            onNodeSelect?.(null);
            clearAllFocus();
        });

        // ── Curved path generator ──
        function arcPath(d) {
            const sx = d.source.x, sy = d.source.y;
            const tx = d.target.x, ty = d.target.y;
            const dx = tx - sx, dy = ty - sy;
            const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
            return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
        }

        // ── Tick ──
        simulation.on('tick', () => {
            link.attr('d', arcPath);
            edgeHitArea.attr('d', arcPath);
            if (weakLink) weakLink.attr('d', arcPath);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
            updateHulls();
        });

        // ── Resize ──
        const handleResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            svg.attr('width', w).attr('height', h);
            simulation.force('x', d3.forceX(w / 2).strength(0.015));
            simulation.force('y', d3.forceY(h / 2).strength(0.015));
            simulation.alpha(0.08).restart();
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        return () => {
            simulation.stop();
            resizeObserver.disconnect();
            if (flowFrameRef.current) cancelAnimationFrame(flowFrameRef.current);
            if (pulseAnimFrame) cancelAnimationFrame(pulseAnimFrame);
            initializedRef.current = false;
        };
    }, [d3Nodes, d3Links, onNodeSelect]);

    // ══ Update visuals on suspicion changes ══
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg || !suspicionMap || suspicionMap.size === 0) return;

        const g = svg.select('g');

        g.selectAll('.graph-node').each(function (d) {
            const score = suspicionMap.get(d.id) || 0;
            const color = riskColor(score);
            const r = nodeRadius(score);
            const el = d3.select(this);

            el.select('.node-circle')
                .transition().duration(250)
                .attr('r', r)
                .attr('fill', color)
                .attr('stroke', score > 70 ? 'rgba(255, 59, 59, 0.5)' : '#3A5570');

            el.select('.threat-glow')
                .transition().duration(250)
                .attr('r', r + 5)
                .attr('fill', score > 70 ? 'rgba(255, 59, 59, 0.08)' : 'rgba(255, 59, 59, 0)');

            const ringInfo = ringMap?.get(d.id);
            el.select('.ring-boundary')
                .transition().duration(250)
                .attr('r', r + 8)
                .attr('stroke', (showRings && ringInfo) ? '#FFC857' : 'transparent');

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

            // Don't override focus mode visuals
            if (focusedNodeRef.current) return;

            let color, marker;
            if (isSuspicious) {
                color = 'rgba(255, 59, 59, 0.15)';
                marker = 'url(#arrow-threat)';
            } else if (isActive) {
                color = 'rgba(0, 194, 255, 0.15)';
                marker = 'url(#arrow-active)';
            } else {
                color = 'rgba(90, 127, 164, 0.07)';
                marker = 'url(#arrow-normal)';
            }

            el.transition().duration(200)
                .attr('stroke', color)
                .attr('marker-end', marker)
                .style('opacity', dimmed ? 0.02 : 1);
        });
    }, [suspicionMap, activeEdges, showRings, ringMap, suspicionThreshold, amountThreshold]);

    // Keep refs in sync
    useEffect(() => { activeEdgesRef.current = activeEdges || new Set(); }, [activeEdges]);
    useEffect(() => { suspicionMapRef.current = suspicionMap || new Map(); }, [suspicionMap]);

    // ══ Transaction Flow Animation ══
    useEffect(() => {
        const flowGroup = flowGroupRef.current;
        const links = linksDataRef.current;
        if (!flowGroup || !links || links.length === 0) return;

        if (flowFrameRef.current) cancelAnimationFrame(flowFrameRef.current);
        flowDotsRef.current = [];

        // Pulse Logic: We monitor activeEdgesRef directly. 
        // Whenever a link is in activeEdges, we spawn a pulse.
        // But activeEdges might stay populated for ~50ms tick.
        // We want one pulse per activation. 
        // To do this simplistically: we just spawn for all active edges in the loop,
        // relying on the fact that the simulation window moves.

        // Actually, simpler: just spawn randomly if active, or just spawn once?
        // Let's spawn continuously while active to represent flow.

        let spawnTimer = 0;
        const SPAWN_INTERVAL = 6;
        const DOT_SPEED = 0.015; // Faster for better visibility

        function animate() {
            spawnTimer++;
            const currentActiveEdges = activeEdgesRef.current;
            const currentSuspicionMap = suspicionMapRef.current;

            // Spawn new dots
            if (spawnTimer >= SPAWN_INTERVAL && currentActiveEdges.size > 0) {
                spawnTimer = 0;
                for (const link of links) {
                    if (!currentActiveEdges.has(link.id)) continue;

                    const srcId = link.source.id || link.source;
                    const srcScore = currentSuspicionMap.get(srcId) || 0;
                    const isSuspicious = srcScore > 60;

                    flowDotsRef.current.push({
                        link, progress: 0,
                        speed: DOT_SPEED + Math.random() * 0.005,
                        color: '#00C2FF', // Always Cyan per user request "pulse"
                        opacity: 1,
                        radius: 3,
                    });
                }
            }

            const alive = [];
            flowGroup.selectAll('.flow-dot').remove();

            for (const dot of flowDotsRef.current) {
                dot.progress += dot.speed;
                if (dot.progress >= 1) continue;
                const sx = dot.link.source.x, sy = dot.link.source.y;
                const tx = dot.link.target.x, ty = dot.link.target.y;
                if (sx == null || sy == null || tx == null || ty == null) continue;

                const x = sx + (tx - sx) * dot.progress;
                const y = sy + (ty - sy) * dot.progress;

                // Opacity fade in/out
                const fadeIn = Math.min(dot.progress / 0.1, 1);
                const fadeOut = Math.min((1 - dot.progress) / 0.1, 1);
                const alpha = dot.opacity * fadeIn * fadeOut;

                flowGroup.append('circle')
                    .attr('class', 'flow-dot')
                    .attr('cx', x).attr('cy', y)
                    .attr('r', dot.radius)
                    .attr('fill', dot.color)
                    .attr('opacity', alpha)
                    .attr('filter', 'drop-shadow(0 0 4px rgba(0, 194, 255, 0.8))')
                    .style('pointer-events', 'none');

                alive.push(dot);
            }

            flowDotsRef.current = alive;
            flowFrameRef.current = requestAnimationFrame(animate);
        }

        flowFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (flowFrameRef.current) cancelAnimationFrame(flowFrameRef.current);
            flowGroup.selectAll('.flow-dot').remove();
            flowDotsRef.current = [];
        };
    }, [d3Nodes]);

    // ══ Highlight Search ══
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const g = svg.select('g');

        g.selectAll('.graph-node').each(function (d) {
            const score = suspicionMapRef.current?.get(d.id) || 0;
            d3.select(this).select('.node-circle')
                .attr('stroke', score > 70 ? 'rgba(255, 59, 59, 0.5)' : '#3A5570')
                .attr('stroke-width', 1.5);
        });

        if (!highlightNodeId) return;

        g.selectAll('.graph-node').each(function (d) {
            if (d.id === highlightNodeId) {
                const el = d3.select(this);
                el.select('.node-circle')
                    .attr('stroke', '#00C2FF')
                    .attr('stroke-width', 3);
                el.select('.node-label').style('opacity', 0.9);

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

    // ══ Idle State ══
    if (!elements || elements.length === 0) {
        return (
            <div style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '12px',
            }}>
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

    const fmt = (v) => v != null ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
        >
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0,194,255,0.015) 0%, transparent 70%)',
                pointerEvents: 'none', zIndex: 1,
            }} />

            {hoverInfo && (
                <HoverCard open defaultOpenDelay={0}>
                    <HoverCardTrigger asChild>
                        <div style={{
                            position: 'absolute',
                            left: hoverInfo.x - 2, top: hoverInfo.y - 2,
                            width: 4, height: 4, pointerEvents: 'none',
                        }} />
                    </HoverCardTrigger>
                    <HoverCardContent side="top" sideOffset={12}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ color: '#00C2FF', fontWeight: 600, fontSize: '11px', marginBottom: '4px', letterSpacing: '1px' }}>
                                {hoverInfo.data.label}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', fontSize: '10px' }}>
                                <span style={{ color: '#7A8FA3' }}>TRANSACTIONS</span>
                                <span>{hoverInfo.data.txCount || 0}</span>
                                <span style={{ color: '#7A8FA3' }}>INCOMING</span>
                                <span>{hoverInfo.data.inCount || 0}</span>
                                <span style={{ color: '#7A8FA3' }}>OUTGOING</span>
                                <span>{hoverInfo.data.outCount || 0}</span>
                                <span style={{ color: '#7A8FA3' }}>TOTAL IN</span>
                                <span style={{ color: '#4CAF50' }}>{fmt(hoverInfo.data.totalReceived)}</span>
                                <span style={{ color: '#7A8FA3' }}>TOTAL OUT</span>
                                <span style={{ color: '#FF6B6B' }}>{fmt(hoverInfo.data.totalSent)}</span>
                                {(suspicionMapRef.current?.get(hoverInfo.data.id) > 0) && (<>
                                    <span style={{ color: '#7A8FA3' }}>SUSPICION</span>
                                    <span style={{ color: '#FFC857' }}>{Math.round(suspicionMapRef.current.get(hoverInfo.data.id))}</span>
                                </>)}
                                {hoverInfo.data.ringId && (<>
                                    <span style={{ color: '#7A8FA3' }}>RING</span>
                                    <span style={{ color: '#FFC857' }}>{hoverInfo.data.ringId}</span>
                                </>)}
                            </div>
                        </div>
                    </HoverCardContent>
                </HoverCard>
            )}
        </div>
    );
}

export { riskTier, riskColor };
