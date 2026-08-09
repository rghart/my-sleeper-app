// Reading the /intel response (docs/leaguemate-intel.md §3e).
//
// Pure, like `availability.js` next door, and for the same reason: every
// figure here is an aggregate over a sample that ranges from 1 observed draft
// to 30, and the recurring failure in this feature has never been the maths -
// it is the sentence next to the number. What may be said about a manager is
// decided here, where it can be tested, rather than inside a template.

/**
 * How many corpus picks a manager's tendencies actually rest on.
 *
 * `positionLean` is a breakdown of every pick of theirs the crawl has seen, so
 * its total is the sample behind the shares. `draftsComplete` is the sample
 * behind anything measured per draft - the two are not interchangeable, and
 * conflating them is how "38% WR" off four picks gets presented as a lean.
 */
export function observedPicks(manager) {
    return (manager?.tendencies?.positionLean || []).reduce((total, entry) => total + (entry.picks || 0), 0);
}

/**
 * What may honestly be said about one manager, given how much of their
 * drafting has been seen.
 *
 * Two independent gates, because the two figures rest on different samples:
 * `reachVsAdp` is an average per draft and is gated on `draftsComplete`;
 * the positional shares are proportions of picks and are gated on the pick
 * count. A manager can clear one and not the other - 12 drafts with four
 * picks in them is a real shape in this data, not a contrived one.
 */
export function managerSignal(manager, { minDrafts, minPicks }) {
    const draftsComplete = manager?.draftsComplete || 0;
    const picks = observedPicks(manager);
    const reach = manager?.tendencies?.reachVsAdp;

    const quotesReach = draftsComplete >= minDrafts && reach != null;
    const quotesShares = picks >= minPicks;

    // `none` is its own state rather than the bottom of a scale: with nothing
    // observed there is no number to hedge, only an absence to state plainly.
    const kind = draftsComplete === 0 ? 'none' : quotesReach && quotesShares ? 'measured' : 'thin';

    return { kind, draftsComplete, picks, quotesReach, quotesShares };
}

// Below half a pick the sign is noise, so it gets a name of its own instead of
// a direction the data does not support. Stated as fact, never as advice -
// "reaches early" is neither good nor bad without knowing who you are asking
// for, same rule the survival number follows in §3g.
const CHALKY = 0.5;

/**
 * `reachVsAdp` in words. Negative means they take players before the league's
 * own ADP; positive means they let them slide.
 */
export function reachPhrase(reach) {
    if (reach == null) return null;
    if (Math.abs(reach) < CHALKY) return 'drafts to ADP';

    const picks = Math.abs(reach).toFixed(1);
    return reach < 0 ? `reaches ${picks} picks early` : `waits ${picks} picks`;
}

/**
 * Row-width version of `reachPhrase`. The long form truncates the meta line
 * next to it at 375px - measured against the real league, where the widest
 * ("reaches 0.9 picks early") pushed "31 drafts seen" to "31 drafts se…" on
 * the very first row. Same lesson the prototype learned about the ADP gap:
 * the one novel signal on the row is the thing that must always fit.
 */
export function reachPhraseShort(reach) {
    if (reach == null) return null;
    if (Math.abs(reach) < CHALKY) return 'on ADP';

    const picks = Math.abs(reach).toFixed(1);
    return reach < 0 ? `${picks} early` : `${picks} late`;
}

/**
 * Whether a manager's "crushes" actually show repetition.
 *
 * The figures are self-carrying - "9 of 31" states its own denominator - but
 * the heading over them is a claim in its own right, and "players they keep
 * taking" is false over a list where every entry is "1 of 1". Caught against
 * real data on a one-draft manager: the counts were honest and the sentence
 * above them was not, which is this feature's oldest failure mode.
 */
export function crushesShowPattern(crushes) {
    return (crushes || []).some((crush) => (crush.times || 0) >= 2);
}

/**
 * `n thing` / `n things`, so a one-league manager does not read "1 leagues".
 * Trivial, and it was wrong on four of thirteen rows against real data.
 */
export function countLabel(count, noun) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Managers most-observed first — the ones the corpus can actually say
 * something about, rather than alphabetical order that buries them.
 *
 * Copies before sorting: the argument is the fetch response, and sorting it in
 * place would reorder the caller's own state behind its back.
 */
export function sortManagers(managers) {
    return [...(managers || [])].sort(
        (a, b) =>
            (b.draftsComplete || 0) - (a.draftsComplete || 0) ||
            (a.displayName || '').localeCompare(b.displayName || ''),
    );
}

// ---------------------------------------------------------------------
// Manager activity (docs/leaguemate-intel.md §6 step 6)
// ---------------------------------------------------------------------

// What each transaction type is called on screen. `commissioner` is here
// because a live crawl found 143 of them in 13,610 - it is not in the plan's
// scope and would otherwise have rendered as a raw API string.
const TYPE_LABELS = {
    trade: 'Trade',
    waiver: 'Waiver',
    free_agent: 'Free agent',
    commissioner: 'Commissioner',
};

/**
 * The human label for a transaction type, falling back to the raw value
 * rather than hiding a type nobody anticipated. The API is somebody else's
 * and its vocabulary can grow; an unknown type should look odd on screen,
 * not vanish from a list that claims to be complete.
 */
export function transactionLabel(type) {
    return TYPE_LABELS[type] || type || 'Unknown';
}

/**
 * Whether a transaction actually happened.
 *
 * 11% of real transactions come back `failed` (1,497 of 13,610), so this is
 * not a rare edge. They are kept deliberately - a failed waiver claim is a
 * revealed preference nobody else in that league can see - but a list that
 * mixes them in unlabelled is claiming things happened that did not.
 */
export function didHappen(transaction) {
    return transaction?.status !== 'failed';
}

/**
 * The players this manager added and dropped, resolved to names through the
 * `players` map the endpoint sends alongside.
 *
 * **Filtered to their own roster.** `adds`/`drops` are league-wide: a trade
 * adds a player to one roster and drops him from another, so rendering both
 * sides showed the same player as added *and* dropped. Caught against live
 * data, where a real trade read "+Marvin Harrison −Marvin Harrison".
 * `rosterId` is which roster is theirs; when it is null (a league whose
 * roster map could not be fetched) the move is shown unsided rather than
 * hidden, because a partial answer beats a blank one.
 *
 * Falls back to the raw id rather than dropping a player the lookup misses -
 * a transaction that silently lists two of its three players is worse than
 * one showing an id.
 */
export function movedPlayers(transaction, players = {}) {
    const rosterId = transaction?.rosterId;

    const mine = (moves) =>
        Object.entries(moves || {})
            .filter(([, roster]) => rosterId == null || roster === rosterId)
            .map(([id]) => id);

    const named = (ids) => ids.map((id) => ({ id, name: players[id]?.name || id, position: players[id]?.position }));

    return {
        adds: named(mine(transaction?.adds)),
        drops: named(mine(transaction?.drops)),
    };
}

/**
 * How much of a manager's activity is actually visible, as a sentence.
 *
 * `null` when there is nothing to qualify. Otherwise it always states both
 * numbers: "5 trades" across 42 leagues and across 4 are different claims,
 * and a live run once reported "33 of 175" for a manager who is in 42 -
 * a denominator describing nobody.
 */
export function coverageLabel(coverage) {
    if (!coverage || !coverage.leaguesKnown) return null;

    return `${coverage.leaguesSeen} of ${countLabel(coverage.leaguesKnown, 'league')}`;
}
