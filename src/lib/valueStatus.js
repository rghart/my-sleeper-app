// Turning /api/v1/status into the one sentence the app-wide banner says.
//
// Exists because KeepTradeCut's refresh failed for 16 days (2026-09-08 to
// 24) and every value on screen quietly aged with it. Pure: the hook fetches,
// this decides what, if anything, is worth interrupting someone for.

const HOUR = 60 * 60 * 1000;

const ageLabel = (asOf, now) => {
    const hours = Math.floor((now - Date.parse(asOf)) / HOUR);
    if (hours < 48) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
};

const dayLabel = (asOf) =>
    new Date(asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The banner's message, or null when there is nothing to say. `now` is
 * epoch millis.
 */
export function valueWarning(status, now = Date.now()) {
    if (!status) return null;

    const lines = [];

    for (const source of status.sources ?? []) {
        if (!source.stale) continue;
        lines.push(
            source.asOf
                ? `${source.name} values haven't updated in ${ageLabel(source.asOf, now)} (last on ${dayLabel(source.asOf)}).`
                : `No ${source.name} values are available.`,
        );
    }

    const unread = status.unrecognizedPicks;
    if (unread?.count > 0) {
        const example = unread.examples?.[0] ? ` (for example “${unread.examples[0]}”)` : '';
        lines.push(
            `KeepTradeCut lists ${unread.count} draft picks the app can't read yet${example}, so their values are missing.`,
        );
    }

    if (lines.length === 0) return null;
    return `${lines.join(' ')} Power rankings, Movers and trade values may be out of date.`;
}
