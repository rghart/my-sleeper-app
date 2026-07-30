const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago something happened, in the shortest form that still says it:
 * `just now`, `2m ago`, `3h ago`, `2d ago`. `null` in, `null` out - the caller
 * that has never synced has nothing to render rather than a "never" to explain.
 *
 * Coarse on purpose. This labels the last completed sync on a card that only
 * re-renders when something else changes, so a seconds-accurate figure would be
 * a number that is quietly wrong most of the time; a minute-resolution one is
 * right for a whole minute.
 */
export function agoLabel(timestamp, now = Date.now()) {
    if (timestamp == null) {
        return null;
    }
    const elapsed = now - timestamp;
    // A clock that ran backwards (a device time change mid-draft) reads as
    // "just now" rather than as a negative age.
    if (elapsed < MINUTE) {
        return 'just now';
    }
    if (elapsed < HOUR) {
        return `${Math.floor(elapsed / MINUTE)}m ago`;
    }
    if (elapsed < DAY) {
        return `${Math.floor(elapsed / HOUR)}h ago`;
    }
    return `${Math.floor(elapsed / DAY)}d ago`;
}
