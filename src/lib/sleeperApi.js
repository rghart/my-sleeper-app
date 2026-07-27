import { auth } from '../firebase.js';
import { checkErrors } from './http.js';
import { decorateRosters } from './rosterInfo.js';
import { resolveLeagueSeason } from './sleeper.js';
import APP_DB_URLS, { SLEEPER_API_URLS } from '../urls.js';
const { LATEST_UPDATE_ATTEMPT, ACTIVE_PLAYERS } = APP_DB_URLS;
const { LEAGUE, USER_LEAGUES, NFL_STATE, DRAFT, ROSTERS, SLEEPER_USERS, TRADED_PICKS, DRAFTS } = SLEEPER_API_URLS;

// Every function here returns its data instead of writing it to state. That is
// the point of the module, not a stylistic preference: the two bugs in #96 and
// #98 were both "logic reads a value that has not settled yet", and both were
// only possible because a fetch wrote to state and something downstream read
// it straight back. A function that returns its result cannot be read early.
//
// Failures resolve to `undefined` rather than rejecting, matching fetchRequest
// in http.js. Callers must check before reading - that is the contract, and
// ignoring it is what caused #101 and #103.

/**
 * When the player database was last refreshed. Display-only.
 */
export async function fetchLatestUpdateAttempt() {
    return await fetch(LATEST_UPDATE_ATTEMPT + (await auth.currentUser.getIdToken(true)))
        .then(checkErrors)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error:', error);
        });
}

/**
 * The whole player database, keyed by player id.
 */
export async function fetchPlayerData() {
    return await fetch(ACTIVE_PLAYERS)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error:', error);
        });
}

/**
 * The season to request league data for. Falls back to the current calendar
 * year when the NFL state endpoint is unreachable, since every league URL
 * needs some season and a wrong one still renders.
 */
export async function fetchLeagueSeason() {
    return await fetch(NFL_STATE)
        .then(checkErrors)
        .then((response) => response.json())
        .then((nflState) => resolveLeagueSeason(nflState))
        .catch((error) => {
            console.error('Error fetching NFL state, falling back to current calendar year:', error);
            return String(new Date().getFullYear());
        });
}

/**
 * The five league requests that always travel together, resolved in parallel
 * and returned as one object with rosters already decorated. Resolves to
 * `undefined` if any of them fails - a partial league is not useful, and
 * silently rendering one is how a wrong board reaches the screen.
 */
export async function fetchLeagueBundle({ leagueID, season }) {
    const LEAGUE_PATH = LEAGUE + leagueID + '/';
    const urls = [
        LEAGUE_PATH + ROSTERS,
        LEAGUE_PATH + SLEEPER_USERS,
        LEAGUE_PATH,
        USER_LEAGUES(season),
        LEAGUE_PATH + DRAFTS,
    ];

    return await Promise.all(
        urls.map(async (url) => {
            const response = await fetch(url);
            return response.json();
        }),
    )
        .then(([rosterData, managerData, currentLeague, leagueIds, currentLeagueDrafts]) => ({
            rosterData: decorateRosters({ rosterData, managerData }),
            managerData,
            currentLeague,
            leagueIds,
            currentLeagueDrafts,
        }))
        .catch((error) => {
            console.error('Error:', error);
        });
}

/**
 * Picks that have changed hands. Returned rather than stored: threading this
 * value into the draft build as an argument is the fix from #98, where
 * round-tripping it through state meant the build read the previous value and
 * rendered every pick under its original roster.
 */
export async function fetchTradedDraftPicks(draftId) {
    return await fetch(DRAFT + draftId + '/' + TRADED_PICKS)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error:', error);
        });
}

/**
 * The draft's own settings. Resolves to `undefined` on failure, which callers
 * must substitute for - `DraftPanel` reads `currentDraft.draft_id`
 * unconditionally, so a missing object crashes the next render (#103).
 */
export async function fetchDraft(draftId) {
    return await fetch(DRAFT + draftId)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error:', error);
        });
}
