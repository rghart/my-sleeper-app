import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    SLEEPER_ACCOUNT_KEY,
    normalizeAccount,
    pickStartingLeague,
    readLastLeagueId,
    readLocalAccount,
    reconcileAccounts,
    writeLastLeagueId,
    writeLocalAccount,
} from './sleeperIdentity.js';

const ACCOUNT = { userId: '521035584588267520', username: 'ryangh' };
const OTHER = { userId: '325371992242946048', username: 'kpresley' };

describe('normalizeAccount', () => {
    it('keeps a well-formed account', () => {
        expect(normalizeAccount(ACCOUNT)).toEqual(ACCOUNT);
    });

    // The id is what every league URL is built from, so a missing or wrongly
    // typed one has to fail here rather than reaching a request as `undefined`
    // and 404ing with no obvious cause.
    it.each([
        ['null', null],
        ['a string', 'ryangh'],
        ['an account with no id', { username: 'ryangh' }],
        ['an account with an empty id', { userId: '', username: 'ryangh' }],
    ])('rejects %s', (_label, value) => {
        expect(normalizeAccount(value)).toBeNull();
    });

    // Sleeper ids are past Number.MAX_SAFE_INTEGER, so a numeric one has
    // already lost its last digits by the time it gets here - it would name a
    // different manager, silently.
    it('rejects a numeric id rather than coercing it', () => {
        expect(normalizeAccount({ userId: 521035584588267520, username: 'ryangh' })).toBeNull();
    });

    it('tolerates a missing username, which is only ever displayed', () => {
        expect(normalizeAccount({ userId: '123' })).toEqual({ userId: '123', username: null });
    });
});

describe('local storage', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('round-trips a connected account', () => {
        writeLocalAccount(ACCOUNT);
        expect(readLocalAccount()).toEqual(ACCOUNT);
    });

    it('reads nothing when no account has been connected', () => {
        expect(readLocalAccount()).toBeNull();
    });

    it('clears the account when written null', () => {
        writeLocalAccount(ACCOUNT);
        writeLocalAccount(null);
        expect(readLocalAccount()).toBeNull();
    });

    // localStorage is user-editable and survives across app versions, so this
    // is a real input, not a hypothetical one.
    it('treats unparseable stored data as not connected', () => {
        window.localStorage.setItem(SLEEPER_ACCOUNT_KEY, 'not json');
        expect(readLocalAccount()).toBeNull();
    });

    it('treats a half-written account as not connected', () => {
        window.localStorage.setItem(SLEEPER_ACCOUNT_KEY, JSON.stringify({ username: 'ryangh' }));
        expect(readLocalAccount()).toBeNull();
    });

    it('reports failure rather than throwing when storage is unavailable', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        expect(writeLocalAccount(ACCOUNT)).toBe(false);
    });

    it('remembers the last league per account, so two accounts do not collide', () => {
        writeLastLeagueId(ACCOUNT.userId, 'league-a');
        writeLastLeagueId(OTHER.userId, 'league-b');

        expect(readLastLeagueId(ACCOUNT.userId)).toBe('league-a');
        expect(readLastLeagueId(OTHER.userId)).toBe('league-b');
    });

    it('has no last league for an account that has not picked one', () => {
        expect(readLastLeagueId(ACCOUNT.userId)).toBeNull();
    });
});

describe('pickStartingLeague', () => {
    const leagues = [{ league_id: 'first' }, { league_id: 'second' }];

    it('opens on the league this account was last on', () => {
        expect(pickStartingLeague({ leagues, lastLeagueId: 'second' })).toBe('second');
    });

    // The remembered league can name one they have left, or last season's copy
    // of one they are still in. Both are absent from the list, and loading
    // either would land on an error page instead of a league.
    it('falls back to the first league when the remembered one is gone', () => {
        expect(pickStartingLeague({ leagues, lastLeagueId: 'deleted' })).toBe('first');
    });

    it('opens on the first league when nothing is remembered', () => {
        expect(pickStartingLeague({ leagues, lastLeagueId: null })).toBe('first');
    });

    it('has nothing to open when the account is in no leagues', () => {
        expect(pickStartingLeague({ leagues: [], lastLeagueId: null })).toBeNull();
    });

    // fetchUserLeagues resolves to undefined on failure, per the api module's
    // contract, and this is the thing that receives it.
    it('has nothing to open when the league request failed', () => {
        expect(pickStartingLeague({ leagues: undefined, lastLeagueId: 'second' })).toBeNull();
    });
});

describe('reconcileAccounts', () => {
    // Roaming is the only reason the saved copy exists: a laptop pointed
    // somewhere else must follow the signed-in account, not overwrite it.
    it('prefers the saved account over the one on this device', () => {
        expect(reconcileAccounts({ local: OTHER, remote: ACCOUNT })).toEqual({ account: ACCOUNT, promote: false });
    });

    it('promotes the local account when the user has none saved yet', () => {
        expect(reconcileAccounts({ local: ACCOUNT, remote: null })).toEqual({ account: ACCOUNT, promote: true });
    });

    it('has nothing to do when neither side has one', () => {
        expect(reconcileAccounts({ local: null, remote: null })).toEqual({ account: null, promote: false });
    });

    // The distinction this whole three-way exists for: `undefined` is a failed
    // read, not an absent account. Promoting over it would overwrite a good
    // saved account with whatever this device happened to have.
    it('does not promote over a failed read of the saved account', () => {
        expect(reconcileAccounts({ local: OTHER, remote: undefined })).toEqual({ account: OTHER, promote: false });
    });

    it('still renders the local account when the saved read failed', () => {
        expect(reconcileAccounts({ local: ACCOUNT, remote: undefined }).account).toEqual(ACCOUNT);
    });
});
