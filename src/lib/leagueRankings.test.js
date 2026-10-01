import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRankingCache, isMyRoster, loadLeagueRankings, myTierIn, teamsFromRankings } from './leagueRankings.js';

const jsonResponse = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
const failure = () => Promise.resolve({ ok: false, status: 503, statusText: 'Unavailable', json: () => ({}) });

const league = (id, overrides = {}) => ({ league_id: id, season: '2026', status: 'in_season', ...overrides });

// The backend's /rankings response, cut down to what these tests read.
const team = (rosterId, blendTier, extra = {}) => ({
    rosterId,
    ownerId: `u${rosterId}`,
    name: `Manager ${rosterId}`,
    now: { ktc: 0.5, blend: 0.5 },
    future: 0.1,
    netPickValue: 0,
    tiers: { ktc: blendTier, blend: blendTier },
    lineups: { ktc: { total: 100, starters: [{ slot: 'QB', playerId: 'q1', value: 100 }] } },
    futureDetail: { playerValue: 1, pickValue: 2, netPickValue: 0, total: 1, picks: [] },
    ...extra,
});
const RANKINGS = { leagueId: 'A', teams: [team(1, 'contender'), team(2, 'stuck')] };

const ROSTERS = [
    { roster_id: 1, owner_id: 'me', players: ['q1'] },
    { roster_id: 2, owner_id: 'them', co_owners: ['partner'], players: ['q2'] },
];

const routeFetch = ({ rankings = () => jsonResponse(RANKINGS) } = {}) =>
    vi.fn((url) => {
        if (url.includes('/rankings')) return rankings();
        if (url.includes('/rosters')) return jsonResponse(ROSTERS);
        return failure();
    });

let originalFetch;
beforeEach(() => {
    originalFetch = global.fetch;
    clearRankingCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe('teamsFromRankings', () => {
    it("reads the response into the screens' team shape, net pick value as `picks`", () => {
        const [first] = teamsFromRankings({ teams: [team(1, 'contender', { netPickValue: 4200 })] });

        expect(first).toEqual({
            rosterId: 1,
            ownerId: 'u1',
            name: 'Manager 1',
            now: { ktc: 0.5, blend: 0.5 },
            future: 0.1,
            picks: 4200,
            tiers: { ktc: 'contender', blend: 'contender' },
            lineups: { ktc: { total: 100, starters: [{ slot: 'QB', playerId: 'q1', value: 100 }] } },
            futureDetail: { playerValue: 1, pickValue: 2, netPickValue: 0, total: 1, picks: [] },
        });
    });

    it('keeps "picks not counted" (null) distinct from "no net picks" (0)', () => {
        expect(teamsFromRankings({ teams: [team(1, 'middle', { netPickValue: null })] })[0].picks).toBeNull();
    });

    it('is an empty list for a missing response rather than a crash', () => {
        expect(teamsFromRankings(undefined)).toEqual([]);
    });
});

describe('loadLeagueRankings', () => {
    it('asks the backend for this league', async () => {
        global.fetch = routeFetch();

        await loadLeagueRankings('A');

        expect(global.fetch.mock.calls[0][0]).toMatch(/api\/v1\/leagues\/A\/rankings$/);
    });

    it('shares one request between two callers, and refetches when asked for fresh', async () => {
        global.fetch = routeFetch();

        await Promise.all([loadLeagueRankings('A'), loadLeagueRankings('A')]);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        await loadLeagueRankings('A', { fresh: true });
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('retries after a failure rather than caching it', async () => {
        let calls = 0;
        global.fetch = routeFetch({ rankings: () => (++calls === 1 ? failure() : jsonResponse(RANKINGS)) });

        expect(await loadLeagueRankings('A')).toBeUndefined();
        expect(await loadLeagueRankings('A')).toEqual(RANKINGS);
    });
});

describe('myTierIn', () => {
    it("names this user's blended tier, counting a co-owner as an owner", async () => {
        global.fetch = routeFetch();

        expect(await myTierIn(league('A'), { userId: 'me' })).toBe('contender');
        expect(await myTierIn(league('A'), { userId: 'partner' })).toBe('stuck');
    });

    it('has no tier before the league has drafted, or for a league you are not in', async () => {
        global.fetch = routeFetch();

        expect(await myTierIn(league('A', { status: 'pre_draft' }), { userId: 'me' })).toBeNull();
        expect(await myTierIn(league('A'), { userId: 'stranger' })).toBeNull();
    });

    it('says nothing when the rankings fail, and asks again next time instead of remembering', async () => {
        let calls = 0;
        global.fetch = routeFetch({ rankings: () => (++calls === 1 ? failure() : jsonResponse(RANKINGS)) });

        expect(await myTierIn(league('A'), { userId: 'me' })).toBeUndefined();
        expect(await myTierIn(league('A'), { userId: 'me' })).toBe('contender');
    });
});

describe('isMyRoster', () => {
    it('counts a co-owner as an owner', () => {
        expect(isMyRoster({ owner_id: 'a', co_owners: ['b'] }, 'b')).toBe(true);
        expect(isMyRoster({ owner_id: 'a' }, undefined)).toBe(false);
    });
});
