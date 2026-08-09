import { describe, expect, it } from 'vitest';
import APP_DB_URLS, { SLEEPER_API_URLS, SLEEPER_USER_ID } from './urls.js';

describe('SLEEPER_API_URLS.USER_LEAGUES', () => {
    // Pinned to the exact string the previous hardcoded ALL_LEAGUES_ACTIVE_YEAR
    // produced, so swapping the hand-edited YEAR constant for a season derived
    // from the API provably did not change the endpoint being called.
    it('builds the same URL the hardcoded 2026 constant used to produce', () => {
        expect(SLEEPER_API_URLS.USER_LEAGUES('2026')).toBe(
            'https://api.sleeper.app/v1/user/521035584588267520/leagues/nfl/2026',
        );
    });

    it('varies only by season', () => {
        expect(SLEEPER_API_URLS.USER_LEAGUES('2027')).toBe(
            'https://api.sleeper.app/v1/user/521035584588267520/leagues/nfl/2027',
        );
    });

    it('is built from SLEEPER_USER_ID rather than a second copy of the id', () => {
        expect(SLEEPER_API_URLS.USER_LEAGUES('2026')).toContain(SLEEPER_USER_ID);
    });
});

describe('other endpoints', () => {
    it('points NFL_STATE at the season-state endpoint', () => {
        expect(SLEEPER_API_URLS.NFL_STATE).toBe('https://api.sleeper.app/v1/state/nfl');
    });

    it('keeps the player DB path relative in dev so the Vite proxy handles CORS', () => {
        // import.meta.env.DEV is true under Vitest, matching the dev-server case.
        expect(APP_DB_URLS.ACTIVE_PLAYERS).toBe('/api/legacy/players');
    });

    it('keeps the availability path relative in dev too, and under a proxied prefix', () => {
        // Same CORS reasoning as ACTIVE_PLAYERS. The `/api/v1` prefix has to
        // match a `server.proxy` key in vite.config.mjs or dev requests go
        // to the Vite server itself and 404.
        expect(APP_DB_URLS.AVAILABILITY('123')).toBe('/api/v1/drafts/123/availability');
    });

    it('builds the league-intel path under the same proxied prefix', () => {
        expect(APP_DB_URLS.LEAGUE_INTEL('abc')).toBe('/api/v1/leagues/abc/intel');
    });

    it('builds the manager-activity path as a flat user route', () => {
        // Not nested under a league: the data spans every league they are in.
        expect(APP_DB_URLS.MANAGER_ACTIVITY('111')).toBe('/api/v1/users/111/activity');
    });
});
