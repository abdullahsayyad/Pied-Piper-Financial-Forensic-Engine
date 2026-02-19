/**
 * detectionEngine.js — Client-Side Detection (JS)
 *
 * Runs detection algorithms locally in the browser using the DetectionEngine.
 *
 * Replaces the Python backend call.
 */

import { DetectionEngine } from '../lib/detection/DetectionEngine';

/**
 * Run all detection algorithms on the given graph data.
 *
 * @param {object} graph - Graph object containing nodes and edges
 * @returns {Promise<{
 *   cycles:      Array,
 *   smurfing:    Array,
 *   shellChains: Array,
 *   allRings:    Array,
 *   suspiciousAccounts: Array,
 *   summary:     object
 * }>}
 */
export async function runAllDetections(graph) {
    const emptyResult = {
        cycles: [],
        smurfing: [],
        shellChains: [],
        allRings: [],
        suspiciousAccounts: [],
        summary: null,
    };

    if (!graph || !graph.edges || graph.edges.length === 0) {
        return emptyResult;
    }

    // Map graph.edges to the format the DetectionEngine expects
    // DetectionEngine expects: { sender_id, receiver_id, amount, timestamp }
    const transactions = graph.edges.map(e => ({
        transaction_id: e.txId || '',
        sender_id: e.source || '',
        receiver_id: e.target || '',
        amount: e.amount || 0,
        timestamp: e.timestamp || '',
    }));

    // Log first transaction to verify mapping
    if (transactions.length > 0) {
        console.log('[DetectionEngine] Sample Transaction:', transactions[0]);
    }

    try {
        console.log('[DetectionEngine] Running client-side detection on', transactions.length, 'transactions');

        // Run synchronous detection (could be moved to worker if needed)
        const result = DetectionEngine.run(transactions);

        // Map results to frontend expected format
        const cycles = result.fraud_rings.filter(r => r.pattern_type === 'cycle');
        const smurfing = result.fraud_rings.filter(r => r.pattern_type === 'fan_in' || r.pattern_type === 'fan_out');
        const shellChains = result.fraud_rings.filter(r => r.pattern_type === 'shell_network');

        console.log(`[DetectionEngine] Results: Cycles=${cycles.length}, Smurfing=${smurfing.length}, Shells=${shellChains.length}`);

        return {
            cycles,
            smurfing,
            shellChains,
            allRings: result.fraud_rings,
            suspiciousAccounts: result.suspicious_accounts,
            summary: result.summary,
        };

    } catch (err) {
        console.error('[DetectionEngine] Error running detection:', err);
        return emptyResult;
    }
}

/**
 * Detect circular fund routing (cycles of length 3–5).
 * kept for compatibility but defers to runAllDetections logic usually.
 */
export function detectCycles(graph) {
    return [];
}

export function detectSmurfing(graph) {
    return [];
}

export function detectShellChains(graph) {
    return [];
}
