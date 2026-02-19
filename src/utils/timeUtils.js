/**
 * timeUtils.js — Date Parsing Utilities
 *
 * Safe timestamp parsing and temporal window checks
 * for future detection algorithm use.
 */

/**
 * Parse a timestamp string into a Date object.
 * Handles multiple formats:
 *   - "YYYY-MM-DD"
 *   - "YYYY-MM-DD HH:MM:SS"
 *   - "DD-MM-YYYY HH:MM"
 *   - "DD-MM-YYYY HH:MM:SS"
 * Does NOT use new Date(string) — strict manual parsing only.
 *
 * @param {string} str - Timestamp string
 * @returns {Date|null} - Parsed Date or null if invalid
 */
export function parseTimestamp(str) {
    if (!str || typeof str !== 'string') return null;

    const [datePart, timePart] = str.trim().split(' ');

    if (!datePart) return null;

    const datePieces = datePart.split('-').map(Number);
    if (datePieces.length !== 3 || datePieces.some(isNaN)) return null;

    let year, month, day;

    // Auto-detect: if first piece has 4 digits → YYYY-MM-DD, else DD-MM-YYYY
    if (datePart.split('-')[0].length === 4) {
        [year, month, day] = datePieces;
    } else {
        [day, month, year] = datePieces;
    }

    if (!year || !month || !day) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    let hours = 0, minutes = 0, seconds = 0;

    if (timePart) {
        const tp = timePart.split(':').map(Number);
        hours = tp[0] ?? 0;
        minutes = tp[1] ?? 0;
        seconds = tp[2] ?? 0;

        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) return null;
    }

    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if two timestamps are within a given time window.
 * @param {Date|string} ts1 - First timestamp
 * @param {Date|string} ts2 - Second timestamp
 * @param {number} hours - Window size in hours
 * @returns {boolean}
 */
export function isWithinWindow(ts1, ts2, hours) {
    const d1 = ts1 instanceof Date ? ts1 : parseTimestamp(ts1);
    const d2 = ts2 instanceof Date ? ts2 : parseTimestamp(ts2);

    if (!d1 || !d2) return false;

    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    const windowMs = hours * 60 * 60 * 1000;
    return diffMs <= windowMs;
}

/**
 * Get the min and max timestamps from a set of timestamp strings.
 * @param {string[]} timestamps - Array of timestamp strings
 * @returns {{ min: Date|null, max: Date|null, rangeMs: number }}
 */
export function getTimestampRange(timestamps) {
    let min = null;
    let max = null;

    for (const ts of timestamps) {
        const d = parseTimestamp(ts);
        if (!d) continue;

        if (!min || d < min) min = d;
        if (!max || d > max) max = d;
    }

    return {
        min,
        max,
        rangeMs: min && max ? max.getTime() - min.getTime() : 0,
    };
}

/**
 * Sort an array of objects by their timestamp field.
 * @param {object[]} items - Array of objects with a timestamp property
 * @param {string} key - Property name containing the timestamp string
 * @returns {object[]} - New sorted array (ascending)
 */
export function sortByTimestamp(items, key = 'timestamp') {
    return [...items].sort((a, b) => {
        const da = parseTimestamp(a[key]);
        const db = parseTimestamp(b[key]);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.getTime() - db.getTime();
    });
}
