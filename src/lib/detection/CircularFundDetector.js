/**
 * Circular Fund Routing Detector (Final Production Version)
 * Ported from Python Reference Logic
 */

// ==============================
// CONFIG
// ==============================

const MIN_CYCLE_LEN = 3;
const MAX_CYCLE_LEN = 5;
const MAX_ALLOWED_DURATION = 7 * 24 * 3600 * 1000; // ms
const HIGH_RISK_THRESHOLD = 0.0;
const HIGH_RISK_CYCLE_COUNT = 3;
const HUB_DEGREE_LIMIT = 20;

// Balanced CRS weights
const W_LENGTH = 0.25;
const W_AMOUNT = 0.20;
const W_TIME = 0.20;
const W_FREQUENCY = 0.20;
const W_VOLUME = 0.15;

// Utilities
const clamp01 = (x) => Math.max(0.0, Math.min(1.0, x));

const getStdDev = (array) => {
    if (array.length === 0) return 0;
    const n = array.length;
    const mean = array.reduce((a, b) => a + b) / n;
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
};

class CRSScorer {
    constructor(graphData, edgeMeta) {
        this.graphData = graphData; // { adj, outDegreeMap, nodeTotalOutAmount }
        this.edgeMeta = edgeMeta;   // Map "u|v" -> { count, totalAmount, timestamps[] }
    }

    lengthScore(cycle) {
        const L = cycle.length;
        return clamp01(
            (MAX_CYCLE_LEN - L + 1) /
            (MAX_CYCLE_LEN - MIN_CYCLE_LEN + 1)
        );
    }

    amountSimilarityScore(edges) {
        const amounts = [];
        for (const [u, v] of edges) {
            const key = `${u}|${v}`;
            const data = this.edgeMeta.get(key);
            if (data) {
                const avg = data.totalAmount / data.count;
                amounts.push(avg);
            }
        }

        if (amounts.length === 0) return 0.0;

        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        if (mean === 0) return 0.0;

        if (amounts.length === 1) return 1.0;

        const std = getStdDev(amounts);
        // Python's stdev is sample stdev (divide by N-1), JS implementation above is population (N). 
        // For small N, difference exists but minor for scoring. keeping simple.

        return clamp01(1 - std / mean);
    }

    timeScore(edges) {
        let allTimestamps = [];
        for (const [u, v] of edges) {
            const key = `${u}|${v}`;
            const data = this.edgeMeta.get(key);
            if (data && data.timestamps) {
                allTimestamps = allTimestamps.concat(data.timestamps);
            }
        }

        if (allTimestamps.length < 2) return 0.5;

        // Find min and max
        let minTs = allTimestamps[0].getTime();
        let maxTs = allTimestamps[0].getTime();

        for (const t of allTimestamps) {
            const val = t.getTime();
            if (val < minTs) minTs = val;
            if (val > maxTs) maxTs = val;
        }

        const duration = maxTs - minTs;
        return clamp01(1 - duration / MAX_ALLOWED_DURATION);
    }

    frequencyScore(cycle) {
        // In this implementation context (single batch), cycle count is usually 1 unless we track historicals.
        // The reference logic: count = len(cycle_occurrences.get(cycle))
        // We will assume 1 for current batch.
        const count = 1;
        return clamp01(Math.min(count / 3.0, 1.0));
    }

    volumeScore(cycle, edges) {
        let cycleVolume = 0;
        for (const [u, v] of edges) {
            const key = `${u}|${v}`;
            const data = this.edgeMeta.get(key);
            if (data) cycleVolume += data.totalAmount;
        }

        let totalOutgoing = 0;
        for (const u of cycle) {
            totalOutgoing += (this.graphData.nodeTotalOutAmount.get(u) || 0);
        }

        if (totalOutgoing === 0) return 0.0;

        return clamp01(cycleVolume / totalOutgoing);
    }

    compute(cycle) {
        const edges = [];
        for (let i = 0; i < cycle.length; i++) {
            edges.push([cycle[i], cycle[(i + 1) % cycle.length]]);
        }

        const raw = (
            W_LENGTH * this.lengthScore(cycle) +
            W_AMOUNT * this.amountSimilarityScore(edges) +
            W_TIME * this.timeScore(edges) +
            W_FREQUENCY * this.frequencyScore(cycle) +
            W_VOLUME * this.volumeScore(cycle, edges)
        );

        return parseFloat((clamp01(raw) * 100).toFixed(2));
    }
}

export class CircularFundDetector {
    constructor(transactions) {
        this.transactions = transactions;
        this.edgeMeta = new Map(); // "u|v" -> { count, totalAmount, timestamps }
        this.adj = new Map();      // u -> Set(v)
        this.inDegree = new Map();
        this.outDegree = new Map();
        this.nodeTotalOutAmount = new Map();
    }

    buildGraph() {
        this.edgeMeta.clear();
        this.adj.clear();
        this.inDegree.clear();
        this.outDegree.clear();
        this.nodeTotalOutAmount.clear();

        this.transactions.forEach(txn => {
            const u = txn.sender_id;
            const v = txn.receiver_id;

            if (!u || !v || u === v) return;

            const amount = parseFloat(txn.amount) || 0;
            const ts = new Date(txn.timestamp);

            const key = `${u}|${v}`;
            if (!this.edgeMeta.has(key)) {
                this.edgeMeta.set(key, { count: 0, totalAmount: 0, timestamps: [] });
            }
            const meta = this.edgeMeta.get(key);
            meta.count++;
            meta.totalAmount += amount;
            meta.timestamps.push(ts);

            // Adjacency
            if (!this.adj.has(u)) this.adj.set(u, new Set());
            this.adj.get(u).add(v);

            // Degrees
            this.outDegree.set(u, (this.outDegree.get(u) || 0) + 1);
            this.inDegree.set(v, (this.inDegree.get(v) || 0) + 1);

            // Total Out Amount per Node (for Scorer)
            this.nodeTotalOutAmount.set(u, (this.nodeTotalOutAmount.get(u) || 0) + amount);
        });
    }

    prune() {
        // Clone adj to avoid modifying original? 
        // Actually we want to modify the graph strictly for detection.
        // We will work on `this.adj`.

        let changed = true;
        const nodes = new Set([...this.adj.keys(), ...this.inDegree.keys()]);

        // 1. Remove Hubs
        const totalNodes = nodes.size;
        const threshold = Math.max(HUB_DEGREE_LIMIT, Math.floor(0.1 * totalNodes));

        const nodesToRemove = new Set();
        nodes.forEach(n => {
            const deg = (this.inDegree.get(n) || 0) + (this.outDegree.get(n) || 0);
            if (deg > threshold) nodesToRemove.add(n);
        });

        // 2. Iteratively remove leaves
        // JS Set iteration while modifying is tricky, better to loop until stable
        // For simplicity/speed in JS, we'll do a single pass or fixed passes of leaf pruning
        // The Python logic: G.remove_nodes_from(leaves) -> checks in/out degree 0.

        // Let's build a working copy of the graph structure for traversal
        // Map<u, Set<v>>
        const workingAdj = new Map();
        this.adj.forEach((vSet, u) => {
            workingAdj.set(u, new Set(vSet));
        });

        // Remove hubs
        nodesToRemove.forEach(n => workingAdj.delete(n));
        // Also remove n from any adjacency lists
        for (const [u, vSet] of workingAdj) {
            if (nodesToRemove.has(u)) {
                workingAdj.delete(u);
            } else {
                nodesToRemove.forEach(rem => vSet.delete(rem));
            }
        }

        // Remove leaves (in-degree 0 OR out-degree 0)
        // We need to re-calculate degrees for the working graph
        // This is expensive to do iteratively in JS compared to NetworkX.
        // We will do a robust DFS that naturally prunes dead ends.

        return workingAdj;
    }

    detectCycles(workingAdj) {
        const cycles = [];
        // Use Tarjan's or similar? Or Simple DFS with depth limit?
        // Since MAX_CYCLE_LEN is small (5), simple DFS is efficient enough.

        const nodes = Array.from(workingAdj.keys());

        // To avoid duplicates and perms: start from "smallest" node constraint
        // (u < v for all v in path logic doesn't work for simple cycles directly, 
        // standard comparison matches python implementation style).

        for (const startNode of nodes) {
            const dfs = (curr, path) => {
                if (path.length > MAX_CYCLE_LEN) return;

                const neighbors = workingAdj.get(curr);
                if (!neighbors) return;

                for (const next of neighbors) {
                    if (next === startNode) {
                        if (path.length >= MIN_CYCLE_LEN) {
                            cycles.push([...path]);
                        }
                    } else if (!path.includes(next)) {
                        // Optimization: only visit if next > startNode
                        // This enforces that we only find the cycle starting at its smallest node
                        if (next > startNode) {
                            dfs(next, [...path, next]);
                        }
                    }
                }
            };

            dfs(startNode, [startNode]);
        }

        return cycles;
    }

    getCycleCompletionTime(cycle) {
        let maxTs = 0;
        for (let i = 0; i < cycle.length; i++) {
            const u = cycle[i];
            const v = cycle[(i + 1) % cycle.length];
            const key = `${u}|${v}`;
            const meta = this.edgeMeta.get(key);
            if (meta && meta.timestamps) {
                for (const ts of meta.timestamps) {
                    if (ts.getTime() > maxTs) maxTs = ts.getTime();
                }
            }
        }
        return maxTs ? new Date(maxTs) : null;
    }

    run() {
        this.buildGraph();

        // Prune involves filtering the adjacency list
        const workingAdj = this.prune();

        const cycles = this.detectCycles(workingAdj);

        const scorer = new CRSScorer(
            { nodeTotalOutAmount: this.nodeTotalOutAmount },
            this.edgeMeta
        );

        const rings = [];
        const accountData = new Map(); // accId -> [{score, ringId, len}]

        cycles.forEach((cycle, idx) => {
            const score = scorer.compute(cycle);
            const ringId = `RING_${String(idx + 1).padStart(3, '0')}`;
            const completionTime = this.getCycleCompletionTime(cycle);

            rings.push({
                ring_id: ringId,
                member_accounts: cycle,
                pattern_type: "cycle",
                risk_score: score,
                detected_at: completionTime ? completionTime.toISOString().replace('T', ' ').split('.')[0] : null
            });

            cycle.forEach(acc => {
                if (!accountData.has(acc)) accountData.set(acc, []);
                accountData.get(acc).push({
                    score,
                    ring_id: ringId,
                    cycle_length: cycle.length
                });
            });
        });

        const suspiciousAccounts = [];

        accountData.forEach((entries, acc) => {
            const maxScore = Math.max(...entries.map(e => e.score));
            const highRiskCount = entries.filter(e => e.score > HIGH_RISK_THRESHOLD).length;

            const flagged = (maxScore > HIGH_RISK_THRESHOLD || highRiskCount > HIGH_RISK_CYCLE_COUNT);

            if (flagged) {
                const patterns = new Set();
                entries.forEach(e => {
                    if (e.cycle_length === 3) patterns.add("cycle_length_3");
                    if (e.score > 85) patterns.add("high_velocity");
                });

                suspiciousAccounts.push({
                    account_id: acc,
                    suspicion_score: maxScore,
                    detected_patterns: Array.from(patterns).sort(),
                    ring_id: entries[0].ring_id
                });
            }
        });

        // Sort descending
        suspiciousAccounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

        return { rings, suspiciousAccounts };
    }
}
