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

// Sleeper statuses that rule a player out of this week's lineup however well
// he ranks. Questionable is deliberately absent: most Q players play, and the
// user can still bench one by hand.
const CANNOT_START = new Set(['Out', 'IR', 'PUP', 'Sus']);

/**
 * Whether a slot admits a player, read from the slot's side - the same rule
 * BestAvailable's eligibility filter uses, so a player the sheet offers for a
 * slot is one auto-set would consider for it too.
 */
export const slotAdmits = (slotLabel, player) =>
    eligiblePositionsForSlot(slotLabel).some((pos) => (player.fantasy_positions || []).includes(pos));

/**
 * Fills every open slot with the best-ranked eligible candidate, leaving
 * filled slots alone - so a lineup half set from a QB-only list keeps its QBs
 * when the rest is auto-set from a flex list.
 *
 * `candidates` is players in rank order, best first. Anyone Out, on IR or PUP,
 * or suspended is passed over for the next one down. Slots are filled
 * narrowest first (a QB or TE slot before FLX, FLX before SFLX), each taking
 * the best candidate left that it admits: filling SFLX first would spend the
 * top QB there, and filling FLX first could take the only TE the TE slot has.
 * A player already in a slot is never used twice.
 */
export function autoFillLineup({ rosterSlots, candidates }) {
    const used = new Set(rosterSlots.map((slot) => slot.playerId).filter(Boolean));
    const startable = candidates.filter((player) => !CANNOT_START.has(player.injury_status));
    const newSlots = [...rosterSlots];
    const width = (index) => eligiblePositionsForSlot(rosterSlots[index].label).length;
    // Array sort is stable, so slots of the same width keep lineup order.
    const openIndexes = rosterSlots
        .map((slot, index) => (slot.playerId ? null : index))
        .filter((index) => index !== null)
        .sort((a, b) => width(a) - width(b));

    for (const index of openIndexes) {
        const pick = startable.find(
            (player) => !used.has(player.player_id) && slotAdmits(rosterSlots[index].label, player),
        );
        if (pick) {
            used.add(pick.player_id);
            newSlots[index] = { ...newSlots[index], playerId: pick.player_id };
        }
    }

    return { rosterSlots: newSlots };
}

/**
 * Where a sheet that just filled `fromIndex` moves on to: the next open slot
 * in lineup order (wrapping round to the top) that at least one of
 * `candidates` - the players the sheet can still add - fits. Landing on a slot
 * the list has nobody for would only show an empty list, so those are passed
 * over; if no open slot has anyone, the plain next open slot is used, and
 * null means every slot is filled.
 */
export function nextOpenSlotIndex({ rosterSlots, fromIndex, candidates }) {
    const lineup = new Set(rosterSlots.map((slot) => slot.playerId).filter(Boolean));
    const addable = candidates.filter((player) => !lineup.has(player.player_id));
    let firstOpen = null;
    for (let step = 1; step <= rosterSlots.length; step++) {
        const index = (fromIndex + step) % rosterSlots.length;
        const slot = rosterSlots[index];
        if (slot.playerId) {
            continue;
        }
        if (addable.some((player) => slotAdmits(slot.label, player))) {
            return index;
        }
        firstOpen ??= index;
    }
    return firstOpen;
}

/**
 * Puts back every starter Sleeper has already locked: `sleeperStarters` is
 * the roster's `starters` from Sleeper, one id per starting slot in the same
 * order as `rosterSlots` (both are `roster_positions` without the bench), with
 * `'0'` for an empty slot. A starter whose game has kicked off
 * (`hasPlayed(id)`) goes back in that exact slot whatever the app had there,
 * and is taken out of any other slot the app had him in. Every other slot is
 * left as it was.
 */
export function lockPlayedStarters({ rosterSlots, sleeperStarters, hasPlayed }) {
    const locked = new Map();
    (sleeperStarters || []).forEach((id, index) => {
        if (id && id !== '0' && index < rosterSlots.length && hasPlayed(id)) {
            locked.set(index, id);
        }
    });
    const lockedIds = new Set(locked.values());
    const newSlots = rosterSlots.map((slot, index) => {
        if (locked.has(index)) {
            return { ...slot, playerId: locked.get(index) };
        }
        return lockedIds.has(slot.playerId) ? { ...slot, playerId: null } : slot;
    });
    return { rosterSlots: newSlots };
}

/**
 * Pure version of `App.autoSetLineup`: Sleeper's locked starters first, then
 * the best-ranked of `candidates` in every slot still open. A candidate whose
 * game has kicked off is left out - if Sleeper had him benched he is locked
 * on the bench, and if Sleeper had him starting he is already placed above.
 */
export function autoSetLineup({ rosterSlots, candidates, sleeperStarters, hasPlayed }) {
    const { rosterSlots: lockedSlots } = lockPlayedStarters({ rosterSlots, sleeperStarters, hasPlayed });
    return autoFillLineup({
        rosterSlots: lockedSlots,
        candidates: candidates.filter((player) => !hasPlayed(player.player_id)),
    });
}

/**
 * Pure version of `App.clearLineup`. Empties every slot.
 */
export function clearLineup({ rosterSlots }) {
    return { rosterSlots: rosterSlots.map((slot) => ({ ...slot, playerId: null })) };
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
