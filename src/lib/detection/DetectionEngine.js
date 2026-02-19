/**
 * Detection Engine
 * Aggregates all detection logic.
 */

import { CircularFundDetector } from './CircularFundDetector.js';
import { SmurfingDetector } from './SmurfingDetector.js';
import { ShellNetworkDetector } from './ShellNetworkDetector.js';

export class DetectionEngine {
    static run(transactions) {
        const start = performance.now();

        const circularDetector = new CircularFundDetector(transactions);
        const circularRes = circularDetector.run();

        const smurfingDetector = new SmurfingDetector(transactions);
        const smurfingRes = smurfingDetector.run();

        const shellDetector = new ShellNetworkDetector(transactions);
        const shellRes = shellDetector.run();

        // Aggregate
        let allSuspicious = [
            ...circularRes.suspiciousAccounts,
            ...smurfingRes.suspiciousAccounts,
            ...shellRes.suspiciousAccounts
        ];

        // Merge by account_id
        const accMap = new Map();
        allSuspicious.forEach(item => {
            if (!accMap.has(item.account_id)) {
                accMap.set(item.account_id, {
                    account_id: item.account_id,
                    suspicion_score: 0,
                    detected_patterns: new Set(),
                    ring_id: item.ring_id
                });
            }
            const acc = accMap.get(item.account_id);
            acc.suspicion_score = Math.max(acc.suspicion_score, item.suspicion_score);
            item.detected_patterns.forEach(p => acc.detected_patterns.add(p));
        });

        const suspicious_accounts = Array.from(accMap.values()).map(acc => ({
            ...acc,
            detected_patterns: Array.from(acc.detected_patterns).sort()
        })).sort((a, b) => b.suspicion_score - a.suspicion_score);

        const fraud_rings = [
            ...circularRes.rings,
            ...smurfingRes.rings,
            ...shellRes.rings
        ];

        const accountsAnalyzed = new Set();
        transactions.forEach(t => {
            accountsAnalyzed.add(t.sender_id);
            accountsAnalyzed.add(t.receiver_id);
        });

        const processing_time_seconds = (performance.now() - start) / 1000;

        return {
            suspicious_accounts,
            fraud_rings,
            summary: {
                total_accounts_analyzed: accountsAnalyzed.size,
                suspicious_accounts_flagged: suspicious_accounts.length,
                fraud_rings_detected: fraud_rings.length,
                processing_time_seconds: parseFloat(processing_time_seconds.toFixed(3))
            }
        };
    }
}
