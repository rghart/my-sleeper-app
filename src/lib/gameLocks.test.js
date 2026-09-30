import { describe, expect, it } from 'vitest';
import { teamsThatHavePlayed } from './gameLocks.js';

const NFL_STATE = { season: '2026', season_type: 'regular', week: 4 };
const game = (overrides) => ({ week: 4, status: 'pre_game', home: 'BAL', away: 'TEN', ...overrides });

describe('teamsThatHavePlayed', () => {
    it('reports both teams of a started or finished game this week', () => {
        const games = [
            game({ status: 'complete', home: 'BAL', away: 'TEN' }),
            game({ status: 'in_game', home: 'BUF', away: 'NE' }),
            game({ status: 'pre_game', home: 'CAR', away: 'DET' }),
        ];
        expect([...teamsThatHavePlayed({ games, nflState: NFL_STATE })].sort()).toEqual(['BAL', 'BUF', 'NE', 'TEN']);
    });

    it("ignores other weeks' games and a canceled one", () => {
        const games = [game({ week: 3, status: 'complete' }), game({ status: 'canceled', home: 'KC', away: 'LV' })];
        expect(teamsThatHavePlayed({ games, nflState: NFL_STATE }).size).toBe(0);
    });

    it('reports nothing outside the regular season', () => {
        const games = [game({ status: 'complete' })];
        expect(teamsThatHavePlayed({ games, nflState: { ...NFL_STATE, season_type: 'post' } }).size).toBe(0);
    });
});
