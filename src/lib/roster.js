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
 * Builds the lineup from Sleeper's `roster_positions`: one slot per startable
 * position, bench slots dropped, labels shortened for display.
 *
 * A slot keeps its label for its whole life and tracks its occupant
 * separately. The previous shape was a single array holding *either* a label
 * or a player id at each index, so filling a slot overwrote its label - which
 * is why the label had to be remembered as `roster_text` on the player, in the
 * shared player database. Nothing needs remembering now.
 */
export function toRosterSlots(rosterPositions) {
    return rosterPositions
        .filter((pos) => pos !== 'BN')
        .map((pos) => {
            if (pos === 'SUPER_FLEX') {
                return { label: 'SFLX', playerId: null };
            } else if (pos === 'FLEX') {
                return { label: 'FLX', playerId: null };
            }
            return { label: pos, playerId: null };
        });
}

/**
 * Pure version of `App.addToRoster`. Fills the first open slot whose label is
 * one of the player's eligible positions. Returns new slots; the player
 * database is neither an input nor an output, because assigning a player to a
 * lineup slot is a fact about the slot, not about the player.
 */
export function addPlayerToRoster({ player, rosterSlots }) {
    const eligiblePositions = getEligiblePositions(player);

    for (const eligiblePosition of eligiblePositions) {
        const slotIndex = rosterSlots.findIndex((slot) => slot.playerId === null && slot.label === eligiblePosition);
        if (slotIndex !== -1) {
            const newSlots = [...rosterSlots];
            newSlots[slotIndex] = { ...newSlots[slotIndex], playerId: player.player_id };
            return { rosterSlots: newSlots };
        }
    }

    return { rosterSlots };
}

/**
 * Pure version of `App.removeFromLineup`. Empties the slot at index `i`. It
 * needs neither the player id nor the player database: the slot already knows
 * its own label, so there is nothing to look up and nothing to restore.
 */
export function removePlayerFromLineup({ i, rosterSlots }) {
    const newSlots = [...rosterSlots];
    newSlots[i] = { ...newSlots[i], playerId: null };

    return { rosterSlots: newSlots };
}
