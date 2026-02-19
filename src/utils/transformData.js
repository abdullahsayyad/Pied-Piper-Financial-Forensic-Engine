/**
 * transformCsvToElements
 * Converts parsed CSV rows into Cytoscape.js elements with enriched data.
 */
export function transformCsvToElements(rows) {
    const nodeMap = new Map();
    const edges = [];

    for (const row of rows) {
        // Robust property access (case-insensitive, trimmed)
        const getProp = (key) => {
            return row[key] || row[key.toLowerCase()] || row[key.toUpperCase()] ||
                row[Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase())];
        };

        const sender = (getProp('sender_id') || getProp('Sender_ID'))?.trim();
        const receiver = (getProp('receiver_id') || getProp('Receiver_ID'))?.trim();
        const amountStr = getProp('amount') || getProp('Amount');
        const amount = parseFloat(amountStr) || 0;
        const txId = (getProp('transaction_id') || getProp('Transaction_ID'))?.trim() || `tx_${Math.random().toString(36).slice(2, 8)}`;
        const rawTs = (getProp('timestamp') || getProp('Timestamp') || getProp('Time'))?.trim();
        let ts = '';
        if (rawTs) {
            // Check if it's already ISO
            if (rawTs.includes('T') && rawTs.endsWith('Z')) {
                ts = rawTs;
            } else {
                const d = new Date(rawTs);
                if (!isNaN(d.getTime())) {
                    ts = d.toISOString();
                } else {
                    ts = rawTs; // Fallback
                }
            }
        }

        if (!sender || !receiver) continue;

        // Track sender
        if (!nodeMap.has(sender)) {
            nodeMap.set(sender, { totalSent: 0, totalReceived: 0, txCount: 0, outCount: 0, inCount: 0 });
        }
        const sData = nodeMap.get(sender);
        sData.totalSent += amount;
        sData.txCount += 1;
        sData.outCount += 1;

        // Track receiver
        if (!nodeMap.has(receiver)) {
            nodeMap.set(receiver, { totalSent: 0, totalReceived: 0, txCount: 0, outCount: 0, inCount: 0 });
        }
        const rData = nodeMap.get(receiver);
        rData.totalReceived += amount;
        rData.txCount += 1;
        rData.inCount += 1;

        // Edge
        edges.push({
            data: {
                id: txId,
                source: sender,
                target: receiver,
                amount,
                timestamp: ts,
                active: false,
            },
        });
    }

    // Build nodes
    const nodes = [];
    for (const [id, stats] of nodeMap) {
        nodes.push({
            data: {
                id,
                label: id,
                suspicion: 0,
                ringId: null,
                ringColor: null,
                totalSent: stats.totalSent,
                totalReceived: stats.totalReceived,
                txCount: stats.txCount,
                inCount: stats.inCount,
                outCount: stats.outCount,
            },
        });
    }

    return { nodes, edges, elements: [...nodes, ...edges] };
}

/**
 * computeStats — Derives stats from parsed CSV rows + live suspicion data.
 */
export function computeStats(rows, suspicionMap = null) {
    const accounts = new Set();
    let totalVolume = 0;

    for (const row of rows) {
        if (row.sender_id) accounts.add(row.sender_id.trim());
        if (row.receiver_id) accounts.add(row.receiver_id.trim());
        totalVolume += parseFloat(row.amount) || 0;
    }

    let highRiskCount = 0;
    if (suspicionMap) {
        for (const [, score] of suspicionMap) {
            if (score > 70) highRiskCount++;
        }
    }

    return {
        transactionCount: rows.length,
        uniqueAccounts: accounts.size,
        totalVolume,
        highRiskCount,
    };
}

/**
 * Detect behavioral patterns on a node.
 */
export function detectPatterns(nodeId, edges) {
    const sent = [];
    const received = [];

    for (const e of edges) {
        if (e.data.source === nodeId) sent.push(e.data);
        if (e.data.target === nodeId) received.push(e.data);
    }

    const patterns = [];

    // High velocity: many transactions
    if (sent.length + received.length >= 5) {
        patterns.push('High Velocity');
    }

    // Round-tripping: sends to X and receives from X
    const sentTo = new Set(sent.map((e) => e.target));
    const receivedFrom = new Set(received.map((e) => e.source));
    const roundTrip = [...sentTo].filter((t) => receivedFrom.has(t));
    if (roundTrip.length > 0) {
        patterns.push('Round-Tripping');
    }

    // Fan-out: sends to 3+ distinct accounts
    if (sentTo.size >= 3) {
        patterns.push('Fan-Out');
    }

    // Fan-in: receives from 3+ distinct accounts
    if (receivedFrom.size >= 3) {
        patterns.push('Fan-In');
    }

    // Large transactions
    const maxAmount = Math.max(...sent.map((e) => e.amount), ...received.map((e) => e.amount), 0);
    if (maxAmount >= 1000) {
        patterns.push('Large Transfers');
    }

    return patterns;
}
