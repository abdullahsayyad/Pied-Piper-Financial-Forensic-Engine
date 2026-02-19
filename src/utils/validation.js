/**
 * validation.js — Strict CSV Schema Validator (SRS §3.1.1)
 *
 * Enforces required columns, type validation, and safe parsing.
 * Returns sanitized rows or detailed error list.
 */

const REQUIRED_COLUMNS = [
    'transaction_id',
    'sender_id',
    'receiver_id',
    'amount',
    'timestamp',
];

const TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;

/**
 * Validate CSV headers against SRS-required schema.
 * @param {string[]} headers - Column headers from parsed CSV
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateSchema(headers) {
    const normalized = headers.map(h => h.trim().toLowerCase());
    const missing = REQUIRED_COLUMNS.filter(col => !normalized.includes(col));
    return { valid: missing.length === 0, missing };
}

/**
 * Validate and sanitize a single CSV row.
 * @param {object} row - Parsed CSV row object
 * @param {number} index - Row index (for error reporting)
 * @returns {{ valid: boolean, errors: string[], sanitized: object|null }}
 */
export function validateRow(row, index) {
    const errors = [];

    // transaction_id: must exist and be non-empty string
    const txId = row.transaction_id?.toString().trim();
    if (!txId) {
        errors.push(`Row ${index + 1}: missing or empty transaction_id`);
    }

    // sender_id: must exist and be non-empty string
    const senderId = row.sender_id?.toString().trim();
    if (!senderId) {
        errors.push(`Row ${index + 1}: missing or empty sender_id`);
    }

    // receiver_id: must exist and be non-empty string
    const receiverId = row.receiver_id?.toString().trim();
    if (!receiverId) {
        errors.push(`Row ${index + 1}: missing or empty receiver_id`);
    }

    // amount: must be valid positive float
    const amountRaw = row.amount?.toString().trim();
    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount < 0) {
        errors.push(`Row ${index + 1}: invalid amount "${amountRaw}"`);
    }

    // timestamp: must match YYYY-MM-DD HH:MM:SS format
    const timestamp = row.timestamp?.toString().trim();
    if (!timestamp) {
        errors.push(`Row ${index + 1}: missing timestamp`);
    } else if (!TIMESTAMP_REGEX.test(timestamp)) {
        // Allow flexible parsing but warn
        const parsed = new Date(timestamp);
        if (isNaN(parsed.getTime())) {
            errors.push(`Row ${index + 1}: invalid timestamp "${timestamp}"`);
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors, sanitized: null };
    }

    return {
        valid: true,
        errors: [],
        sanitized: {
            transaction_id: txId,
            sender_id: senderId,
            receiver_id: receiverId,
            amount,
            timestamp,
        },
    };
}

/**
 * Validate entire CSV dataset.
 * @param {string[]} headers - Column headers
 * @param {object[]} rows - Parsed CSV rows
 * @returns {{ valid: boolean, errors: string[], validRows: object[], invalidCount: number }}
 */
export function validateCsv(headers, rows) {
    const allErrors = [];

    // Schema check
    const schema = validateSchema(headers);
    if (!schema.valid) {
        return {
            valid: false,
            errors: [`Missing required columns: ${schema.missing.join(', ')}`],
            validRows: [],
            invalidCount: rows.length,
        };
    }

    // Row-level validation
    const validRows = [];
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const result = validateRow(rows[i], i);
        if (result.valid) {
            validRows.push(result.sanitized);
        } else {
            invalidCount++;
            // Collect first 10 errors to avoid flooding
            if (allErrors.length < 10) {
                allErrors.push(...result.errors);
            }
        }
    }

    if (invalidCount > 0 && allErrors.length >= 10) {
        allErrors.push(`...and ${invalidCount - 10} more invalid rows`);
    }

    return {
        valid: validRows.length > 0,
        errors: allErrors,
        validRows,
        invalidCount,
    };
}
