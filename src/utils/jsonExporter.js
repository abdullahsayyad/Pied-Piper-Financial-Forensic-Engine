/**
 * jsonExporter.js — SRS-Exact JSON Output Builder (SRS §3.1.6)
 *
 * Generates the downloadable JSON report in the exact schema
 * required by the RIFT 2026 evaluation.
 *
 * SRS: FR-18
 */

/**
 * Build the JSON report object matching the exact SRS schema.
 *
 * @param {object} params
 * @param {object} params.graph - Graph from buildGraph()
 * @param {object} params.detections - Detection results from runAllDetections()
 * @param {Map<string, number>} params.scores - Suspicion scores from computeSuspicionScores()
 * @param {number} params.processingTimeSeconds - Processing time in seconds
 * @returns {object} - SRS-exact JSON structure
 */
export function buildJsonReport({ graph, detections, scores, processingTimeSeconds }) {
    // Build suspicious_accounts array (SRS FR-18)
    const suspiciousAccounts = [];

    if (scores) {
        for (const [accountId, score] of scores) {
            if (score > 0) {
                // Find which patterns this account is involved in
                const detectedPatterns = [];
                const ringId = null;

                // Search through detection results for this account
                if (detections) {
                    for (const ring of detections.allRings || []) {
                        if (ring.member_accounts?.includes(accountId)) {
                            detectedPatterns.push(ring.pattern_type);
                            // Use first ring found
                            if (!ringId) {
                                // ringId is set from first match
                            }
                        }
                    }
                }

                suspiciousAccounts.push({
                    account_id: accountId,
                    suspicion_score: Math.round(score * 10) / 10,
                    detected_patterns: detectedPatterns,
                    ring_id: ringId,
                });
            }
        }
    }

    // Sort descending by suspicion_score (SRS FR-11)
    suspiciousAccounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

    // Build fraud_rings array (SRS FR-18)
    const fraudRings = [];
    if (detections) {
        for (const ring of detections.allRings || []) {
            fraudRings.push({
                ring_id: ring.ring_id,
                member_accounts: ring.member_accounts || [],
                pattern_type: ring.pattern_type || 'unknown',
                risk_score: Math.round((ring.risk_score || 0) * 10) / 10,
            });
        }
    }

    // Build summary (SRS FR-18)
    const summary = {
        total_accounts_analyzed: graph?.accountCount || 0,
        suspicious_accounts_flagged: suspiciousAccounts.length,
        fraud_rings_detected: fraudRings.length,
        processing_time_seconds: Math.round(processingTimeSeconds * 10) / 10,
    };

    return {
        suspicious_accounts: suspiciousAccounts,
        fraud_rings: fraudRings,
        summary,
    };
}

/**
 * Download the JSON report as a file.
 *
 * @param {object} report - JSON report from buildJsonReport()
 * @param {string} [filename] - Optional filename override
 */
export function downloadJsonReport(report, filename) {
    const name = filename || `fraud_detection_report_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}
