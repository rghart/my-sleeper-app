import { describe, expect, it } from 'vitest';
import { matchPlayer, playerIndex } from './rankMatch.js';
import { parseRankLine } from './rankParse.js';

const player = (id, first, last, team, position, rank) => ({
    player_id: id,
    search_first_name: first.toLowerCase(),
    search_last_name: last.toLowerCase(),
    full_name: `${first} ${last}`,
    team,
    position,
    search_rank: rank,
});

// Two Robinsons and two Browns, because the whole job of the team and position
// fields is telling players with the same surname apart.
const playerInfo = {
    1: player('1', 'Bijan', 'Robinson', 'ATL', 'RB', 3),
    2: player('2', 'Brian', 'Robinson', 'WAS', 'RB', 60),
    3: player('3', 'Marquise', 'Brown', 'KC', 'WR', 120),
    4: player('4', 'Antonio', 'Brown', 'FA', 'WR', 900),
    5: player('5', 'Puka', 'Nacua', 'LA', 'WR', 12),
    6: player('6', 'Kyle', 'Shanahan', 'SF', 'HC', 9999),
};

const ids = (matches) => matches.map(([id]) => id);
const matchLine = (line, info = playerInfo) => matchPlayer(parseRankLine(line), playerIndex(info));

describe('playerIndex', () => {
    it('builds the index once per payload', () => {
        expect(playerIndex(playerInfo)).toBe(playerIndex(playerInfo));
    });

    it('builds a fresh index for a new payload', () => {
        expect(playerIndex({ ...playerInfo })).not.toBe(playerIndex(playerInfo));
    });
});

describe('matchPlayer', () => {
    it('finds a player by first and last name', () => {
        expect(ids(matchLine('Puka Nacua'))[0]).toBe('5');
    });

    it('finds a player by a first initial', () => {
        expect(ids(matchLine('P. Nacua'))[0]).toBe('5');
    });

    it('uses the team to pick between two players sharing a surname', () => {
        expect(ids(matchLine('B. Robinson WAS'))[0]).toBe('2');
        expect(ids(matchLine('B. Robinson ATL'))[0]).toBe('1');
    });

    // The payoff for the parse fix. Under the old positional slots this line
    // put `WR` in the team field and undefined in the position field, so all
    // three qualified branches were dead and only the name-only fallback ran.
    it('uses a position supplied without a team', () => {
        expect(ids(matchLine('Marquise Brown WR'))).toContain('3');
    });

    it('returns the best-known player first when a line is ambiguous', () => {
        // Both Browns match "Brown" alone; search_rank orders the index, and
        // Fuse returns equal scores in index order.
        expect(ids(matchLine('M. Brown'))[0]).toBe('3');
    });

    it('offers alternates for correction, not just the winner', () => {
        // Bijan and Brian both answer to "B. Robinson", and the panel lets the
        // user swap the winner for a runner-up - so a line that is genuinely
        // ambiguous has to come back with more than one candidate.
        expect(ids(matchLine('B. Robinson')).length).toBeGreaterThan(1);
    });

    it('caps the candidates it offers', () => {
        const crowd = Object.fromEntries(
            Array.from({ length: 12 }, (_, i) => [i, player(String(i), 'Mike', 'Williams', 'NYJ', 'WR', i)]),
        );
        expect(matchLine('Mike Williams', crowd).length).toBeLessThanOrEqual(5);
    });

    it('returns no match for a player who is not in the pool', () => {
        expect(matchLine('Nobody Whatsoever')).toEqual([]);
    });

    // The pool carries coaches and staff, which no ranking list ever means.
    it('never returns a non-playing entry', () => {
        expect(ids(matchLine('Kyle Shanahan'))).not.toContain('6');
    });

    it('returns no match for a line with no surname', () => {
        expect(
            matchPlayer({ first: 'Bijan', last: undefined, team: null, position: null }, playerIndex(playerInfo)),
        ).toEqual([]);
    });

    it('returns no match for a line that parsed to nothing', () => {
        expect(matchPlayer(parseRankLine(''), playerIndex(playerInfo))).toEqual([]);
    });

    it('pairs every id with its score', () => {
        expect(matchLine('Puka Nacua')[0]).toEqual(['5', expect.stringMatching(/^\d\.\d{3}$/)]);
    });
});
