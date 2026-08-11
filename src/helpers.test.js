import { describe, expect, it } from 'vitest';
import createRankings from './helpers';

const player = (id, first, last, team, position, rank) => ({
    player_id: id,
    search_first_name: first.toLowerCase(),
    search_last_name: last.toLowerCase(),
    full_name: `${first} ${last}`,
    team,
    position,
    search_rank: rank,
});

const playerInfo = {
    1: player('1', 'Bijan', 'Robinson', 'ATL', 'RB', 3),
    2: player('2', 'Puka', 'Nacua', 'LA', 'WR', 12),
    3: player('3', 'Brian', 'Robinson', 'WAS', 'RB', 60),
};

const winners = (results) => results.map((result) => result.match_results[0][0]);

describe('createRankings', () => {
    it('returns empty result arrays for empty input', () => {
        const [searchResultsArray, notFoundPlayers] = createRankings('', {});
        expect(searchResultsArray).toEqual([]);
        expect(notFoundPlayers).toEqual([]);
    });

    it('ranks a pasted list in the order it was pasted', () => {
        const [results] = createRankings('1. Bijan Robinson ATL RB\n2. Puka Nacua LA WR', playerInfo);
        expect(winners(results)).toEqual(['1', '2']);
        expect(results.map((result) => result.ranking)).toEqual([1, 2]);
    });

    it('carries the parsed line back for display', () => {
        const [results] = createRankings('1. Bijan Robinson ATL RB', playerInfo);
        expect(results[0].search_string).toBe('Bijan Robinson ATL RB');
    });

    it('reports a line it could not match, without breaking the paste', () => {
        const [results, notFound] = createRankings('Bijan Robinson\nNobody Whatsoever\nPuka Nacua', playerInfo);
        expect(winners(results)).toEqual(['1', '2']);
        expect(notFound).toEqual([{ ranking: 2, search_string: 'Nobody Whatsoever' }]);
    });

    // The rank is what makes a miss fixable rather than just reported: the
    // panel offers a search against it, and the player picked drops into this
    // slot. A formatted sentence had thrown it away.
    it('carries the rank a miss was going to occupy', () => {
        const [, notFound] = createRankings('Bijan Robinson\nNobody Whatsoever\nPuka Nacua', playerInfo);
        expect(notFound[0].ranking).toBe(2);
    });

    // A miss still occupies its place in the list the user pasted, so the rank
    // in the message is the rank they can see on screen.
    it('spends a rank on a miss, so later players keep their true rank', () => {
        const [results] = createRankings('Nobody Whatsoever\nPuka Nacua', playerInfo);
        expect(results[0].ranking).toBe(2);
    });

    // The miss label used to interpolate the team and position raw, so a
    // two-token name that missed rendered "undefined  undefined" to the user.
    it('names only the fields the line carried in a miss label', () => {
        const [, notFound] = createRankings('Nobody Whatsoever', playerInfo);
        expect(notFound[0].search_string).not.toMatch(/undefined|null/);
    });

    it.each([
        ['blank lines', 'Bijan Robinson\n\n\nPuka Nacua'],
        ['carriage returns', 'Bijan Robinson\r\nPuka Nacua'],
        ['trailing whitespace lines', 'Bijan Robinson\nPuka Nacua\n   \n'],
    ])('does not spend a rank on %s', (_label, text) => {
        const [results, notFound] = createRankings(text, playerInfo);
        expect(winners(results)).toEqual(['1', '2']);
        expect(results.map((result) => result.ranking)).toEqual([1, 2]);
        expect(notFound).toEqual([]);
    });

    it('reads a spreadsheet paste, where the columns arrive tab-separated', () => {
        const [results, notFound] = createRankings('1\tBijan Robinson\tATL\tRB\n2\tPuka Nacua\tLA\tWR', playerInfo);
        expect(winners(results)).toEqual(['1', '2']);
        expect(notFound).toEqual([]);
    });

    it('keeps two players with the same surname apart by team', () => {
        const [results] = createRankings('B. Robinson WAS\nB. Robinson ATL', playerInfo);
        expect(winners(results)).toEqual(['3', '1']);
    });
});
