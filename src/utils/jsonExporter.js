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
    // 1. Build suspicious_accounts list
    const suspiciousAccounts = [];

    // Use the comprehensive list from detection engine if available, otherwise build from scores
    if (detections && detections.suspiciousAccounts) {
        // detectionEngine's run() returns the exact format we need for suspiciousAccounts
        // We just need to ensure it's populated
        detections.suspiciousAccounts.forEach(acc => {
            suspiciousAccounts.push({
                account_id: acc.account_id,
                suspicion_score: acc.suspicion_score,
                detected_patterns: acc.detected_patterns,
                ring_id: acc.ring_id
            });
        });
    }

    // 2. Build fraud_rings list
    const fraud_rings = [];
    if (detections && detections.allRings) {
        detections.allRings.forEach(ring => {
            fraud_rings.push({
                ring_id: ring.ring_id,
                member_accounts: ring.member_accounts,
                pattern_type: ring.pattern_type,
                risk_score: ring.risk_score
            });
        });
    }

    // 3. Build summary
    const summary = {
        total_accounts_analyzed: graph ? graph.accountCount : 0,
        suspicious_accounts_flagged: suspiciousAccounts.length,
        fraud_rings_detected: fraud_rings.length,
        processing_time_seconds: parseFloat(processingTimeSeconds.toFixed(1))
    };

    return {
        suspicious_accounts: suspiciousAccounts,
        fraud_rings: fraud_rings,
        summary: summary
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
