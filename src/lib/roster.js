const EXTRA_FLEX_POSITIONS = {
    TE: ['FLX', 'SFLX'],
    RB: ['FLX', 'SFLX'],
    WR: ['FLX', 'SFLX'],
    QB: ['SFLX'],
};

/**
 * Returns the list of fantasy positions a player is eligible for, including
 * the flex/superflex slots implied by their real position. Never mutates the
 * player object or its existing `fantasy_positions` array - a new array is
 * always returned, so calling this repeatedly for the same player never
 * grows the underlying list (this was a real bug in the original mutating
 * implementation, which pushed directly onto the shared array).
 */
export function getEligiblePositions(player) {
    const extras = EXTRA_FLEX_POSITIONS[player.position] || [];
    return [...player.fantasy_positions, ...extras.filter((pos) => !player.fantasy_positions.includes(pos))];
}

/**
 * Pure version of `App.addToRoster`. Finds the first open roster slot that
 * matches one of the player's eligible positions, and returns new
 * `rosterPositions`/`playerInfo` objects reflecting the assignment. Does not
 * mutate any of its inputs.
 *
 * Deliberately does not write the computed eligible positions back onto the
 * player. `getEligiblePositions` derives them from the player's real position
 * every time and is idempotent, so caching them bought nothing - and nothing
 * ever read the extended list. It was one of the last two writes into the
 * shared player database.
 */
export function addPlayerToRoster({ player, rosterPositions, playerInfo }) {
    const eligiblePositions = getEligiblePositions(player);
    let newRosterPositions = rosterPositions;
    let rosterText = player.roster_text;

    for (let i = 0; i < eligiblePositions.length; i++) {
        const positionIndex = rosterPositions.indexOf(eligiblePositions[i]);
        if (positionIndex !== -1) {
            rosterText = eligiblePositions[i];
            newRosterPositions = [...rosterPositions];
            newRosterPositions.splice(positionIndex, 1, player.player_id);
            break;
        }
    }

    return {
        rosterPositions: newRosterPositions,
        playerInfo: {
            ...playerInfo,
            [player.player_id]: { ...player, roster_text: rosterText },
        },
    };
}

/**
 * Pure version of `App.removeFromLineup`. Restores the roster slot at index
 * `i` to the player's remembered `roster_text`. Whether the player is still
 * "in the lineup" is derived from `rosterPositions` (see `buildLineupSet` in
 * `rosterInfo.js`), not tracked on the player object, so this only needs to
 * update `rosterPositions`. Does not mutate any of its inputs.
 */
export function removePlayerFromLineup({ id, i, rosterPositions, playerInfo }) {
    const newRosterPositions = [...rosterPositions];
    newRosterPositions.splice(i, 1, playerInfo[id].roster_text);

    return {
        rosterPositions: newRosterPositions,
        playerInfo,
    };
}
