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
});
