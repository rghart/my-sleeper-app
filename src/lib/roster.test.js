import { describe, expect, it } from 'vitest';
import { addPlayerToRoster, getEligiblePositions, removePlayerFromLineup } from './roster.js';

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

describe('addPlayerToRoster', () => {
    it('assigns the player to the first matching open roster slot', () => {
        const player = makePlayer();
        const rosterPositions = ['QB', 'RB', 'WR', 'FLX', 'BN'];
        const playerInfo = {};
        const result = addPlayerToRoster({ player, rosterPositions, playerInfo });

        expect(result.rosterPositions).toEqual(['QB', '1001', 'WR', 'FLX', 'BN']);
        expect(result.playerInfo['1001'].roster_text).toEqual('RB');
        expect(result.playerInfo['1001'].in_lineup).toBe(true);
        expect(result.playerInfo['1001'].fantasy_positions).toEqual(['RB', 'FLX', 'SFLX']);
    });

    it('falls back to FLX slot when the primary position slot is unavailable', () => {
        const player = makePlayer();
        const rosterPositions = ['QB', 'WR', 'FLX', 'BN'];
        const playerInfo = {};
        const result = addPlayerToRoster({ player, rosterPositions, playerInfo });

        expect(result.rosterPositions).toEqual(['QB', 'WR', '1001', 'BN']);
        expect(result.playerInfo['1001'].roster_text).toEqual('FLX');
    });

    it('leaves rosterPositions unchanged when no eligible slot is open', () => {
        const player = makePlayer();
        const rosterPositions = ['QB', 'WR', 'TE', 'BN'];
        const playerInfo = {};
        const result = addPlayerToRoster({ player, rosterPositions, playerInfo });

        expect(result.rosterPositions).toEqual(rosterPositions);
        expect(result.playerInfo['1001'].in_lineup).toBe(true);
    });

    it('does not mutate its inputs', () => {
        const player = makePlayer();
        const rosterPositions = ['QB', 'RB', 'WR', 'FLX', 'BN'];
        const playerInfo = { 2002: makePlayer({ player_id: '2002' }) };
        const clonedPlayer = structuredClone(player);
        const clonedRosterPositions = structuredClone(rosterPositions);
        const clonedPlayerInfo = structuredClone(playerInfo);

        addPlayerToRoster({ player, rosterPositions, playerInfo });

        expect(player).toEqual(clonedPlayer);
        expect(rosterPositions).toEqual(clonedRosterPositions);
        expect(playerInfo).toEqual(clonedPlayerInfo);
    });

    it('does not duplicate fantasy_positions entries when the player is added twice in a row', () => {
        const player = makePlayer();
        const rosterPositions = ['QB', 'RB', 'WR', 'FLX', 'BN'];
        const first = addPlayerToRoster({ player, rosterPositions, playerInfo: {} });

        // Second call simulates re-adding using the already-updated player/playerInfo,
        // as would happen if addToRoster were invoked again for the same player.
        const second = addPlayerToRoster({
            player: first.playerInfo['1001'],
            rosterPositions: first.rosterPositions,
            playerInfo: first.playerInfo,
        });

        expect(second.playerInfo['1001'].fantasy_positions).toEqual(['RB', 'FLX', 'SFLX']);
        expect(second.playerInfo['1001'].fantasy_positions.length).toBe(3);
    });
});

describe('removePlayerFromLineup', () => {
    it('restores the roster slot to the remembered roster_text and clears in_lineup', () => {
        const playerInfo = {
            1001: { ...makePlayer(), roster_text: 'RB', in_lineup: true },
        };
        const rosterPositions = ['QB', '1001', 'WR', 'FLX', 'BN'];
        const result = removePlayerFromLineup({ id: '1001', i: 1, rosterPositions, playerInfo });

        expect(result.rosterPositions).toEqual(['QB', 'RB', 'WR', 'FLX', 'BN']);
        expect(result.playerInfo['1001'].in_lineup).toBe(false);
    });

    it('does not mutate its inputs', () => {
        const playerInfo = {
            1001: { ...makePlayer(), roster_text: 'RB', in_lineup: true },
        };
        const rosterPositions = ['QB', '1001', 'WR', 'FLX', 'BN'];
        const clonedRosterPositions = structuredClone(rosterPositions);
        const clonedPlayerInfo = structuredClone(playerInfo);

        removePlayerFromLineup({ id: '1001', i: 1, rosterPositions, playerInfo });

        expect(rosterPositions).toEqual(clonedRosterPositions);
        expect(playerInfo).toEqual(clonedPlayerInfo);
    });
});
