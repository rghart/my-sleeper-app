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

// Tiered lists are ordinary, and both of the ways a list marks them - a
// heading, or a blank line between groups - were things the parser threw away.
// A heading was worse than thrown away: `Tier 1` parsed to the name `Tier` and
// landed in the miss list.
describe('createRankings tiers', () => {
    const tiersOf = (results) => results.map((result) => [result.ranking, result.tier, result.tier_label]);

    it('reads tier headings and keeps them out of the list', () => {
        const [results, notFound] = createRankings(
            'Tier 1\nBijan Robinson\nPuka Nacua\nTier 2\nB. Robinson WAS',
            playerInfo,
        );
        expect(tiersOf(results)).toEqual([
            [1, 1, 'Tier 1'],
            [2, 1, 'Tier 1'],
            [3, 2, 'Tier 2'],
        ]);
        // The headings used to be reported as players nobody could find.
        expect(notFound).toEqual([]);
    });

    it('does not spend a rank on a tier heading', () => {
        const [results] = createRankings('Tier 1\nBijan Robinson\nTier 2\nPuka Nacua', playerInfo);
        expect(results.map((result) => result.ranking)).toEqual([1, 2]);
    });

    it('keeps a descriptive heading as the tier label', () => {
        const [results] = createRankings('Tier 1 - Elite\nBijan Robinson\nTier 2: Solid\nPuka Nacua', playerInfo);
        expect(results.map((result) => result.tier_label)).toEqual(['Tier 1 \u00b7 Elite', 'Tier 2 \u00b7 Solid']);
    });

    it('divides on blank lines when the list has no headings', () => {
        const [results] = createRankings('Bijan Robinson\nPuka Nacua\n\nB. Robinson WAS', playerInfo);
        expect(tiersOf(results)).toEqual([
            [1, 1, 'Tier 1'],
            [2, 1, 'Tier 1'],
            [3, 2, 'Tier 2'],
        ]);
    });

    it('collapses a run of blank lines into one division', () => {
        const [results] = createRankings('Bijan Robinson\n\n\n\nPuka Nacua', playerInfo);
        expect(results.map((result) => result.tier)).toEqual([1, 2]);
    });

    it('ignores blank lines at the top and bottom', () => {
        // A real second tier in the middle, so the single-tier stripping below
        // does not hide what this is checking: the leading and trailing blanks
        // must not open tiers of their own.
        const [results] = createRankings('\n\nBijan Robinson\nPuka Nacua\n\nB. Robinson WAS\n\n', playerInfo);
        expect(results.map((result) => result.tier)).toEqual([1, 1, 2]);
    });

    // In a list with headings, the blank lines are typography. The case that
    // proves it has to be a blank *between two players inside* a tier - one
    // sitting next to a heading is absorbed by the heading either way, so it
    // cannot tell the two rules apart.
    it('does not also divide on blanks once the list has headings', () => {
        const [results] = createRankings('Tier 1\nBijan Robinson\n\nPuka Nacua\nTier 2\nB. Robinson WAS', playerInfo);
        expect(tiersOf(results)).toEqual([
            [1, 1, 'Tier 1'],
            [2, 1, 'Tier 1'],
            [3, 2, 'Tier 2'],
        ]);
    });

    it('lets a heading absorb the blank lines written around it', () => {
        const [results] = createRankings('Tier 1\nBijan Robinson\n\nTier 2\n\nPuka Nacua', playerInfo);
        expect(results.map((result) => result.tier)).toEqual([1, 2]);
    });

    // A heading above the first player is naming tier 1, not creating an empty
    // tier in front of it.
    it('names tier 1 from a heading that sits above the first player', () => {
        const [results] = createRankings('Tier 1 - Studs\nBijan Robinson\nTier 2\nPuka Nacua', playerInfo);
        expect(results.map((result) => result.tier)).toEqual([1, 2]);
    });

    // The property that keeps every untiered list byte-identical to what it
    // was before tiers existed - the same fields get saved to Firebase, and
    // the panel has nothing to draw a divider from.
    it('leaves an untiered list with no tier fields at all', () => {
        const [results] = createRankings('Bijan Robinson\nPuka Nacua', playerInfo);
        expect(results[0]).not.toHaveProperty('tier');
        expect(results[0]).not.toHaveProperty('tier_label');
    });

    it('leaves a list with one heading untiered, because one tier is just a list', () => {
        const [results] = createRankings('Tier 1\nBijan Robinson\nPuka Nacua', playerInfo);
        expect(results[0]).not.toHaveProperty('tier');
    });

    // A miss carries its tier so the player picked to resolve it joins the
    // tier the pasted line was sitting in.
    it('gives a miss the tier its line was in', () => {
        const [, notFound] = createRankings('Tier 1\nBijan Robinson\nTier 2\nNobody Whatsoever', playerInfo);
        expect(notFound[0]).toMatchObject({ ranking: 2, tier: 2, tier_label: 'Tier 2' });
    });

    it('treats a table as a single untiered list', () => {
        const map = { name: 1, first: null, last: null, team: 2, position: null, hasHeader: false, delimiter: ',' };
        const [results] = createRankings('1,Bijan Robinson,ATL\n2,Puka Nacua,LA', playerInfo, map);
        expect(results[0]).not.toHaveProperty('tier');
    });
});
