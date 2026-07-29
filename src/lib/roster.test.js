import { describe, expect, it } from 'vitest';
import {
    addPlayerToRoster,
    eligiblePositionsForSlot,
    getEligiblePositions,
    removePlayerFromLineup,
    toRosterSlots,
} from './roster.js';

const makePlayer = (overrides = {}) => ({
    player_id: '1001',
    position: 'RB',
    fantasy_positions: ['RB'],
    ...overrides,
});

describe('getEligiblePositions', () => {
    it('adds FLX and SFLX for RB/WR/TE', () => {
        expect(getEligiblePositions(makePlayer({ position: 'RB', fantasy_positions: ['RB'] }))).toEqual([
            'RB',
            'FLX',
            'SFLX',
        ]);
        expect(getEligiblePositions(makePlayer({ position: 'WR', fantasy_positions: ['WR'] }))).toEqual([
            'WR',
            'FLX',
            'SFLX',
        ]);
        expect(getEligiblePositions(makePlayer({ position: 'TE', fantasy_positions: ['TE'] }))).toEqual([
            'TE',
            'FLX',
            'SFLX',
        ]);
    });

    it('adds only SFLX for QB', () => {
        expect(getEligiblePositions(makePlayer({ position: 'QB', fantasy_positions: ['QB'] }))).toEqual(['QB', 'SFLX']);
    });

    it('does not add anything extra for K/DEF', () => {
        expect(getEligiblePositions(makePlayer({ position: 'K', fantasy_positions: ['K'] }))).toEqual(['K']);
        expect(getEligiblePositions(makePlayer({ position: 'DEF', fantasy_positions: ['DEF'] }))).toEqual(['DEF']);
    });

    it('does not mutate the original fantasy_positions array', () => {
        const player = makePlayer();
        const original = player.fantasy_positions;
        getEligiblePositions(player);
        expect(player.fantasy_positions).toBe(original);
        expect(player.fantasy_positions).toEqual(['RB']);
    });

    it('does not grow fantasy_positions when called repeatedly for the same player (regression for the push-duplication bug)', () => {
        const player = makePlayer();
        const first = getEligiblePositions(player);
        // Simulate the player object being updated to the previously-returned list,
        // as addPlayerToRoster does, and call again.
        const updatedPlayer = { ...player, fantasy_positions: first };
        const second = getEligiblePositions(updatedPlayer);
        expect(second).toEqual(first);
        expect(second).toEqual(['RB', 'FLX', 'SFLX']);
    });
});

describe('eligiblePositionsForSlot', () => {
    it('admits RB/WR/TE for FLX, in that order', () => {
        expect(eligiblePositionsForSlot('FLX')).toEqual(['RB', 'WR', 'TE']);
    });

    it('admits QB/RB/WR/TE for SFLX, in that order', () => {
        expect(eligiblePositionsForSlot('SFLX')).toEqual(['QB', 'RB', 'WR', 'TE']);
    });

    it('admits only itself for a direct slot label - a TE slot admits only TE', () => {
        expect(eligiblePositionsForSlot('TE')).toEqual(['TE']);
        expect(eligiblePositionsForSlot('QB')).toEqual(['QB']);
        expect(eligiblePositionsForSlot('RB')).toEqual(['RB']);
        expect(eligiblePositionsForSlot('WR')).toEqual(['WR']);
    });

    it('admits only itself for a slot with no flex mapping at all', () => {
        expect(eligiblePositionsForSlot('K')).toEqual(['K']);
        expect(eligiblePositionsForSlot('DEF')).toEqual(['DEF']);
    });

    // getEligiblePositions (player -> slots) and eligiblePositionsForSlot
    // (slot -> positions) are two views of the same underlying table. If they
    // are ever hand-maintained separately, this is the test that notices they
    // drifted - checked in both directions rather than just one, since a
    // one-way check would pass even if a slot admitted a position that never
    // reports being eligible for it.
    describe('agreement with getEligiblePositions, in both directions', () => {
        const player = (position) => ({ player_id: '1', position, fantasy_positions: [position] });

        it('every position getEligiblePositions adds a flex slot for is also returned by that slot', () => {
            for (const position of ['QB', 'RB', 'WR', 'TE']) {
                const eligibleSlots = getEligiblePositions(player(position));
                for (const slot of eligibleSlots.filter((label) => label === 'FLX' || label === 'SFLX')) {
                    expect(eligiblePositionsForSlot(slot)).toContain(position);
                }
            }
        });

        it('every position a flex slot admits also has that slot in its own getEligiblePositions', () => {
            for (const slot of ['FLX', 'SFLX']) {
                for (const position of eligiblePositionsForSlot(slot)) {
                    expect(getEligiblePositions(player(position))).toContain(slot);
                }
            }
        });
    });
});

const slots = (...labels) => labels.map((label) => ({ label, playerId: null }));

describe('toRosterSlots', () => {
    it('drops bench slots and shortens the flex labels', () => {
        expect(toRosterSlots(['QB', 'RB', 'FLEX', 'SUPER_FLEX', 'BN', 'BN'])).toEqual(slots('QB', 'RB', 'FLX', 'SFLX'));
    });

    it('starts every slot empty', () => {
        expect(toRosterSlots(['QB', 'RB']).every((slot) => slot.playerId === null)).toBe(true);
    });

    it('keeps duplicate positions as separate slots', () => {
        // Two RB slots are two places a player can go, not one.
        expect(toRosterSlots(['RB', 'RB'])).toHaveLength(2);
    });
});

describe('addPlayerToRoster', () => {
    it('fills the first open slot matching the player position', () => {
        const result = addPlayerToRoster({ player: makePlayer(), rosterSlots: slots('QB', 'RB', 'WR', 'FLX') });

        expect(result.rosterSlots[1]).toEqual({ label: 'RB', playerId: '1001' });
        // Every other slot keeps its label and stays empty - the label is no
        // longer destroyed by filling a slot, which is what made roster_text
        // necessary in the first place.
        expect(result.rosterSlots.map((slot) => slot.label)).toEqual(['QB', 'RB', 'WR', 'FLX']);
    });

    it('falls back to FLX when the primary position slot is taken', () => {
        const taken = slots('QB', 'RB', 'WR', 'FLX');
        taken[1] = { label: 'RB', playerId: '2002' };

        const result = addPlayerToRoster({ player: makePlayer(), rosterSlots: taken });

        expect(result.rosterSlots[3]).toEqual({ label: 'FLX', playerId: '1001' });
    });

    it('skips an occupied slot of the right label rather than displacing its occupant', () => {
        // findIndex has to test occupancy as well as label; matching on label
        // alone would silently evict whoever is already there.
        const taken = slots('RB', 'RB');
        taken[0] = { label: 'RB', playerId: '2002' };

        const result = addPlayerToRoster({ player: makePlayer(), rosterSlots: taken });

        expect(result.rosterSlots[0].playerId).toEqual('2002');
        expect(result.rosterSlots[1].playerId).toEqual('1001');
    });

    it('leaves the slots unchanged when no eligible slot is open', () => {
        const rosterSlots = slots('QB', 'WR', 'TE');
        const result = addPlayerToRoster({ player: makePlayer(), rosterSlots });

        expect(result.rosterSlots).toEqual(rosterSlots);
    });

    it('does not mutate its inputs', () => {
        const player = makePlayer();
        const rosterSlots = slots('QB', 'RB', 'WR', 'FLX');
        const clonedPlayer = structuredClone(player);
        const clonedSlots = structuredClone(rosterSlots);

        addPlayerToRoster({ player, rosterSlots });

        expect(player).toEqual(clonedPlayer);
        expect(rosterSlots).toEqual(clonedSlots);
    });

    describe('with a slotIndex', () => {
        it('fills that exact slot rather than searching for an eligible one', () => {
            // TE at index 0 would not even be eligible for this RB under the
            // normal search - the point of slotIndex is to skip that search
            // entirely, because the user already chose the slot by tapping it.
            const result = addPlayerToRoster({
                player: makePlayer({ position: 'RB', fantasy_positions: ['RB'] }),
                rosterSlots: slots('TE', 'RB'),
                slotIndex: 0,
            });

            expect(result.rosterSlots[0]).toEqual({ label: 'TE', playerId: '1001' });
            expect(result.rosterSlots[1]).toEqual({ label: 'RB', playerId: null });
        });

        it('replaces an already-filled slot rather than leaving it or looking elsewhere', () => {
            const taken = slots('QB', 'RB');
            taken[0] = { label: 'QB', playerId: 'old-occupant' };

            const result = addPlayerToRoster({ player: makePlayer(), rosterSlots: taken, slotIndex: 0 });

            expect(result.rosterSlots[0]).toEqual({ label: 'QB', playerId: '1001' });
            expect(result.rosterSlots[1].playerId).toBeNull();
        });

        it('leaves the slots unchanged for an out-of-range index', () => {
            const rosterSlots = slots('QB', 'RB');
            const result = addPlayerToRoster({ player: makePlayer(), rosterSlots, slotIndex: 5 });

            expect(result.rosterSlots).toEqual(rosterSlots);
        });
    });

    it('never touches the player database, because it is not given one', () => {
        // The point of the whole change: assigning a player to a lineup slot is
        // a fact about the slot. playerInfo is not a parameter any more, so
        // there is no way to write to it even by accident.
        expect(addPlayerToRoster.length).toBe(1);
        expect(Object.keys(addPlayerToRoster({ player: makePlayer(), rosterSlots: slots('RB') }))).toEqual([
            'rosterSlots',
        ]);
    });
});

describe('removePlayerFromLineup', () => {
    it('empties the slot while keeping its label', () => {
        const filled = slots('QB', 'RB', 'WR');
        filled[1] = { label: 'RB', playerId: '1001' };

        const result = removePlayerFromLineup({ i: 1, rosterSlots: filled });

        expect(result.rosterSlots[1]).toEqual({ label: 'RB', playerId: null });
        // Nothing was looked up to restore the label: it never went away. The
        // old implementation read it back off the player as roster_text, which
        // is why it needed the player database at all.
        expect(result.rosterSlots.map((slot) => slot.label)).toEqual(['QB', 'RB', 'WR']);
    });

    it('removes the player from the derived lineup membership', () => {
        const filled = slots('QB', 'RB');
        filled[1] = { label: 'RB', playerId: '1001' };

        const result = removePlayerFromLineup({ i: 1, rosterSlots: filled });

        expect(result.rosterSlots.some((slot) => slot.playerId === '1001')).toBe(false);
    });

    it('leaves other filled slots alone', () => {
        const filled = slots('RB', 'RB');
        filled[0] = { label: 'RB', playerId: '2002' };
        filled[1] = { label: 'RB', playerId: '1001' };

        const result = removePlayerFromLineup({ i: 1, rosterSlots: filled });

        expect(result.rosterSlots[0].playerId).toEqual('2002');
    });

    it('does not mutate its inputs', () => {
        const filled = slots('QB', 'RB');
        filled[1] = { label: 'RB', playerId: '1001' };
        const clonedSlots = structuredClone(filled);

        removePlayerFromLineup({ i: 1, rosterSlots: filled });

        expect(filled).toEqual(clonedSlots);
    });
});
