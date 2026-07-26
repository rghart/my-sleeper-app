import { describe, expect, it } from 'vitest';
import createRankings from './helpers';

describe('createRankings', () => {
    it('returns empty result arrays for empty input', () => {
        const [searchResultsArray, notFoundPlayers] = createRankings('', {});
        expect(searchResultsArray).toEqual([]);
        expect(notFoundPlayers).toEqual([]);
    });
});
