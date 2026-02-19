/**
 * detectRings — Fraud Ring Detection via Tarjan's SCC Algorithm
 *
 * Finds strongly connected components (cycles) in the transaction graph,
 * which represent potential money laundering rings.
 *
 * @param {Array} nodes - Array of { data: { id } }
 * @param {Array} edges - Array of { data: { source, target } }
 * @returns {Array<{ ringId: string, members: string[], color: string }>}
 */

const RING_COLORS = [
    'rgba(255, 107, 53, 0.25)',   // orange
    'rgba(168, 85, 247, 0.25)',   // purple
    'rgba(236, 72, 153, 0.25)',   // pink
    'rgba(34, 211, 238, 0.25)',   // cyan
    'rgba(250, 204, 21, 0.25)',   // yellow
    'rgba(52, 211, 153, 0.25)',   // green
];

export function detectRings(nodes, edges) {
    // Build adjacency list
    const adj = new Map();
    for (const n of nodes) {
        adj.set(n.data.id, []);
    }
    for (const e of edges) {
        const src = e.data.source;
        const tgt = e.data.target;
        if (adj.has(src)) {
            adj.get(src).push(tgt);
        }
    }

    // Tarjan's SCC
    let index = 0;
    const stack = [];
    const onStack = new Set();
    const indices = new Map();
    const lowlinks = new Map();
    const sccs = [];

    function strongconnect(v) {
        indices.set(v, index);
        lowlinks.set(v, index);
        index++;
        stack.push(v);
        onStack.add(v);

        for (const w of (adj.get(v) || [])) {
            if (!indices.has(w)) {
                strongconnect(w);
                lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
            } else if (onStack.has(w)) {
                lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
            }
        }

        if (lowlinks.get(v) === indices.get(v)) {
            const scc = [];
            let w;
            do {
                w = stack.pop();
                onStack.delete(w);
                scc.push(w);
            } while (w !== v);
            sccs.push(scc);
        }
    }

    for (const [v] of adj) {
        if (!indices.has(v)) {
            strongconnect(v);
        }
    }

    // Filter: only rings with 3+ members
    const rings = sccs
        .filter((scc) => scc.length >= 3)
        .map((members, i) => ({
            ringId: `RING_${String(i + 1).padStart(2, '0')}`,
            members,
            color: RING_COLORS[i % RING_COLORS.length],
        }));

    return rings;
}

/**
 * Build a lookup map: accountId → ring info
 */
export function buildRingMap(rings) {
    const map = new Map();
    for (const ring of rings) {
        for (const memberId of ring.members) {
            map.set(memberId, { ringId: ring.ringId, color: ring.color });
        }
    }
    return map;
}
