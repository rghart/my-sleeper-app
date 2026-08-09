import { checkErrors, fetchRequest } from './http.js';
import APP_DB_URLS from '../urls.js';

const { APP_USERS, TYPE_PARAMS } = APP_DB_URLS;

// Which Sleeper account the app is pointed at. This is a second, independent
// identity from the Firebase one: Firebase says who you are to *this app* and
// owns your saved rank lists, while this says whose leagues, rosters and picks
// to render. They are deliberately not the same thing - Sleeper has no OAuth,
// so there is no way to prove the person holding a Google account owns the
// Sleeper username they typed, and pretending otherwise would be a claim the
// app cannot back up. Connecting an account is "show me this manager's
// leagues", not "log in as them".
//
// Because of that split, a connected account has to survive with no Firebase
// sign-in at all, which is what localStorage is for below. Signing in with
// Google adds roaming on top, nothing more.

export const SLEEPER_ACCOUNT_KEY = 'sleeper.account';

// The key the account is stored under inside the `users/{uid}` record. That
// record is also where every saved rank list lives, keyed by its route name,
// so this name is reserved - see readSavedRankLists in App for the read side
// that has to keep the two apart.
export const REMOTE_ACCOUNT_KEY = 'sleeper_account';

/**
 * Narrows an arbitrary value to a usable account, or null. Both storage sides
 * run everything they read through this: localStorage is user-editable, the
 * database record predates this feature, and a half-written account is worse
 * than none - it would send `undefined` into a Sleeper URL and 404 every
 * league request with no obvious cause.
 */
export function normalizeAccount(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const { userId, username } = value;
    // Sleeper ids are numeric but must stay strings: they exceed Number's safe
    // integer range, so a round trip through a number silently corrupts the
    // last digits and every request built from it quietly asks about someone
    // else.
    if (typeof userId !== 'string' || userId === '') {
        return null;
    }
    return { userId, username: typeof username === 'string' && username ? username : null };
}

/**
 * The connected account for a signed-out visitor, and the fallback for a
 * signed-in one whose database record has nothing in it yet.
 */
export function readLocalAccount() {
    try {
        return normalizeAccount(JSON.parse(window.localStorage.getItem(SLEEPER_ACCOUNT_KEY)));
    } catch (error) {
        // Unparseable, or storage blocked entirely (Safari private mode throws
        // on access, not just on write). Either way the app is simply not
        // connected yet, which is a state it already renders.
        console.error('Could not read the stored Sleeper account:', error);
        return null;
    }
}

export function writeLocalAccount(account) {
    try {
        if (account) {
            window.localStorage.setItem(SLEEPER_ACCOUNT_KEY, JSON.stringify(account));
        } else {
            window.localStorage.removeItem(SLEEPER_ACCOUNT_KEY);
        }
        return true;
    } catch (error) {
        console.error('Could not store the Sleeper account:', error);
        return false;
    }
}

/**
 * The signed-in user's account as the database has it. Resolves to `undefined`
 * on failure rather than null, so callers can tell "the request failed" from
 * "this user has not connected one" - the difference matters, because
 * promoting a local account on a failed read would overwrite a good remote one
 * with whatever this device happened to have.
 */
export async function readRemoteAccount(user) {
    const result = await fetch(
        APP_USERS + user.uid + '/' + REMOTE_ACCOUNT_KEY + TYPE_PARAMS + (await user.getIdToken()),
    )
        .then(checkErrors)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Could not read the saved Sleeper account:', error);
            return undefined;
        });
    return result === undefined ? undefined : normalizeAccount(result);
}

export async function writeRemoteAccount(user, account) {
    const url = APP_USERS + user.uid + '/' + REMOTE_ACCOUNT_KEY + TYPE_PARAMS + (await user.getIdToken());
    const response = account ? await fetchRequest(url, 'PUT', account) : await fetchRequest(url, 'DELETE');
    return Boolean(response && response.ok);
}

const LAST_LEAGUE_KEY = 'sleeper.lastLeague';

/**
 * The league this account was last looking at. Keyed by Sleeper user id, so
 * two accounts used on one browser do not inherit each other's league.
 *
 * This exists because the starting league used to be a hardcoded id: you
 * always reopened the app on the same league, and picking "whatever Sleeper
 * lists first" instead would have quietly made that stop being true.
 */
export function readLastLeagueId(userId) {
    try {
        const byUser = JSON.parse(window.localStorage.getItem(LAST_LEAGUE_KEY));
        const leagueId = byUser && typeof byUser === 'object' ? byUser[userId] : null;
        return typeof leagueId === 'string' && leagueId ? leagueId : null;
    } catch (error) {
        console.error('Could not read the last league:', error);
        return null;
    }
}

export function writeLastLeagueId(userId, leagueId) {
    try {
        const raw = JSON.parse(window.localStorage.getItem(LAST_LEAGUE_KEY));
        const byUser = raw && typeof raw === 'object' ? raw : {};
        window.localStorage.setItem(LAST_LEAGUE_KEY, JSON.stringify({ ...byUser, [userId]: leagueId }));
    } catch (error) {
        console.error('Could not store the last league:', error);
    }
}

/**
 * Which league to open on: the one this account was last on, but only if they
 * are still in it - a league that was left, or that has rolled over to a new
 * season, is no longer in the list and would otherwise load into an error.
 * Falls back to Sleeper's own first league, and to null when there are none.
 */
export function pickStartingLeague({ leagues, lastLeagueId }) {
    if (!Array.isArray(leagues) || leagues.length === 0) {
        return null;
    }
    const remembered = leagues.find((league) => league.league_id === lastLeagueId);
    return remembered ? remembered.league_id : leagues[0].league_id;
}

/**
 * Which account wins when a device has one stored locally and the signed-in
 * user has one saved in the database, and what to write back afterwards.
 *
 * The remote one wins, because roaming is the only reason it exists: if you
 * connected an account on your phone, opening the app on a laptop that was
 * pointed somewhere else should follow your account, not have the laptop
 * quietly overwrite it. When there is no remote one, the local account is
 * promoted up instead, so connecting-then-signing-in doesn't lose the account
 * you just typed.
 *
 * Pure and separate from the storage above so the precedence can be tested
 * without a database or a browser - it is the part with actual behaviour in
 * it, and the part that is easy to get backwards.
 */
export function reconcileAccounts({ local, remote }) {
    // `undefined` means the read failed, which is not evidence that the user
    // has no saved account - so do not promote over it.
    if (remote === undefined) {
        return { account: local || null, promote: false };
    }
    if (remote) {
        return { account: remote, promote: false };
    }
    return { account: local || null, promote: Boolean(local) };
}
