import { describe, expect, it } from 'vitest';
import APP_DB_URLS, { SLEEPER_API_URLS } from './urls.js';

describe('SLEEPER_API_URLS.USER_LEAGUES', () => {
    // Still pinned to the exact string the old hardcoded user id produced, with
    // that id now passed in: the app went multi-user by taking the account as
    // an argument, and this proves the endpoint itself did not move.
    it('builds the same URL the hardcoded user id used to produce', () => {
        expect(SLEEPER_API_URLS.USER_LEAGUES('521035584588267520', '2026')).toBe(
            'https://api.sleeper.app/v1/user/521035584588267520/leagues/nfl/2026',
        );
    });

    it('varies by season', () => {
        expect(SLEEPER_API_URLS.USER_LEAGUES('521035584588267520', '2027')).toBe(
            'https://api.sleeper.app/v1/user/521035584588267520/leagues/nfl/2027',
        );
    });

    it('varies by user, which is the whole point of it taking one', () => {
        expect(SLEEPER_API_URLS.USER_LEAGUES('999', '2026')).toBe(
            'https://api.sleeper.app/v1/user/999/leagues/nfl/2026',
        );
    });
});

describe('SLEEPER_API_URLS.USER_BY_NAME', () => {
    it('builds the username lookup used to connect an account', () => {
        expect(SLEEPER_API_URLS.USER_BY_NAME('ryangh')).toBe('https://api.sleeper.app/v1/user/ryangh');
    });

    // Sleeper usernames are typed by hand into a form, so they reach this
    // function unsanitised - a name with a slash or a space in it would
    // otherwise change which endpoint is called rather than 404 honestly.
    it('escapes a username that would otherwise alter the path', () => {
        expect(SLEEPER_API_URLS.USER_BY_NAME('a/b c')).toBe('https://api.sleeper.app/v1/user/a%2Fb%20c');
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
