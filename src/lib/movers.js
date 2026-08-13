// Ranking the market's movers.
//
// Pure, like `dynastyValues.js` next door. The whole point of
// `player_value_history` was to make this question answerable — a buy-low and
// a sell-high are both claims about a price changing — and this is the module
// that decides which changes are worth putting in front of someone.

/**
 * The two honest ways to ask "who moved", and they are genuinely different
 * questions rather than a preference.
 *
 * Measured against live data on 2026-08-13, over a 30-day window:
 *
 *   * By **percent**, the top movers are deep bench — the two biggest were
 *     +641% and +433%, at overall ranks 395 and 401. Median value of the top
 *     20 was 1,433 against an overall median of 2,154. That is not noise to
 *     be filtered out: a backup tripling in value is exactly the waiver-wire
 *     news you want. But it does crowd out everything else.
 *   * By **points**, the same list surfaces players who were already valuable
 *     — rank 89 gaining 607 is a real shift in what your roster is worth, and
 *     it is invisible on a percent list at 16%.
 *
 * So both are offered rather than one being picked and a value floor hidden
 * inside. A floor would be this module deciding which of the two questions
 * the user meant.
 */
export const SORT_BASES = ['percent', 'points'];

/**
 * Movers for one direction, most-moved first.
 *
 * `direction` is `'up'` or `'down'`. Entries with no reading are dropped
 * rather than sorted as zero: `change` is `null` when there was nothing to
 * compare against, which is not the same as flat, and treating it as 0 would
 * bury real flat players under players we simply cannot see.
 *
 * A genuinely flat player is excluded from both lists too — he has not moved,
 * so he is not a mover, and including him would pad the tail of whichever
 * list is shorter.
 */
export function movers(values, { direction = 'up', basis = 'percent', limit } = {}) {
    const key = basis === 'points' ? 'change' : 'changePct';

    const ranked = (values || [])
        .filter((entry) => {
            const moved = entry?.[key];
            if (moved == null || moved === 0) return false;
            return direction === 'up' ? moved > 0 : moved < 0;
        })
        // Descending by magnitude, so both directions read "biggest first"
        // rather than the fallers list starting at -1%.
        .sort((a, b) => Math.abs(b[key]) - Math.abs(a[key]));

    return limit == null ? ranked : ranked.slice(0, limit);
}

/**
 * How much of the board actually has a reading, for the sample line.
 *
 * Stated rather than implied, same rule the leaguemates view follows: a list
 * of movers over 460 priced players and one over 12 are different claims, and
 * only the header can say which this is.
 */
export function readingCoverage(values) {
    const total = (values || []).length;
    const withReading = (values || []).filter((entry) => entry?.change != null).length;

    return { total, withReading };
}
