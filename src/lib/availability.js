// Reading the /availability response (docs/leaguemate-intel.md §3e).
//
// Everything here is pure and takes the response apart; nothing fetches and
// nothing renders. That split is deliberate: every bug this feature has
// produced, on both sides of the wire, has been a number-or-sentence bug
// rather than a layout one, so the rules that decide which number and which
// sentence live somewhere they can be tested directly.

/**
 * Which pick the list should answer against by default.
 *
 * §3g gap 1b: this used to be "the first pick at or after the current one
 * that I own", which resolves to the pick you are *making* the moment you are
 * on the clock - nothing between, every player 100%, the feature blank at the
 * exact moment it is most wanted. My next pick means the next one I have not
 * used yet, so it is strictly after the current pick.
 *
 * `null` means there is no following pick of mine. That is a real state (a
 * last-round pick, or a draft I am done with) and callers must say so rather
 * than substituting a pick I do not own - which is what the prototype's
 * `?? currentPick + 1` silently did.
 */
export function defaultAnalyzedPick({ myPicks, currentPick }) {
    const following = (myPicks || []).filter((pick) => pick > currentPick);
    // Sorted here rather than trusted: the caller reads this straight off the
    // API response, and "first element of the array" and "earliest pick"
    // being the same thing is the API's promise, not this function's.
    return following.length > 0 ? Math.min(...following) : null;
}

/**
 * The odds `target` is still on the board at `pick`, or `null` where the
 * response carries no read for it.
 *
 * Null rather than 1. The prototype defaulted a missing entry to certainty,
 * which is the same class of mistake as gap 1b: a number the data does not
 * support, rendered with full confidence. `byPick` runs one pick past
 * `lastPick` (the gauntlet needs `pick + 1` for "survival after this pick"),
 * so its range is enumerated from the response and never computed here.
 */
export function survivalAt(target, pick) {
    if (pick == null) return null;
    const entry = target?.byPick?.[String(pick)];
    return entry ? entry.adjSurvival : null;
}

/**
 * The picks the selector can offer: every pick left on the board, each with
 * the manager who actually owns it. Ownership is trade-resolved by the API
 * (§3d) - two of three picks were attributed to the wrong manager when this
 * was derived from the draft order instead.
 */
export function pickOptions(board) {
    return (board || []).map(({ pick, manager, mine }) => ({ pick, manager, mine }));
}

/**
 * How much can honestly be said about one manager's history with one player.
 *
 * This is the copy-rules table in §3 Frontend, and it exists because the
 * recurring failure in this feature was never the maths - it was the sentence
 * next to the number. Three separate times the prototype quoted "took him 1x
 * in 1 drafts" as evidence, showed a 0-draft manager's league baseline as if
 * it were their own tendency, and labelled a single pick an "ADP".
 *
 * Returns a `kind` the UI switches on, carrying only the figures that kind is
 * allowed to state. `adp` is absent unless it has earned its place, so a
 * template cannot print one by reaching for a field that happens to be there.
 */
export function managerSample({ times, of, adp, picks } = {}, threshold) {
    const { minDrafts, minTimes } = threshold || {};

    // None of their drafts seen: whatever we would show is the league
    // baseline, not this manager, and presenting it as theirs is the bug.
    if (!of) return { kind: 'none', times: times || 0, of: of || 0 };

    // Never taken him. Stated as the fact it is rather than as a 0% rate,
    // with the sample size carrying how much the fact is worth.
    if (!times) return { kind: 'never', times: 0, of };

    // One pick is not an average. Name the pick that actually happened.
    if (times === 1) return { kind: 'singlePick', times, of, pick: pickNumber(picks?.[0]) };

    // Too little of their history to quote a rate at all.
    if (of < 5) return { kind: 'thin', times, of };

    // Past the signal threshold their own ADP means something. Below it the
    // count still does - the threshold gates the average, not the sample.
    if (of >= minDrafts && times >= minTimes) return { kind: 'full', times, of, adp };

    return { kind: 'countOnly', times, of };
}

// "4.9@39" - round.slot @ overall (§4e). The overall pick is the only part
// worth showing next to a name; the rest is receipts for the detail view.
function pickNumber(pickString) {
    return pickString?.split('@')[1];
}
