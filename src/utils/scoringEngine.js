/**
 * scoringEngine.js — Suspicion Scoring (SRS §3.1.4)
 *
 * Uses suspicion scores from the Python backend when available.
 * Falls back to 0 for all accounts if no backend results are present.
 *
 * SRS: FR-11, FR-12
 * - suspicion_score: Float 0–100
 * - Must reflect: pattern involvement, ring risk, temporal proximity
 */

/**
 * Compute suspicion scores for all accounts based on detection results.
 *
 * @param {object} graph - Graph from buildGraph()
 * @param {object} detections - Detection results from runAllDetections()
 * @returns {Map<string, number>} - accountId → suspicion score (0–100)
 */
export function computeSuspicionScores(graph, detections) {
    const scores = new Map();

    // Initialize all accounts to 0
    for (const accountId of graph.nodes) {
        scores.set(accountId, 0);
    }

    // Apply backend scores if available
    const suspiciousAccounts = detections?.suspiciousAccounts || [];
    for (const acc of suspiciousAccounts) {
        if (acc.account_id && typeof acc.suspicion_score === 'number') {
            scores.set(acc.account_id, acc.suspicion_score);
        }
    }

    // Apply ring membership scores for accounts not explicitly scored
    // (ensures all ring members get at least the ring's risk score)
    const allRings = detections?.allRings || [];
    for (const ring of allRings) {
        const ringScore = ring.risk_score || 0;
        for (const memberId of (ring.member_accounts || [])) {
            const existing = scores.get(memberId) || 0;
            if (ringScore > existing) {
                scores.set(memberId, ringScore);
            }
        }
    }

    return scores;
}

/**
 * Get suspicious accounts sorted by descending score.
 * SRS: FR-11 — sorted descending in JSON output
 *
 * @param {Map<string, number>} scores - Account suspicion scores
 * @param {number} threshold - Minimum score to be considered suspicious (default: 0)
 * @returns {Array<{ account_id: string, suspicion_score: number }>}
 */
export function getSuspiciousAccounts(scores, threshold = 0) {
    const accounts = [];

    for (const [accountId, score] of scores) {
        if (score > threshold) {
            accounts.push({ account_id: accountId, suspicion_score: score });
        }
    }

    // Sort descending by suspicion_score
    accounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

    return accounts;
}
