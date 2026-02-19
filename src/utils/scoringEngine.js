/**
 * scoringEngine.js — Suspicion Scoring Stub (SRS §3.1.4)
 *
 * Placeholder for suspicion score computation.
 * Returns 0 for all accounts until detection algorithms are implemented.
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
    // TODO: Implement scoring logic
    // Factors to consider (SRS FR-12):
    //   - Pattern involvement (which patterns the account appears in)
    //   - Ring risk (risk score of associated rings)
    //   - Temporal proximity (how recent/concentrated the transactions are)
    //   - Transaction volume and velocity
    //   - Degree centrality (from graph.degreeMap)

    const scores = new Map();

    for (const accountId of graph.nodes) {
        scores.set(accountId, 0);
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
