import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRankingCache, fetchRankingInputs, isMyRoster, myTierIn } from './leagueRankings.js';

const jsonResponse = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
const failure = () => Promise.resolve({ ok: false, status: 503, statusText: 'Unavailable', json: () => ({}) });

const league = (id, overrides = {}) => ({
    league_id: id,
    season: '2026',
    status: 'in_season',
    total_rosters: 2,
    roster_positions: ['QB', 'SUPER_FLEX', 'BN'],
    settings: { type: 2, draft_rounds: 1 },
    scoring_settings: { rec: 1, pass_td: 4 },
    ...overrides,
});

const KTC = { asOf: '2026-09-20T00:00:00Z', values: [{ playerId: 'q1', value: 9000 }], picks: [] };

describe('fetchRankingInputs', () => {
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

    it('shares one request for a value list two leagues both need', async () => {
        global.fetch = vi.fn((url) => (url.includes('dynasty-values') ? jsonResponse(KTC) : jsonResponse([])));

        await Promise.all([fetchRankingInputs(league('A')), fetchRankingInputs(league('B'))]);

        const calls = global.fetch.mock.calls.map(([url]) => url);
        expect(calls.filter((url) => url.includes('dynasty-values'))).toHaveLength(1);
        expect(calls.filter((url) => url.includes('projections'))).toHaveLength(1);
        // Traded picks are the league's own, so never shared.
        expect(calls.filter((url) => url.includes('traded_picks'))).toHaveLength(2);
    });

    it('retries a list that failed, rather than caching the failure', async () => {
        let ktcCalls = 0;
        global.fetch = vi.fn((url) => {
            if (url.includes('dynasty-values')) return ++ktcCalls === 1 ? failure() : jsonResponse(KTC);
            return jsonResponse([]);
        });

        expect((await fetchRankingInputs(league('A'))).ktc).toBeUndefined();
        expect((await fetchRankingInputs(league('A'))).ktc).toEqual(KTC);
    });
});

describe('myTierIn', () => {
    let originalFetch;
    beforeEach(() => {
        originalFetch = global.fetch;
        clearRankingCache();
    });
    afterEach(() => {
        global.fetch = originalFetch;
    });

    // Mine starts two quarterbacks and benches a third; theirs starts one.
    const rosters = [
        { roster_id: 1, owner_id: 'me', players: ['q1', 'q2', 'q4'] },
        { roster_id: 2, owner_id: 'them', players: ['q3'] },
    ];
    const qb = { fantasy_positions: ['QB'] };
    const playerInfo = { q1: qb, q2: qb, q3: qb, q4: qb };
    const values = [
        { playerId: 'q1', value: 9000 },
        { playerId: 'q2', value: 8000 },
        { playerId: 'q3', value: 1000 },
        { playerId: 'q4', value: 500 },
    ];

    it("names this user's blended tier in a league", async () => {
        global.fetch = vi.fn((url) => {
            if (url.includes('dynasty-values')) return jsonResponse({ ...KTC, values });
            if (url.includes('/rosters')) return jsonResponse(rosters);
            return jsonResponse([]);
        });

        // Two teams sit at +1 and -1 on both scores: mine is ahead now and
        // holds the only bench player.
        expect(await myTierIn(league('A'), { userId: 'me', playerInfo })).toBe('contender');
        expect(await myTierIn(league('A'), { userId: 'them', playerInfo })).toBe('stuck');
    });

    it('has no tier before the league has drafted, or for a league you are not in', async () => {
        global.fetch = vi.fn((url) => (url.includes('/rosters') ? jsonResponse(rosters) : jsonResponse(KTC)));

        expect(await myTierIn(league('A', { status: 'pre_draft' }), { userId: 'me', playerInfo })).toBeNull();
        expect(await myTierIn(league('A'), { userId: 'stranger', playerInfo })).toBeNull();
    });
});

describe('isMyRoster', () => {
    it('counts a co-owner as an owner', () => {
        expect(isMyRoster({ owner_id: 'a', co_owners: ['b'] }, 'b')).toBe(true);
        expect(isMyRoster({ owner_id: 'a' }, undefined)).toBe(false);
    });
});
