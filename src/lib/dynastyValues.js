// Reading the /dynasty-values response.
//
// Pure, like `availability.js` and `leagueIntel.js` next door, and for the
// same reason: what may be said about a number is decided here, where it can
// be tested, rather than inside a template.
//
// Distinct from `marketValues.js`, and the two must not be merged. That one
// turns FantasyCalc's list *into* a rank list — an ordering the user adopts.
// This one *decorates* rows that already exist and never reorders anything:
// the rank list is the user's own and stays theirs, exactly as the survival
// chips do (docs/leaguemate-intel.md §3g).

/**
 * Whether this league is priced off KeepTradeCut's superflex values.
 *
 * KTC publishes exactly two variants, 1QB and superflex, so the continuous
 * `numQbs` this app derives has to collapse to a boolean. Any league that can
 * start a second quarterback prices like superflex — that is the whole reason
 * the two exist as separate lists — so the split is at 2, not at "has a
 * SUPER_FLEX slot".
 *
 * That distinction is load-bearing: a true two-QB league has no superflex slot
 * at all and would fall to the 1QB list under a slot check, which is a list
 * about a different game. `leagueMarketSettings` already does the work of
 * summing slot kinds; this only reads the total.
 *
 * Defaults to superflex when the league shape is unknown, matching the API's
 * own default and the slice the rest of the app is calibrated against.
 */
export function usesSuperflexValues(leagueShape) {
    if (!leagueShape || leagueShape.numQbs == null) return true;
    return leagueShape.numQbs >= 2;
}

/**
 * The response's values keyed by Sleeper id, for O(1) lookup per row.
 *
 * A rank list is 200+ rows and the response is ~460 entries; scanning the
 * array per row would be 92,000 comparisons on every render.
 *
 * Ids are strings on the wire and strings in `playerInfo`, so nothing is
 * coerced here — a map keyed by number that is read by string silently misses
 * every row, which is the failure `PlayerValueJSON` stringifies ids to avoid.
 *
 * Returns an empty object rather than null on a failed or empty fetch, so
 * callers can look up unconditionally. Values are additive: a row with no
 * entry renders exactly as it did before this feature existed.
 */
export function valuesByPlayerId(response) {
    const values = response?.values;
    if (!Array.isArray(values)) return {};

    return values.reduce((byId, entry) => {
        if (entry?.playerId != null) byId[String(entry.playerId)] = entry;
        return byId;
    }, {});
}

/**
 * How stale the values are, as the response's own `asOf` in epoch millis.
 *
 * Same conversion `marketValues.asOfMillis` does and for the same reason: the
 * API sends an ISO string, `agoLabel` subtracts from `Date.now()`, and handing
 * the string over directly renders `NaNd ago`. That shipped once and no unit
 * test caught it — only a browser did.
 */
export function asOfMillis(response) {
    const asOf = response?.asOf;
    if (!asOf) return null;

    const millis = Date.parse(asOf);
    return Number.isNaN(millis) ? null : millis;
}

/**
 * A pick's value, for a Sleeper traded pick that knows only its season and
 * round.
 *
 * **Tier is the caller's guess and this makes it explicitly.** KTC prices
 * early/mid/late separately because they are worth substantially different
 * amounts, but which one a pick becomes depends on where its roster finishes,
 * which is not knowable in advance. `mid` is the honest default; a caller that
 * knows the standings can pass a better one.
 *
 * Returns null rather than falling back to another tier or another season: a
 * 2029 pick nobody prices should read as unpriced, not as a 2028 one.
 */
export function pickValue(response, { season, round, tier = 'mid' } = {}) {
    const picks = response?.picks;
    if (!Array.isArray(picks) || season == null || round == null) return null;

    return (
        picks.find((pick) => pick.season === Number(season) && pick.round === Number(round) && pick.tier === tier) ??
        null
    );
}
