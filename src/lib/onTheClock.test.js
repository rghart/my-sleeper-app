import { describe, expect, it } from 'vitest';
import { nextUnpickedPick, picksUntilMine } from './onTheClock.js';

// Both helpers walk the board in array order rather than sorting it:
// buildDraftRounds has already put a snake draft's even rounds in reverse, and
// re-deriving draft order here would be a second opinion about something the
// board already settled.

const pick = (pickNumber, rosterId, playerId = null) => ({
    pick_number: pickNumber,
    roster_id: rosterId,
    owner_id: rosterId,
    player_id: playerId,
});

const rosterData = [
    { roster_id: 1, manager_display_name: 'ryangh' },
    { roster_id: 2, manager_display_name: 'crbiehl' },
    { roster_id: 3, manager_display_name: 'dkline' },
];

const board = [
    { round: 1, picks: [pick(1, 2, 'p1'), pick(2, 3, 'p2'), pick(3, 1)] },
    { round: 2, picks: [pick(1, 1), pick(2, 3), pick(3, 2)] },
];

describe('nextUnpickedPick', () => {
    it('returns the first pick in board order with nobody in it', () => {
        const next = nextUnpickedPick(board);

        expect(next.round.round).toBe(1);
        expect(next.pick.pick_number).toBe(3);
    });

    it('returns null for a board with every pick made, and for no board at all', () => {
        const full = board.map((round) => ({
            ...round,
            picks: round.picks.map((entry) => ({ ...entry, player_id: 'someone' })),
        }));

        expect(nextUnpickedPick(full)).toBeNull();
        expect(nextUnpickedPick(null)).toBeNull();
        expect(nextUnpickedPick(undefined)).toBeNull();
    });

    it('walks the board in the order it is stored, not in pick_number order', () => {
        // A contract test rather than a reproduction: buildDraftRounds
        // renumbers a reversed snake round 1..n, so today the two orders
        // always agree and a stray `.sort()` would be invisible. The board's
        // own order is still the authority - it is what the feed renders in
        // and what a snake's reversal is expressed as - so this pins it with a
        // board where the two disagree.
        const outOfOrder = [{ round: 1, picks: [pick(3, 3), pick(1, 1), pick(2, 2)] }];

        expect(nextUnpickedPick(outOfOrder).pick.roster_id).toBe(3);
        expect(picksUntilMine({ builtDraft: outOfOrder, rosterData, myDisplayName: 'ryangh' })).toBe(1);
    });
});

describe('picksUntilMine', () => {
    it('counts from the pick on the clock, not from the start of the board', () => {
        // 1.3 is on the clock and is roster 1's - mine.
        expect(picksUntilMine({ builtDraft: board, rosterData, myDisplayName: 'ryangh' })).toBe(0);
    });

    it('counts the picks in between when the next one is somebody else', () => {
        // On the clock: 1.3 (roster 1), then 2.1 (roster 1) - so for dkline
        // (roster 3) the next own pick is 2.2, two picks away.
        expect(picksUntilMine({ builtDraft: board, rosterData, myDisplayName: 'dkline' })).toBe(2);
    });

    it('returns null when no pick left on the board is yours', () => {
        expect(picksUntilMine({ builtDraft: board, rosterData, myDisplayName: 'nobody' })).toBeNull();
    });

    it('returns null rather than guessing when the display name has not resolved yet', () => {
        expect(picksUntilMine({ builtDraft: board, rosterData, myDisplayName: null })).toBeNull();
        expect(picksUntilMine({ builtDraft: board, rosterData: null, myDisplayName: 'ryangh' })).toBeNull();
    });

    it('attributes a traded pick to whoever owns it now, not who it came from', () => {
        const traded = [{ round: 1, picks: [{ ...pick(1, 2), owner_id: 1, is_traded: true }, pick(2, 3)] }];

        expect(picksUntilMine({ builtDraft: traded, rosterData, myDisplayName: 'ryangh' })).toBe(0);
    });
});
