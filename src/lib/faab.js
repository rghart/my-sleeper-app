// Reading the /faab response.
//
// Pure, like `availability.js` and `dynastyValues.js` next door, and for the
// same reason: what may be said about a number is decided here, where it can
// be tested, rather than inside a template. This feature's recurring failure
// has never been the maths — it is the sentence next to the number.
//
// These are prices that were *paid*, in leagues your leaguemates are in. No
// public tool answers "what does he actually cost in FAAB", which is exactly
// why the claim has to be kept inside what the sample supports.

/** The response's per-player prices, or `{}` on a failed or empty fetch. */
export function pricesByPlayerId(response) {
    const players = response?.players;
    if (!players || typeof players !== 'object') return {};
    return players;
}

// Five winning claims is where a median stops being an anecdote. Measured on
// the corpus: 516 players have a price at all, 261 have three or more, 175
// have five or more — so this is a real band, not a threshold that empties
// the feature.
const FULL = 5;

/**
 * How much can honestly be said about what a player costs.
 *
 * Mirrors `managerSample`/`ownershipSample` in availability.js: a `kind` that
 * decides which sentence is allowed, plus the figures that sentence needs.
 * The renderer picks a branch; it never decides what is sayable.
 *
 * `median`, `low` and `high` are percentages of each paying league's own
 * budget — the API normalises them, because fewer than half of these leagues
 * use a budget of 100 and a raw bid is not comparable to another one.
 */
export function faabSample(entry) {
    if (!entry || !entry.claims) return { kind: 'none' };

    const { claims, leagues, median, low, high, failed } = entry;

    // One claim is not a market. Name the price that was actually paid rather
    // than dressing a single observation as a median — the same call
    // `managerSample` makes for a single pick.
    if (claims === 1) return { kind: 'single', claims, leagues, price: median, failed };

    // Enough to say a number, not enough to call it typical.
    if (claims < FULL) return { kind: 'thin', claims, leagues, median, low, high, failed };

    return { kind: 'full', claims, leagues, median, low, high, failed };
}

/** `12.5` -> `"12.5%"`, `0` -> `"0%"`, and a whole number loses its `.0`. */
export function pct(value) {
    if (value == null) return null;
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/**
 * The headline, in words, for each sample kind.
 *
 * Deliberately not one string with conditionals: the whole point of the kinds
 * is that a thin sample gets a *different sentence*, not the same sentence
 * with a smaller number in it.
 */
export function faabHeadline(sample) {
    switch (sample.kind) {
        case 'single':
            return `Went for ${pct(sample.price)} of budget, once`;
        case 'thin':
            return `Went for ${pct(sample.median)} of budget`;
        case 'full':
            return `Typically ${pct(sample.median)} of budget`;
        default:
            return null;
    }
}

/**
 * The denominator, always shown beside the headline.
 *
 * Leagues, not just claims: ten claims in one league is a much weaker read
 * than ten across ten, and only the pair says which one you have.
 */
export function faabSampleText(sample) {
    if (sample.kind === 'none') return null;

    const claims = `${sample.claims} ${sample.claims === 1 ? 'claim' : 'claims'}`;
    const leagues = `${sample.leagues} ${sample.leagues === 1 ? 'league' : 'leagues'}`;
    return `${claims} in ${leagues}`;
}

/**
 * The spread, when there is one.
 *
 * Null for a single claim (no spread exists) and when low and high agree —
 * "0% to 0%" reads as a measurement rather than as the one price it is.
 */
export function faabRangeText(sample) {
    if (sample.kind === 'none' || sample.kind === 'single') return null;
    if (sample.low == null || sample.high == null) return null;
    if (sample.low === sample.high) return null;
    return `${pct(sample.low)} to ${pct(sample.high)}`;
}

/**
 * Bids that bought nothing, phrased without a cause.
 *
 * Sleeper does not say *why* a claim failed, so "outbid" and "invalid roster
 * move" are indistinguishable from here. The count is still worth showing —
 * a player with fifteen failed claims is contested — but it must not be
 * called losing bids.
 */
export function faabFailedText(sample) {
    if (!sample.failed) return null;
    return `${sample.failed} more ${sample.failed === 1 ? 'claim' : 'claims'} did not go through`;
}

/**
 * What window these prices come from, as a sentence.
 *
 * Never optional. Every bid in the corpus was made outside the 2026 season,
 * which is a different market from the in-season one where most FAAB gets
 * spent, and a price rendered without saying so is overclaiming.
 */
export function faabWindowText(response) {
    const window = response?.window;
    if (!window?.from || !window?.to) return null;

    const format = (iso) => {
        const [year, month, day] = iso.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
        });
    };

    const from = format(window.from);
    const to = format(window.to);
    if (!from || !to) return null;

    return from === to ? from : `${from} – ${to}`;
}
