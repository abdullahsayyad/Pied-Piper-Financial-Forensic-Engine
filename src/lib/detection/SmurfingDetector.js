export class SmurfingDetector {
    constructor(transactions) {
        this.transactions = transactions || [];
        this.fanIn = new Map();
        this.fanOut = new Map();
    }

    parseTimestamp(ts) {
        if (!ts) return null;
        const d = new Date(ts);
        return isNaN(d.getTime()) ? null : d;
    }

    buildMaps() {
        for (const txn of this.transactions) {
            if (!txn.sender_id || !txn.receiver_id || !txn.timestamp) continue;

            const sender = txn.sender_id.trim();
            const receiver = txn.receiver_id.trim();
            const amount = parseFloat(txn.amount);
            const ts = this.parseTimestamp(txn.timestamp);

            if (!ts || isNaN(amount)) continue;

            if (!this.fanIn.has(receiver)) this.fanIn.set(receiver, []);
            this.fanIn.get(receiver).push({ sender, ts, amount });

            if (!this.fanOut.has(sender)) this.fanOut.set(sender, []);
            this.fanOut.get(sender).push({ receiver, ts, amount });
        }
    }

    detectFanIn(rings, suspiciousAccounts) {
        const MIN_THRESHOLD = 10;
        const EXCLUSION_THRESHOLD = 20;
        const TIME_WINDOW_MS = 72 * 60 * 60 * 1000;

        for (const [receiver, txns] of this.fanIn.entries()) {

            // 🚫 Exclude high volume nodes
            if (txns.length >= EXCLUSION_THRESHOLD) continue;

            if (txns.length < MIN_THRESHOLD) continue;

            txns.sort((a, b) => a.ts - b.ts);

            let left = 0;
            const uniqueSenders = new Map();

            for (let right = 0; right < txns.length; right++) {

                const currentTxn = txns[right];
                uniqueSenders.set(
                    currentTxn.sender,
                    (uniqueSenders.get(currentTxn.sender) || 0) + 1
                );

                while (currentTxn.ts - txns[left].ts > TIME_WINDOW_MS) {
                    const leftTxn = txns[left];
                    const count = uniqueSenders.get(leftTxn.sender);
                    if (count === 1) uniqueSenders.delete(leftTxn.sender);
                    else uniqueSenders.set(leftTxn.sender, count - 1);
                    left++;
                }

                if (uniqueSenders.size >= MIN_THRESHOLD) {

                    const riskScore = 80 + uniqueSenders.size; // simple score

                    const ringId = `SMURF_IN_${receiver}`;

                    rings.push({
                        ring_id: ringId,
                        member_accounts: [receiver, ...uniqueSenders.keys()],
                        pattern_type: "fan_in",
                        risk_score: Math.min(100, riskScore),
                        detected_at: currentTxn.ts.toISOString(),
                        last_transaction_time: currentTxn.ts.getTime()
                    });

                    const finalScore = Math.min(100, riskScore);

                    // 1. Add Receiver (Center)
                    suspiciousAccounts.push({
                        account_id: receiver,
                        suspicion_score: finalScore,
                        detected_patterns: ["fan_in"],
                        ring_id: ringId
                    });

                    // 2. Add All Senders (Leaves)
                    for (const senderId of uniqueSenders.keys()) {
                        suspiciousAccounts.push({
                            account_id: senderId,
                            suspicion_score: finalScore,
                            detected_patterns: ["fan_in_member"],
                            ring_id: ringId
                        });
                    }

                    break;
                }
            }
        }
    }

    detectFanOut(rings, suspiciousAccounts) {
        const MIN_THRESHOLD = 10;
        const EXCLUSION_THRESHOLD = 20;
        const TIME_WINDOW_MS = 72 * 60 * 60 * 1000;

        for (const [sender, txns] of this.fanOut.entries()) {

            // 🚫 Exclude high volume nodes
            if (txns.length >= EXCLUSION_THRESHOLD) continue;

            if (txns.length < MIN_THRESHOLD) continue;

            txns.sort((a, b) => a.ts - b.ts);

            let left = 0;
            const uniqueReceivers = new Map();

            for (let right = 0; right < txns.length; right++) {

                const currentTxn = txns[right];
                uniqueReceivers.set(
                    currentTxn.receiver,
                    (uniqueReceivers.get(currentTxn.receiver) || 0) + 1
                );

                while (currentTxn.ts - txns[left].ts > TIME_WINDOW_MS) {
                    const leftTxn = txns[left];
                    const count = uniqueReceivers.get(leftTxn.receiver);
                    if (count === 1) uniqueReceivers.delete(leftTxn.receiver);
                    else uniqueReceivers.set(leftTxn.receiver, count - 1);
                    left++;
                }

                if (uniqueReceivers.size >= MIN_THRESHOLD) {

                    const riskScore = 80 + uniqueReceivers.size;

                    const ringId = `SMURF_OUT_${sender}`;

                    rings.push({
                        ring_id: ringId,
                        member_accounts: [sender, ...uniqueReceivers.keys()],
                        pattern_type: "fan_out",
                        risk_score: Math.min(100, riskScore),
                        detected_at: currentTxn.ts.toISOString(),
                        last_transaction_time: currentTxn.ts.getTime()
                    });

                    const finalScore = Math.min(100, riskScore);

                    // 1. Add Sender (Center)
                    suspiciousAccounts.push({
                        account_id: sender,
                        suspicion_score: finalScore,
                        detected_patterns: ["fan_out"],
                        ring_id: ringId
                    });

                    // 2. Add All Receivers (Leaves)
                    for (const receiverId of uniqueReceivers.keys()) {
                        suspiciousAccounts.push({
                            account_id: receiverId,
                            suspicion_score: finalScore,
                            detected_patterns: ["fan_out_member"],
                            ring_id: ringId
                        });
                    }

                    break;
                }
            }
        }
    }

    run() {
        const rings = [];
        const suspiciousAccounts = [];

        this.buildMaps();
        this.detectFanIn(rings, suspiciousAccounts);
        this.detectFanOut(rings, suspiciousAccounts);

        return { rings, suspiciousAccounts };
    }
}
