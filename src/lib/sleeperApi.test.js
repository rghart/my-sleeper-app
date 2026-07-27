import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    fetchDraft,
    fetchLatestUpdateAttempt,
    fetchLeagueBundle,
    fetchLeagueSeason,
    fetchPlayerData,
    fetchTradedDraftPicks,
} from './sleeperApi.js';
import rosterFlagsFixture from './__fixtures__/roster-flags-2026.json';

vi.mock('../firebase.js', () => ({
    auth: { currentUser: { uid: 'test-uid', getIdToken: vi.fn().mockResolvedValue('test-id-token') } },
    googleProvider: {},
}));

const { rosterDataRaw, managerData } = rosterFlagsFixture;

const jsonResponse = (data) => Promise.resolve({ ok: true, statusText: 'OK', json: () => Promise.resolve(data) });

describe('sleeperApi', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchLeagueBundle', () => {
        const bundleFetch = (url) => {
            if (url.includes('/rosters/')) return jsonResponse(structuredClone(rosterDataRaw));
            if (url.includes('/users/')) return jsonResponse(structuredClone(managerData));
            if (url.includes('/drafts/')) return jsonResponse([{ draft_id: 'draft123' }]);
            if (url.includes('leagues/nfl/')) return jsonResponse([{ league_id: '1', name: 'Test League' }]);
            return jsonResponse({ league_id: '1', name: 'Test League', roster_positions: ['QB', 'BN'] });
        };

        it('returns the five league responses as one object, with rosters decorated', async () => {
            global.fetch = vi.fn(bundleFetch);

            const bundle = await fetchLeagueBundle({ leagueID: '1', season: '2026' });

            expect(Object.keys(bundle).sort()).toEqual(
                ['currentLeague', 'currentLeagueDrafts', 'leagueIds', 'managerData', 'rosterData'].sort(),
            );
            // Decoration is what turns owner_id into a display name; skipping it
            // is the exact regression App.test.jsx was originally written for.
            expect(bundle.rosterData[0].manager_display_name).toBeTruthy();
        });

        it('requests all five in parallel rather than in sequence', async () => {
            let inFlight = 0;
            let peak = 0;
            global.fetch = vi.fn((url) => {
                inFlight += 1;
                peak = Math.max(peak, inFlight);
                return bundleFetch(url).then((r) => {
                    inFlight -= 1;
                    return r;
                });
            });

            await fetchLeagueBundle({ leagueID: '1', season: '2026' });

            expect(peak).toBe(5);
        });

        it('resolves to undefined if any one of the five fails', async () => {
            // A partial league is not useful, and rendering one silently is how
            // a wrong board reaches the screen.
            global.fetch = vi.fn((url) =>
                url.includes('/drafts/') ? Promise.reject(new Error('down')) : bundleFetch(url),
            );

            await expect(fetchLeagueBundle({ leagueID: '1', season: '2026' })).resolves.toBeUndefined();
        });
    });

    describe('fetchLeagueSeason', () => {
        it('resolves the season from NFL state', async () => {
            global.fetch = vi.fn(() => jsonResponse({ league_season: '2026' }));
            expect(await fetchLeagueSeason()).toBe('2026');
        });

        it('falls back to the current calendar year when NFL state is unreachable', async () => {
            // Every league URL needs some season, and a wrong one still renders
            // - so this failure degrades rather than blocking the whole load.
            global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
            expect(await fetchLeagueSeason()).toBe(String(new Date().getFullYear()));
        });

        it('falls back when NFL state returns a non-ok response', async () => {
            global.fetch = vi.fn(() => Promise.resolve({ ok: false, statusText: 'Bad Gateway' }));
            expect(await fetchLeagueSeason()).toBe(String(new Date().getFullYear()));
        });
    });

    describe('the requests that must resolve to undefined on failure', () => {
        // Every caller checks for undefined before reading. #101 and #103 were
        // both a property read on one of these before the check.
        const cases = [
            ['fetchDraft', () => fetchDraft('draft123')],
            ['fetchTradedDraftPicks', () => fetchTradedDraftPicks('draft123')],
            ['fetchPlayerData', () => fetchPlayerData()],
            ['fetchLatestUpdateAttempt', () => fetchLatestUpdateAttempt()],
        ];

        for (const [name, call] of cases) {
            it(`${name} resolves to undefined rather than rejecting`, async () => {
                global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
                await expect(call()).resolves.toBeUndefined();
            });
        }
    });

    it('fetchDraft returns the draft settings on success', async () => {
        global.fetch = vi.fn(() => jsonResponse({ draft_id: 'draft123', draft_order: {} }));
        expect(await fetchDraft('draft123')).toEqual({ draft_id: 'draft123', draft_order: {} });
    });

    it('fetchTradedDraftPicks returns the picks on success', async () => {
        global.fetch = vi.fn(() => jsonResponse([{ round: 1, roster_id: 2, owner_id: 3 }]));
        expect(await fetchTradedDraftPicks('draft123')).toHaveLength(1);
    });
});
