import { checkErrors } from './http.js';
import { decorateRosters } from './rosterInfo.js';
import { resolveLeagueSeason } from './sleeper.js';
import APP_DB_URLS, { SLEEPER_API_URLS } from '../urls.js';
const { ACTIVE_PLAYERS, AVAILABILITY, LEAGUE_INTEL } = APP_DB_URLS;
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

/**
 * Leaguemate intel for a draft: who owns every remaining pick, and for each
 * player asked about, the odds they last to each of those picks
 * (docs/leaguemate-intel.md §3e).
 *
 * `playerIds` is the caller's own rank list. Sending it is what makes the
 * answer line up with the rows already on screen - without it the API picks
 * its own 20 targets by league ADP, which need not overlap the list at all.
 * A player the corpus has never seen is simply absent from `targets`; that is
 * the honest "no read", not an error, and the caller renders it as one.
 *
 * `atPick` is only for hypotheticals ("if I trade up to 30"). The response
 * carries the whole `byPick` matrix for every remaining pick, so moving the
 * pick selector between picks that are already on the board needs no refetch.
 *
 * Resolves to `undefined` on failure, per this module's contract. Intel is
 * additive - a rank list with no intel is exactly the list this app rendered
 * before the feature existed, so callers drop the extra column rather than
 * failing the whole sheet.
 */
/**
 * Who your leaguemates are and what they do in their other leagues
 * (docs/leaguemate-intel.md §3e) - how many leagues and drafts each is in,
 * their repeated targets, positional lean and reach-vs-ADP, plus a `corpus`
 * block saying how much was actually observed and when it was last crawled.
 *
 * `corpus` is not decoration: every tendency here is measured over a sample
 * that varies from 1 draft to 30, and a figure without its sample size is the
 * failure this feature keeps re-learning.
 *
 * Resolves to `undefined` on failure, per this module's contract.
 */
export async function fetchLeagueIntel({ leagueId, season }) {
    const params = new URLSearchParams(season ? { season } : {});

    return await fetch(`${LEAGUE_INTEL(leagueId)}?${params}`)
        .then(checkErrors)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error fetching league intel:', error);
        });
}

export async function fetchAvailability({ draftId, userId, playerIds, atPick }) {
    const params = new URLSearchParams({ user_id: userId });
    // Left off entirely when empty rather than sent blank: an empty rank list
    // and "no opinion about which players" are different questions, and only
    // the second one wants the API to choose targets for itself.
    if (playerIds?.length) params.set('player_ids', playerIds.join(','));
    if (atPick != null) params.set('at_pick', String(atPick));

    return await fetch(`${AVAILABILITY(draftId)}?${params}`)
        .then(checkErrors)
        .then((response) => response.json())
        .catch((error) => {
            console.error('Error fetching leaguemate intel:', error);
        });
}
