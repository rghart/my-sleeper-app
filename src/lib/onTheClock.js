/**
 * Who the board says is picking right now, and how far away your own next pick
 * is. Pure reads over the built draft - no React, no fetching - so the clock
 * card can be a dumb renderer and this can be tested without mounting it.
 *
 * "On the clock" is derived from the board rather than from any field Sleeper
 * sends, because the board is the thing the app already keeps in sync: the
 * first pick in draft order with no `player_id` on it is the one being waited
 * on. That stays true for a manually-entered pick as much as a synced one.
 */

/** The rosters' owner display name for a pick, or null when unattributed. */
function ownerName(pick, rosterData) {
    if (!pick.owner_id) {
        return null;
    }
    return rosterData.find((roster) => roster.roster_id === pick.owner_id)?.manager_display_name ?? null;
}

/**
 * `{ round, pick }` for the first unmade pick in draft order, or null when the
 * board is full (or absent). Rounds are walked in the order the board holds
 * them, and picks within a round likewise - `buildDraftRounds` already
 * reverses even rounds for a snake draft, so draft order *is* array order here
 * and this must not re-sort it.
 */
export function nextUnpickedPick(builtDraft) {
    for (const round of builtDraft || []) {
        for (const pick of round.picks) {
            if (!pick.player_id) {
                return { round, pick };
            }
        }
    }
    return null;
}

/**
 * How many picks are made before yours: `0` when you are on the clock now,
 * `null` when you have no pick left on the board (or there is nothing to
 * count, e.g. no display name resolved yet). Counted from the pick currently
 * on the clock, so it is "you in n", not "n picks into the draft".
 */
export function picksUntilMine({ builtDraft, rosterData, myDisplayName }) {
    if (!myDisplayName || !rosterData) {
        return null;
    }
    let distance = 0;
    let started = false;
    for (const round of builtDraft || []) {
        for (const pick of round.picks) {
            if (!started && pick.player_id) {
                continue;
            }
            started = true;
            if (ownerName(pick, rosterData) === myDisplayName) {
                return distance;
            }
            distance += 1;
        }
    }
    return null;
}
