/**
 * dataNormalizer.js
 * 
 * Normalizes incoming CSV data to match the strict SRS schema required by validation.js.
 * Handles:
 * - Header case sensitivity and variations (Sender_ID -> sender_id)
 * - Timestamp formatting (padding single digit hours/days)
 * - String trimming
 * - Amount parsing
 */

export function normalizeData(rows, headers) {
    // 1. Identify Column Mapping
    const mapping = {
        transaction_id: findHeader(headers, ['transaction_id', 'txn_id', 'id']),
        sender_id: findHeader(headers, ['sender_id', 'sender', 'source']),
        receiver_id: findHeader(headers, ['receiver_id', 'receiver', 'target']),
        amount: findHeader(headers, ['amount', 'value', 'vol']),
        timestamp: findHeader(headers, ['timestamp', 'time', 'date', 'datetime'])
    };

    // 2. Normalize Rows
    const normalizedRows = rows.map((row, index) => {
        // Skip empty rows if mostly empty
        if (Object.keys(row).length < 2) return null;

        const txId = (row[mapping.transaction_id] || `txn_${index}_${Math.random().toString(36).substr(2, 5)}`).trim();
        const sender = (row[mapping.sender_id] || '').trim();
        const receiver = (row[mapping.receiver_id] || '').trim();
        const amtStr = (row[mapping.amount] || '0').trim();
        const rawTs = (row[mapping.timestamp] || '').trim();

        if (!sender || !receiver) return null; // Minimal validity check before strict validation

        // Normalize Timestamp
        // Goals: "YYYY-MM-DD HH:mm:ss" (padded)
        const normalizedTs = normalizeTimestamp(rawTs);

        return {
            transaction_id: txId,
            sender_id: sender,
            receiver_id: receiver,
            amount: parseFloat(amtStr),
            timestamp: normalizedTs // Will be validated by validation.js
        };
    }).filter(r => r !== null);

    // 3. Return strictly required headers
    return {
        headers: ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'],
        rows: normalizedRows
    };
}

function findHeader(headers, candidates) {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    for (const c of candidates) {
        const idx = lowerHeaders.indexOf(c);
        if (idx !== -1) return headers[idx];
    }
    return candidates[0]; // Fallback, though likely to fail validation if not found
}

function normalizeTimestamp(raw) {
    if (!raw) return '';

    // Handle "2024-01-21 3:01:00" -> "2024-01-21 03:01:00"
    // Also handle ISO "2024-01-21T03:01:00.000Z" -> "2024-01-21 03:01:00"

    try {
        // Simple regex check for "YYYY-MM-DD H:m:s"
        const parts = raw.split(/[- :T]/); // Split by - : space T
        if (parts.length >= 3) {
            const y = parts[0];
            const m = parts[1].padStart(2, '0');
            const d = parts[2].padStart(2, '0');

            let h = '00';
            let min = '00';
            let s = '00';

            if (parts.length >= 4) h = parts[3].padStart(2, '0');
            if (parts.length >= 5) min = parts[4].padStart(2, '0');
            if (parts.length >= 6) s = parts[5].split('.')[0].padStart(2, '0'); // remove ms if present

            return `${y}-${m}-${d} ${h}:${min}:${s}`;
        }

        // Fallback to Date object parsing
        const date = new Date(raw);
        if (!isNaN(date.getTime())) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const h = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            const s = String(date.getSeconds()).padStart(2, '0');
            return `${y}-${m}-${d} ${h}:${min}:${s}`;
        }
    } catch (e) {
        // Validation will catch this
        return raw;
    }

    return raw;
}
