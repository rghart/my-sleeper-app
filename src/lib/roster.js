const EXTRA_FLEX_POSITIONS = {
    TE: ['FLX', 'SFLX'],
    RB: ['FLX', 'SFLX'],
    WR: ['FLX', 'SFLX'],
    QB: ['SFLX'],
};

// The real positions eligiblePositionsForSlot can ever return, in the order
// the design doc lists them - QB before RB/WR/TE, since SFLX is the only slot
// that admits a QB. Kept as one list rather than duplicated in each flex
// slot's expected output, so the two can't drift.
const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE'];

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
 * The real positions eligible to fill a given slot label - the inverse of
 * EXTRA_FLEX_POSITIONS above. `FLX` -> `['RB', 'WR', 'TE']`, `SFLX` ->
 * `['QB', 'RB', 'WR', 'TE']`, and any other slot label (this app's slot
 * labels are already the short forms - `FLX`/`SFLX`, never `FLEX`/`SFLEX` -
 * see toRosterSlots) admits only itself: a `TE` slot admits TE, a `QB` slot
 * admits QB.
 *
 * Derived from EXTRA_FLEX_POSITIONS rather than hand-maintained as a second
 * table, so the two can never independently drift - see roster.test.js's
 * agreement test, which checks both directions.
 */
export function eligiblePositionsForSlot(slotLabel) {
    const flexEligible = POSITION_ORDER.filter((position) =>
        (EXTRA_FLEX_POSITIONS[position] || []).includes(slotLabel),
    );
    return flexEligible.length > 0 ? flexEligible : [slotLabel];
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
 *
 * An optional `slotIndex` bypasses the "first eligible open slot" search
 * entirely and fills (or replaces the occupant of) that exact index instead -
 * what a slot-scoped sheet needs, since the user already chose which slot by
 * tapping it. Unlike the search above, this never checks eligibility: the
 * candidate list shown for a tapped slot is already filtered to it, and a
 * currently-filled slot is meant to have its occupant replaced regardless.
 */
export function addPlayerToRoster({ player, rosterSlots, slotIndex }) {
    if (slotIndex !== undefined && slotIndex !== null) {
        if (!rosterSlots[slotIndex]) {
            return { rosterSlots };
        }
        const newSlots = [...rosterSlots];
        newSlots[slotIndex] = { ...newSlots[slotIndex], playerId: player.player_id };
        return { rosterSlots: newSlots };
    }

    const eligiblePositions = getEligiblePositions(player);

    for (const eligiblePosition of eligiblePositions) {
        const openIndex = rosterSlots.findIndex((slot) => slot.playerId === null && slot.label === eligiblePosition);
        if (openIndex !== -1) {
            const newSlots = [...rosterSlots];
            newSlots[openIndex] = { ...newSlots[openIndex], playerId: player.player_id };
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
