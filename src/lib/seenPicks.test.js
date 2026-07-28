import { describe, expect, it } from 'vitest';
import { countNewInRound, madePickKeys, newPickKeySet, pickKey } from './seenPicks.js';

const round = (roundNumber, picks) => ({ round: roundNumber, picks });
const pick = (pickNumber, playerId = null) => ({ pick_number: pickNumber, player_id: playerId });

describe('pickKey', () => {
    it('joins round and pick number with a dot, unpadded', () => {
        expect(pickKey(round(1, []), pick(3))).toBe('1.3');
    });
});

describe('madePickKeys', () => {
    it('tolerates a null board', () => {
        expect(madePickKeys(null)).toEqual([]);
        expect(madePickKeys(undefined)).toEqual([]);
    });

    it('collects only picks with a player_id, in board order', () => {
        const builtDraft = [
            round(1, [pick(1, 'p1'), pick(2, null), pick(3, 'p3')]),
            round(2, [pick(1, null), pick(2, 'p2')]),
        ];

        expect(madePickKeys(builtDraft)).toEqual(['1.1', '1.3', '2.2']);
    });
});

describe('newPickKeySet', () => {
    it('tolerates a null board or null seen set', () => {
        expect(newPickKeySet(null, new Set())).toEqual(new Set());
        expect(newPickKeySet([round(1, [pick(1, 'p1')])], null)).toEqual(new Set());
    });

    it('reports a manual pick projected into a later round while earlier real picks are still unseen', () => {
        // This is the case a "highest pick reached" cursor gets wrong: the
        // manual pick in round 2 must not push a cursor past round 1's
        // still-unmade picks and hide them from being reported as new too.
        const builtDraft = [
            round(1, [pick(1, 'p1'), pick(2, 'p2'), pick(3, null)]),
            round(2, [pick(1, null), pick(2, 'manual-p')]),
        ];
        const seenKeys = new Set(['1.1']);

        expect(newPickKeySet(builtDraft, seenKeys)).toEqual(new Set(['1.2', '2.2']));
    });

    it('drops a pick that has been cleared back to player_id: null', () => {
        const builtDraft = [round(1, [pick(1, null)])];
        const seenKeys = new Set();

        expect(newPickKeySet(builtDraft, seenKeys)).toEqual(new Set());
    });
});

describe('countNewInRound', () => {
    it('counts only the picks in this round whose key is in newPickKeys', () => {
        const r = round(1, [pick(1, 'p1'), pick(2, 'p2'), pick(3, null)]);
        const newPickKeys = new Set(['1.1', '2.5']);

        expect(countNewInRound(r, newPickKeys)).toBe(1);
    });

    it('returns 0 when nothing in the round is new', () => {
        const r = round(1, [pick(1, 'p1')]);

        expect(countNewInRound(r, new Set())).toBe(0);
    });
});
