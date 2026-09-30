// The saved rank lists as a set: when each was saved, and which order they
// are offered in. The rows inside a list are rankList.js's concern.

/**
 * Saved lists newest first, by `saved_at` - set on every save, so a list that
 * was just updated moves to the top. Lists saved before the date was recorded
 * have none; they go last, in the order they came in (Array sort is stable).
 */
export function sortByMostRecent(lists) {
    return [...lists].sort((a, b) => (b.saved_at ?? -Infinity) - (a.saved_at ?? -Infinity));
}

/**
 * The date a list was saved, short: `Sep 28`, with the year only when it is
 * not this one (`Dec 30, 2025`). `null` for a list saved before dates were
 * recorded - it has nothing to show rather than a made-up date.
 */
export function savedDateLabel(savedAt, now = new Date()) {
    if (savedAt == null) {
        return null;
    }
    const date = new Date(savedAt);
    const options = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== now.getFullYear()) {
        options.year = 'numeric';
    }
    return date.toLocaleDateString('en-US', options);
}
