// Turning the market's value list into a rank list.
//
// This is the one way into the rank list that does no guessing. Every other
// route starts with text a human pasted and has to work out which of nine
// thousand players each line meant - see lib/rankParse.js and lib/rankMatch.js
// for how much machinery that takes. The values arrive keyed by Sleeper id,
// so there is nothing to parse and nothing that can be matched to the wrong
// person.

/**
 * The response's `asOf` as epoch milliseconds, or null.
 *
 * The API sends an ISO string and `agoLabel` subtracts from `Date.now()`, so
 * handing the string straight over renders `NaNd ago` - which is what it did,
 * and what no test caught until it was looked at in a browser. Converting here
 * rather than at the call site puts it somewhere it can be tested.
 */
export function asOfMillis(asOf) {
    if (!asOf) return null;
    const millis = Date.parse(asOf);
    return Number.isNaN(millis) ? null : millis;
}

/** How the settings read in a sentence, so nothing has to claim more. */
export function settingsLabel(settings) {
    if (!settings) return null;
    const { format, numQbs, numTeams, ppr } = settings;
    return [
        format === 'dynasty' ? 'Dynasty' : format,
        numQbs >= 2 ? 'superflex' : `${numQbs}QB`,
        `${numTeams}-team`,
        ppr === 1 ? 'PPR' : ppr === 0.5 ? 'half-PPR' : `${ppr} PPR`,
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * The value list as rank-list entries, in the order the market ranks them.
 *
 * Scored `0.000` for the same reason a hand-picked player is: the score is
 * the *matcher's* confidence, and nothing here was matched. Anything above 0
 * renders as a low-confidence match and would outline every row in the list
 * in warning colour.
 *
 * Ranks are the position in this list, not `overallRank` from the response.
 * The two agree while every player is known, and diverge the moment one is
 * not - a rank list numbered 1, 2, 4 because the player at 3 is missing from
 * the pool is showing the user a gap they cannot act on and did not create.
 *
 * A value the player database has never heard of is dropped. In practice the
 * feed and the pool agree (checked against the deployed pair: 0 of 439
 * unjoinable), but the pool is refreshed by a different nightly job than the
 * values are, so a player can exist in one and not yet the other.
 */
export function toRankList(values, playerInfo) {
    if (!values?.length) return [];

    return values
        .filter((entry) => playerInfo?.[entry.playerId])
        .map((entry, index) => ({
            match_results: [[entry.playerId, '0.000']],
            ranking: index + 1,
            search_string: playerInfo[entry.playerId].full_name ?? entry.playerId,
        }));
}
