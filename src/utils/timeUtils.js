/**
 * timeUtils.js — Date Parsing Utilities
 *
 * Safe timestamp parsing and temporal window checks
 * for future detection algorithm use.
 */

/**
 * Parse a timestamp string into a Date object.
 * Handles "YYYY-MM-DD HH:MM:SS" format (SRS required format).
 * @param {string} str - Timestamp string
 * @returns {Date|null} - Parsed Date or null if invalid
 */
export function parseTimestamp(str) {
    if (!str || typeof str !== 'string') return null;

    const trimmed = str.trim();

    // Try direct parse (handles ISO and common formats)
    const date = new Date(trimmed.replace(' ', 'T'));
    if (!isNaN(date.getTime())) return date;

    // Fallback: try native parse
    const fallback = new Date(trimmed);
    if (!isNaN(fallback.getTime())) return fallback;

    return null;
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
