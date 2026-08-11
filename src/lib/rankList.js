// Putting a resolved player back into the rank list.
//
// `ranking` is the list's identity: `updatePlayerId` finds the row to edit or
// delete by it, so two rows sharing one is a real bug rather than a cosmetic
// one - an edit lands on whichever came first. That is the constraint this
// file exists to hold.

/**
 * `entry` inserted so the list stays ordered by rank and no two rows share a
 * rank.
 *
 * A miss holds the rank it was going to occupy, and while nothing has been
 * deleted that rank is a genuine gap - a list that missed line 3 is numbered
 * 1, 2, 4, 5, and putting the resolved player at 3 fills it exactly. So ranks
 * are left alone wherever they are already increasing, which is what keeps the
 * *other* pending misses pointing at the right place: collapsing the list to
 * 1..n here would renumber a row into the slot a miss at rank 7 still owns.
 *
 * Deleting a row does renumber to 1..n (see `updatePlayerId`), so after a
 * delete a pending miss can land on a rank that now exists. Only then does
 * anything shift, and only the rows at or after the collision, by the least
 * amount that restores uniqueness.
 */
export function insertAtRank(entries, entry) {
    const rankOf = (item) => Number(item.ranking);
    const at = entries.findIndex((item) => rankOf(item) >= rankOf(entry));
    const placed = at === -1 ? [...entries, entry] : [...entries.slice(0, at), entry, ...entries.slice(at)];

    let previous = 0;
    return placed.map((item) => {
        const ranking = Math.max(rankOf(item), previous + 1);
        previous = ranking;
        return ranking === rankOf(item) ? item : { ...item, ranking };
    });
}

/**
 * The rank-list row for a player the user picked by hand.
 *
 * Scored 0.000 because they chose it: the score is the matcher's confidence,
 * and a human pointing at a name is the one case where there is nothing to be
 * unconfident about. PlayerInfoItem reads any score above 0 as a low-
 * confidence match and outlines the row in warning colour, so anything else
 * here would flag a row the user had just fixed.
 */
export function resolvedEntry({ playerId, ranking, searchString }) {
    return {
        match_results: [[playerId, '0.000']],
        ranking,
        search_string: searchString,
    };
}
