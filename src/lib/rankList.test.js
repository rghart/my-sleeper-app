import { describe, expect, it } from 'vitest';
import { insertAtRank, resolvedEntry } from './rankList.js';

const at = (ranking) => ({ ranking, match_results: [[`p${ranking}`, '0.000']], search_string: `player ${ranking}` });
const ranks = (entries) => entries.map((entry) => entry.ranking);

describe('insertAtRank', () => {
    // The ordinary case: line 3 missed, so the list is numbered 1, 2, 4, 5 and
    // the resolved player fills the hole they left.
    it('fills the gap the miss left, changing nothing else', () => {
        const entries = [at(1), at(2), at(4), at(5)];
        expect(ranks(insertAtRank(entries, at(3)))).toEqual([1, 2, 3, 4, 5]);
    });

    // The property that makes the above safe to do row by row: resolving one
    // miss must not renumber a row into the slot another miss still owns.
    it('leaves a later gap alone for the miss that still owns it', () => {
        const entries = [at(1), at(2), at(4), at(5), at(8)];
        expect(ranks(insertAtRank(entries, at(3)))).toEqual([1, 2, 3, 4, 5, 8]);
    });

    it('appends when the miss ranks after everything', () => {
        expect(ranks(insertAtRank([at(1), at(2)], at(9)))).toEqual([1, 2, 9]);
    });

    it('inserts at the front when the miss ranks first', () => {
        expect(ranks(insertAtRank([at(2), at(3)], at(1)))).toEqual([1, 2, 3]);
    });

    it('inserts into an empty list', () => {
        expect(ranks(insertAtRank([], at(4)))).toEqual([4]);
    });

    // Deleting a row renumbers the list to 1..n, so a miss can come back to a
    // rank that now exists. Two rows sharing a rank would break the edit and
    // delete controls, which find their row by it.
    it('shifts the collision out of the way when the rank is taken', () => {
        const entries = [at(1), at(2), at(3)];
        expect(ranks(insertAtRank(entries, at(3)))).toEqual([1, 2, 3, 4]);
    });

    it('puts the resolved player first when it collides', () => {
        const entries = [at(1), at(2), at(3)];
        expect(insertAtRank(entries, resolvedEntry({ playerId: 'x', ranking: 3, searchString: 'x' }))[2]).toMatchObject(
            {
                match_results: [['x', '0.000']],
            },
        );
    });

    it('shifts only as far as it must', () => {
        // 4 is free once 3 moves nothing, so 5 and 9 stay put.
        const entries = [at(1), at(2), at(3), at(5), at(9)];
        expect(ranks(insertAtRank(entries, at(3)))).toEqual([1, 2, 3, 4, 5, 9]);
    });

    it('never leaves two rows on the same rank', () => {
        const entries = [at(1), at(2), at(3), at(4)];
        const result = insertAtRank(entries, at(2));
        expect(new Set(ranks(result)).size).toBe(result.length);
    });

    it('does not mutate the list it was given', () => {
        const entries = [at(1), at(3)];
        insertAtRank(entries, at(2));
        expect(ranks(entries)).toEqual([1, 3]);
    });

    it('tolerates ranks that arrive as strings', () => {
        // createRankings emits numbers, but a saved list round-trips through
        // Firebase, which is not fussy about which it gives back.
        const entries = [
            { ...at(1), ranking: '1' },
            { ...at(1), ranking: '4' },
        ];
        expect(ranks(insertAtRank(entries, at(2)))).toEqual(['1', 2, '4']);
    });
});

describe('resolvedEntry', () => {
    it('scores a hand-picked player as certain', () => {
        // Above 0 renders as a low-confidence match, which would flag the row
        // the user had just fixed.
        expect(resolvedEntry({ playerId: '42', ranking: 3, searchString: 'Bijan Robinson' })).toEqual({
            match_results: [['42', '0.000']],
            ranking: 3,
            search_string: 'Bijan Robinson',
        });
    });
});
