/**
 * Shell Network Detector (Production-Grade v1.0)
 * Ported from Python Reference Logic
 */

// ==============================
// CONFIG
// ==============================

const SHELL_TXN_MIN = 2;          // intermediate must have AT LEAST this many total txns
const SHELL_TXN_MAX = 3;          // intermediate must have AT MOST this many total txns
const MIN_HOPS = 3;
const MAX_HOPS = 5;
const MAX_TIME_SPAN_MS = 30 * 24 * 3600 * 1000; // 30 days in ms
const TINY_DATASET_THRESHOLD = 10;

// Utilities
const clamp01 = (x) => Math.max(0.0, Math.min(1.0, x));
const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export class ShellNetworkDetector {
    constructor(transactions) {
        this.transactions = transactions;

        // Data Structures
        this.collapsedGraph = new Map(); // u -> Set(v)
        this.multiGraph = new Map();     // "u|v" -> [txns]
        this.nodeInIndex = new Map();    // u -> [txns where receiver = u]
        this.nodeOutIndex = new Map();   // u -> [txns where sender = u]
        this.txnCount = new Map();       // u -> int (total txns)
    }

    build() {
        this.collapsedGraph.clear();
        this.multiGraph.clear();
        this.nodeInIndex.clear();
        this.nodeOutIndex.clear();
        this.txnCount.clear();

        this.transactions.forEach(t => {
            const s = t.sender_id;
            const r = t.receiver_id;
            const amount = parseFloat(t.amount);
            const rawTs = t.timestamp;
            let ts;
            if (rawTs && typeof rawTs === 'string' && !rawTs.includes('T')) {
                ts = new Date(rawTs.replace(' ', 'T') + 'Z');
            } else {
                ts = new Date(rawTs);
            }

            if (!s || !r || s === r) return;

            const txnObj = { ...t, amount, timestamp: ts };

            // Collapsed Graph
            if (!this.collapsedGraph.has(s)) this.collapsedGraph.set(s, new Set());
            this.collapsedGraph.get(s).add(r);

            // Multi Graph
            const key = `${s}|${r}`;
            if (!this.multiGraph.has(key)) this.multiGraph.set(key, []);
            this.multiGraph.get(key).push(txnObj);

            // Indices
            if (!this.nodeOutIndex.has(s)) this.nodeOutIndex.set(s, []);
            this.nodeOutIndex.get(s).push(txnObj);

            if (!this.nodeInIndex.has(r)) this.nodeInIndex.set(r, []);
            this.nodeInIndex.get(r).push(txnObj);

            // Counts
            this.txnCount.set(s, (this.txnCount.get(s) || 0) + 1);
            this.txnCount.set(r, (this.txnCount.get(r) || 0) + 1);
        });
    }

    get nodeCount() {
        return this.txnCount.size;
    }

    computeShellNodes() {
        const shells = new Set();
        this.txnCount.forEach((count, node) => {
            // STRICT REQUIREMENT: Intermediate nodes must have 2-3 total transactions
            if (count >= 2 && count <= 3) {
                shells.add(node);
            }
        });
        return shells;
    }

    enumerateShellPaths(shellNodes) {
        // Find potential start nodes (must have at least one connection to a shell node)
        // Start nodes can be anything (high volume etc), they are the source of funds
        const candidateStarts = [];
        this.collapsedGraph.forEach((targets, u) => {
            // A start node is valid if it connects to at least one shell node
            for (const v of targets) {
                if (shellNodes.has(v)) {
                    candidateStarts.push(u);
                    break;
                }
            }
        });

        const seenSignatures = new Set();
        const results = [];

        // DFS to find chains: Start -> Shell -> Shell -> ... -> End
        // Min Hops = 3 (Start -> Shell -> Shell -> End)
        const dfs = (path, visited) => {
            const current = path[path.length - 1];
            const depth = path.length - 1;

            // Check if valid end condition (min 3 hops)
            // Path: [Start, S1, S2, End] -> Length 4, Hops 3
            if (depth >= 3) {
                const sig = path.join('|');
                if (!seenSignatures.has(sig)) {
                    seenSignatures.add(sig);
                    results.push([...path]);
                }
            }

            if (depth >= MAX_HOPS) return;

            const neighbors = this.collapsedGraph.get(current);
            if (!neighbors) return;

            for (const neighbor of neighbors) {
                if (visited.has(neighbor)) continue;

                // CRITICAL LOGIC:
                // If we are at depth 0 (Start Node), neighbor MUST be a Shell Node
                // If we are at depth > 0 (Intermediate), neighbor must be Shell Node OR End Node
                // Actually, simply: Any node picked as 'intermediate' (index 1 to length-2) MUST be shell.
                // So, next node:
                // If we are not stopping here (continuing DFS), next node MUST be a shell node.
                // If we stop here (depth >= 3), current node becomes End Node (can be non-shell).

                // Let's enforce: Next node must be Shell Node to continue deeply.
                // If next node is NOT Shell Node, it can only be the Final Destination (and depth must be >= 2 to make it hop 3).

                const isShell = shellNodes.has(neighbor);

                if (isShell) {
                    // It's a shell, we can continue through it
                    visited.add(neighbor);
                    path.push(neighbor);
                    dfs(path, visited);
                    path.pop();
                    visited.delete(neighbor);
                } else {
                    // It's a non-shell node. It can ONLY be the End Node.
                    // And we can only stop if we have crossed at least 2 shell nodes (Start -> S1 -> S2 -> End)
                    // Current path is [Starts, ..., current]. neighbor is End.
                    // path.length + 1 will be new length. Hops = new length - 1.
                    // We need Hops >= 3.
                    if (depth + 1 >= 3) {
                        // Add as valid path and stop branch
                        const finalPath = [...path, neighbor];
                        const sig = finalPath.join('|');
                        if (!seenSignatures.has(sig)) {
                            seenSignatures.add(sig);
                            results.push(finalPath);
                        }
                    }
                }
            }
        };

        const uniqueStarts = new Set(candidateStarts);
        uniqueStarts.forEach(start => {
            // Start node itself doesn't need to be a shell node (usually legitimate source)
            dfs([start], new Set([start]));
        });

        return results;
    }

    validateAndScorePath(path) {
        const hops = path.length - 1;
        const chainTxns = [];
        let prevTs = null;

        for (let i = 0; i < hops; i++) {
            const u = path[i];
            const v = path[i + 1];
            const key = `${u}|${v}`;
            let candidates = this.multiGraph.get(key) || [];

            if (prevTs) {
                candidates = candidates.filter(t => t.timestamp >= prevTs);
            }

            if (candidates.length === 0) return null;

            candidates.sort((a, b) => a.timestamp - b.timestamp);
            const chosen = candidates[0];
            chainTxns.push(chosen);
            prevTs = chosen.timestamp;
        }

        const timestamps = chainTxns.map(t => t.timestamp);
        const minTs = new Date(Math.min(...timestamps.map(t => t.getTime())));
        const maxTs = new Date(Math.max(...timestamps.map(t => t.getTime())));
        const spanMs = maxTs - minTs;

        // Concentration Score
        const intermediates = path.slice(1, path.length - 1);
        const concScores = intermediates.map(node => {
            const counterparties = new Set();
            (this.nodeInIndex.get(node) || []).forEach(t => counterparties.add(t.sender_id));
            (this.nodeOutIndex.get(node) || []).forEach(t => counterparties.add(t.receiver_id));
            return 1.0 / Math.max(counterparties.size, 1);
        });
        const wConc = concScores.length ? mean(concScores) : 0.5;

        // Length Score
        let wLength = 0;
        if (hops === 3) wLength = 0.50;
        else if (hops === 4) wLength = 0.67;
        else if (hops === 5) wLength = 1.00;
        else wLength = Math.min(1.0, hops / MAX_HOPS);

        const wShell = 1.0;
        const wTime = Math.max(0.0, 1.0 - Math.min(spanMs / MAX_TIME_SPAN_MS, 1.0));

        const globalNodeCount = this.nodeCount;
        const wDataset = globalNodeCount < TINY_DATASET_THRESHOLD ? (globalNodeCount / TINY_DATASET_THRESHOLD) : 1.0;

        // Degree logic
        const startNode = path[0];
        const endNode = path[path.length - 1];

        const getDeg = (n) => {
            const out = (this.collapsedGraph.get(n) || new Set()).size;
            const enc = (this.nodeInIndex.get(n) || []).length;
            return out + enc;
        };

        const startDeg = getDeg(startNode);
        const endDeg = getDeg(endNode);
        const maxDeg = Math.max(startDeg, endDeg, 1);

        const wDegree = maxDeg > 20 ? Math.max(0.3, 1.0 - (Math.log10(maxDeg) / 3.0)) : 1.0;

        const rawScore = 100.0 * (0.25 * wLength + 0.35 * wShell + 0.25 * wTime + 0.15 * wConc);
        const finalScore = parseFloat((Math.min(100.0, Math.max(0.0, rawScore * wDataset * wDegree))).toFixed(2));

        return { path, score: finalScore, chainTxns };
    }

    clusterIntoRings(scoredPaths) {
        if (!scoredPaths.length) return { rings: [], suspiciousAccounts: [] };

        const n = scoredPaths.length;
        const parent = Array.from({ length: n }, (_, i) => i);

        const find = (i) => {
            let root = i;
            while (root !== parent[root]) root = parent[root];
            let curr = i;
            while (curr !== root) {
                const next = parent[curr];
                parent[curr] = root;
                curr = next;
            }
            return root;
        };

        const union = (i, j) => {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) parent[rootI] = rootJ;
        };

        const intermediates = scoredPaths.map(sp => new Set(sp.path.slice(1, sp.path.length - 1)));

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const setA = intermediates[i];
                const setB = intermediates[j];
                let intersect = false;

                // Optimize intersection setA & setB
                if (setA.size < setB.size) {
                    for (const elem of setA) {
                        if (setB.has(elem)) { intersect = true; break; }
                    }
                } else {
                    for (const elem of setB) {
                        if (setA.has(elem)) { intersect = true; break; }
                    }
                }

                if (intersect) union(i, j);
            }
        }

        const groups = new Map();
        for (let i = 0; i < n; i++) {
            const root = find(i);
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root).push(i);
        }

        const rings = [];
        const accountMap = new Map();

        let ringIdx = 1;
        groups.forEach((members) => {
            const ringId = `RING_${String(ringIdx).padStart(3, '0')}`;
            const ringPaths = members.map(m => scoredPaths[m]);

            const ringAccounts = new Set();
            let maxScore = 0;
            let maxTs = 0;

            ringPaths.forEach(rp => {
                if (rp.score > maxScore) maxScore = rp.score;
                rp.path.forEach(node => ringAccounts.add(node));

                // Find max timestamp in this path's transactions
                if (rp.chainTxns) {
                    rp.chainTxns.forEach(t => {
                        if (t.timestamp.getTime() > maxTs) maxTs = t.timestamp.getTime();
                    });
                }
            });

            rings.push({
                ring_id: ringId,
                member_accounts: Array.from(ringAccounts).sort(),
                pattern_type: "shell_network",
                risk_score: maxScore,
                last_transaction_time: maxTs > 0 ? maxTs : null,
                detected_at: maxTs > 0 ? new Date(maxTs).toISOString() : null
            });

            ringPaths.forEach(rp => {
                rp.path.forEach(node => {
                    const existing = accountMap.get(node);
                    if (!existing || rp.score > existing.suspicion_score) {
                        accountMap.set(node, {
                            account_id: node,
                            suspicion_score: rp.score,
                            detected_patterns: ["shell_network"],
                            ring_id: ringId
                        });
                    }
                });
            });
            ringIdx++;
        });

        const suspiciousAccounts = Array.from(accountMap.values()).sort((a, b) => b.suspicion_score - a.suspicion_score);
        return { rings, suspiciousAccounts };
    }

    run() {
        this.build();

        if (this.nodeCount < 3) return { rings: [], suspiciousAccounts: [], summary: {} };

        const shellNodes = this.computeShellNodes();
        if (shellNodes.size < 2) return { rings: [], suspiciousAccounts: [], summary: {} };

        const rawPaths = this.enumerateShellPaths(shellNodes);

        const scored = [];
        for (const p of rawPaths) {
            const res = this.validateAndScorePath(p);
            if (res && res.score > 0) scored.push(res);
        }

        const { rings, suspiciousAccounts } = this.clusterIntoRings(scored);

        return {
            rings,
            suspiciousAccounts,
            summary: {
                total_accounts_analyzed: this.nodeCount,
                suspicious_accounts_flagged: suspiciousAccounts.length,
                fraud_rings_detected: rings.length
            }
        };
    }
}
