// Turning the market's value list into a rank list.
//
// This is the one way into the rank list that does no guessing. Every other
// route starts with text a human pasted and has to work out which of nine
// thousand players each line meant - see lib/rankParse.js and lib/rankMatch.js
// for how much machinery that takes. The values arrive keyed by Sleeper id,
// so there is nothing to parse and nothing that can be matched to the wrong
// person.

/**
 * The league shape to ask the market about, read off Sleeper's league object.
 *
 * Values are priced against a format and the difference is not a rounding: in
 * superflex the market's best player is a quarterback, in single-QB he is a
 * running back. Asking without saying which league you are in gets you an
 * answer about somebody else's.
 *
 * Only the fields the league actually answers are included, and the API falls
 * back field by field - so a league object missing its scoring settings costs
 * the PPR and nothing else, rather than the whole request.
 */
export function leagueMarketSettings(league) {
    if (!league) return null;

    const settings = {};

    // `settings.type` is Sleeper's own: 0 redraft, 1 keeper, 2 dynasty. A
    // keeper league is not a dynasty one and is closer to redraft for pricing,
    // so only 2 counts.
    if (league.settings?.type != null) settings.dynasty = league.settings.type === 2;

    if (league.total_rosters) settings.numTeams = league.total_rosters;

    // Two-QB and superflex are different leagues, not two names for one. A
    // two-QB league has two dedicated QB slots and you *must* start two; a
    // superflex slot takes any position, so you *may* start a second. Both
    // raise quarterback value, which is why they price alike and why the old
    // reading here got away with treating them as the same thing.
    //
    // How many quarterbacks a lineup can hold is the sum, not either one: a
    // league with two QB slots and a superflex can start three, and the
    // previous version reported two because it stopped at the superflex.
    const positions = league.roster_positions;
    if (Array.isArray(positions)) {
        const quarterbacks = positions.filter((slot) => slot === 'QB').length;
        const superflex = positions.includes('SUPER_FLEX');
        settings.numQbs = Math.max(quarterbacks + (superflex ? 1 : 0), 1);
        // Display only, and deliberately not sent: FantasyCalc prices on a
        // quarterback count and has no notion of *which* format produced it,
        // so this exists so the card can name the league correctly rather
        // than to change what is asked for. A true two-QB league forces the
        // second starter and so wants a quarterback slightly more than a
        // superflex league does - that is a distinction the provider's
        // parameter cannot carry, and inventing a number for it would be
        // making one up.
        settings.superflex = superflex;
    }

    // Reception scoring is the one scoring field the market is priced on.
    // `0` is a real answer (standard scoring) and must not be read as absent.
    if (league.scoring_settings?.rec != null) settings.ppr = league.scoring_settings.rec;

    return Object.keys(settings).length > 0 ? settings : null;
}

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
export function settingsLabel(settings, league) {
    if (!settings) return null;
    const { format, numQbs, numTeams, ppr } = settings;
    return [
        format === 'dynasty' ? 'Dynasty' : format,
        quarterbackTerm(numQbs, league),
        `${numTeams}-team`,
        ppr === 1 ? 'PPR' : ppr === 0.5 ? 'half-PPR' : `${ppr} PPR`,
    ]
        .filter(Boolean)
        .join(' · ');
}

/**
 * What to call the quarterback format.
 *
 * The response cannot answer this. It carries a quarterback *count*, and
 * both a superflex league and a genuine two-QB league arrive as 2 - so
 * labelling every 2 "superflex" told anyone in a two-QB league their list was
 * priced for a format they are not in. The league object knows the
 * difference; the response never will.
 *
 * Falls back to the count when the league is unknown, which reads as `2QB`.
 * That is a claim about what the values are priced on rather than about a
 * league nobody has described, and is the honest thing to say with only the
 * response to hand.
 */
function quarterbackTerm(numQbs, league) {
    if (league?.superflex) return 'superflex';
    return `${numQbs}QB`;
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
