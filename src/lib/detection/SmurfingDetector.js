/**
 * Smurfing Detector
 * 
 * Detects:
 * 1. Fan-in: Multiple accounts -> One aggregator (10+ senders)
 * 2. Fan-out: One aggregator -> Multiple receivers (1 sender -> 10+ receivers)
 * 3. Temporal Analysis: 72-hour window.
 */

export class SmurfingDetector {
    constructor(transactions) {
        this.transactions = transactions;
        this.fanIn = new Map(); // receiver -> [{sender, ts, amount}]
        this.fanOut = new Map(); // sender -> [{receiver, ts, amount}]
    }

    run() {
        this.transactions.forEach(txn => {
            const u = txn.sender_id;
            const v = txn.receiver_id;
            const amount = parseFloat(txn.amount);
            const ts = new Date(txn.timestamp);

            if (!this.fanIn.has(v)) this.fanIn.set(v, []);
            this.fanIn.get(v).push({ sender: u, ts, amount });

            if (!this.fanOut.has(u)) this.fanOut.set(u, []);
            this.fanOut.get(u).push({ receiver: v, ts, amount });
        });

        const suspiciousAccounts = [];
        const rings = [];
        const THRESHOLD = 10;
        const TIME_WINDOW_MS = 72 * 60 * 60 * 1000;

        // Detect Fan-In
        this.fanIn.forEach((txns, receiver) => {
            txns.sort((a, b) => a.ts - b.ts);

            for (let i = 0; i < txns.length; i++) {
                let startIdx = i;
                const windowEnd = txns[i].ts;
                const windowStart = new Date(windowEnd.getTime() - TIME_WINDOW_MS);

                // Find all txns in [windowStart, windowEnd]
                // Since we iterate i forward, we look back or we assume [start, i] is the window.
                // Let's use a sliding window approach properly.
            }

            // Simpler: iterate all windows
            let left = 0;
            const uniqueSenders = new Map(); // sender -> count in window

            for (let right = 0; right < txns.length; right++) {
                const currentTxn = txns[right];
                uniqueSenders.set(currentTxn.sender, (uniqueSenders.get(currentTxn.sender) || 0) + 1);

                while (currentTxn.ts - txns[left].ts > TIME_WINDOW_MS) {
                    const leftTxn = txns[left];
                    const count = uniqueSenders.get(leftTxn.sender);
                    if (count === 1) uniqueSenders.delete(leftTxn.sender);
                    else uniqueSenders.set(leftTxn.sender, count - 1);
                    left++;
                }

                if (uniqueSenders.size >= THRESHOLD) {
                    // Found Fan-in
                    const ringId = `SMURF_IN_${receiver}`;
                    rings.push({
                        ring_id: ringId,
                        member_accounts: [receiver, ...uniqueSenders.keys()],
                        pattern_type: "fan_in",
                        risk_score: 85.0, // High risk
                        detected_at: currentTxn.ts.toISOString().replace('T', ' ').split('.')[0]
                    });

                    suspiciousAccounts.push({
                        account_id: receiver,
                        suspicion_score: 85.0,
                        detected_patterns: ["fan_in"],
                        ring_id: ringId
                    });

                    // Avoid duplicates for same receiver? 
                    // We might want just one alert per receiver
                    return; // optimize: break outer loop for this receiver
                }
            }
        });

        // Detect Fan-Out
        this.fanOut.forEach((txns, sender) => {
            txns.sort((a, b) => a.ts - b.ts);

            let left = 0;
            const uniqueReceivers = new Map();

            for (let right = 0; right < txns.length; right++) {
                const currentTxn = txns[right];
                uniqueReceivers.set(currentTxn.receiver, (uniqueReceivers.get(currentTxn.receiver) || 0) + 1);

                while (currentTxn.ts - txns[left].ts > TIME_WINDOW_MS) {
                    const leftTxn = txns[left];
                    const count = uniqueReceivers.get(leftTxn.receiver);
                    if (count === 1) uniqueReceivers.delete(leftTxn.receiver);
                    else uniqueReceivers.set(leftTxn.receiver, count - 1);
                    left++;
                }

                if (uniqueReceivers.size >= THRESHOLD) {
                    const ringId = `SMURF_OUT_${sender}`;
                    rings.push({
                        ring_id: ringId,
                        member_accounts: [sender, ...uniqueReceivers.keys()],
                        pattern_type: "fan_out",
                        risk_score: 85.0,
                        detected_at: currentTxn.ts.toISOString().replace('T', ' ').split('.')[0]
                    });

                    suspiciousAccounts.push({
                        account_id: sender,
                        suspicion_score: 85.0,
                        detected_patterns: ["fan_out"],
                        ring_id: ringId
                    });
                    return;
                }
            }
        });

        return { rings, suspiciousAccounts };
    }
}
