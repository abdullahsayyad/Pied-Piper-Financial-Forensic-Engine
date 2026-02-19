/**
 * graphBuilder.js — Graph Construction Layer (SRS §3.1.2)
 *
 * Builds clean graph data structures from validated transaction rows.
 * Creates adjacency lists, degree maps, and timestamp indices
 * for use by detection algorithms.
 *
 * Complexity:
 *   - Time:  O(V + E) where V = unique accounts, E = transactions
 *   - Space: O(V + E) for adjacency lists and indices
 */

import { parseTimestamp, sortByTimestamp } from './timeUtils.js';

/**
 * Build complete graph data structures from sanitized CSV rows.
 *
 * @param {object[]} rows - Validated, sanitized transaction rows
 *   Each row: { transaction_id, sender_id, receiver_id, amount, timestamp }
 *
 * @returns {{
 *   adjacencyList:   Map<string, Array<{target, amount, timestamp, txId}>>,
 *   reverseAdjacency: Map<string, Array<{source, amount, timestamp, txId}>>,
 *   degreeMap:        Map<string, {inDegree, outDegree, totalDegree}>,
 *   nodes:           string[],
 *   edges:           Array<{txId, source, target, amount, timestamp, parsedTime}>,
 *   timestampIndex:  Array<{txId, source, target, amount, timestamp, parsedTime}>,
 *   accountCount:    number,
 *   edgeCount:       number
 * }}
 */
export function buildGraph(rows) {
    const adjacencyList = new Map();    // source → [{target, amount, timestamp, txId}]
    const reverseAdjacency = new Map(); // target → [{source, amount, timestamp, txId}]
    const degreeMap = new Map();        // accountId → {inDegree, outDegree, totalDegree}
    const accountSet = new Set();
    const edges = [];

    for (const row of rows) {
        const source = row.sender_id;
        const target = row.receiver_id;
        const amount = row.amount;
        const timestamp = row.timestamp;
        const txId = row.transaction_id;
        const parsedTime = parseTimestamp(timestamp);

        // Track accounts
        accountSet.add(source);
        accountSet.add(target);

        // Edge record
        const edgeRecord = { txId, source, target, amount, timestamp, parsedTime };
        edges.push(edgeRecord);

        // Forward adjacency (source → targets)
        if (!adjacencyList.has(source)) adjacencyList.set(source, []);
        adjacencyList.get(source).push({ target, amount, timestamp, txId });

        // Reverse adjacency (target → sources)
        if (!reverseAdjacency.has(target)) reverseAdjacency.set(target, []);
        reverseAdjacency.get(target).push({ source, amount, timestamp, txId });

        // Degree tracking
        if (!degreeMap.has(source)) degreeMap.set(source, { inDegree: 0, outDegree: 0, totalDegree: 0 });
        if (!degreeMap.has(target)) degreeMap.set(target, { inDegree: 0, outDegree: 0, totalDegree: 0 });

        const srcDeg = degreeMap.get(source);
        srcDeg.outDegree += 1;
        srcDeg.totalDegree += 1;

        const tgtDeg = degreeMap.get(target);
        tgtDeg.inDegree += 1;
        tgtDeg.totalDegree += 1;
    }

    // Ensure all accounts appear in adjacency lists (even isolated receivers)
    for (const account of accountSet) {
        if (!adjacencyList.has(account)) adjacencyList.set(account, []);
        if (!reverseAdjacency.has(account)) reverseAdjacency.set(account, []);
    }

    const nodes = Array.from(accountSet);

    // Timestamp-sorted edge index for temporal queries
    const timestampIndex = sortByTimestamp(edges, 'timestamp');

    return {
        adjacencyList,
        reverseAdjacency,
        degreeMap,
        nodes,
        edges,
        timestampIndex,
        accountCount: nodes.length,
        edgeCount: edges.length,
    };
}

/**
 * Get the set of unique neighbors for a given account.
 * @param {Map} adjacencyList - Forward adjacency list
 * @param {Map} reverseAdjacency - Reverse adjacency list
 * @param {string} accountId
 * @returns {{ outNeighbors: Set<string>, inNeighbors: Set<string>, allNeighbors: Set<string> }}
 */
export function getNeighbors(adjacencyList, reverseAdjacency, accountId) {
    const outEdges = adjacencyList.get(accountId) || [];
    const inEdges = reverseAdjacency.get(accountId) || [];

    const outNeighbors = new Set(outEdges.map(e => e.target));
    const inNeighbors = new Set(inEdges.map(e => e.source));
    const allNeighbors = new Set([...outNeighbors, ...inNeighbors]);

    return { outNeighbors, inNeighbors, allNeighbors };
}
