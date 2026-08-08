const appDB = 'https://sleeper-player-db-default-rtdb.firebaseio.com/';
// In dev this is left relative so it goes through the Vite proxy (see
// vite.config.mjs) — the API only sends CORS headers for the deployed origin,
// so a direct cross-origin request from localhost is blocked by the browser.
const fta = import.meta.env.DEV ? '/' : 'https://fantasyteamassistant.com/';
const ftaLegacy = 'api/legacy/players';
const ftaAvailability = (draftId) => `api/v1/drafts/${draftId}/availability`;
const ftaLeagueIntel = (leagueId) => `api/v1/leagues/${leagueId}/intel`;
const ftaManagerActivity = (userId) => `api/v1/users/${userId}/activity`;
const latestUpdateAttempt = 'latest_update_attempt/';
const dlfADP = 'dlf_adp/';
const users = 'users/';
const typeParams = '.json?auth=';

const sleeperAPI = 'https://api.sleeper.app/';
const V1 = 'v1/';
const LEAGUE = 'league/';
const DRAFT = 'draft/';
const SLEEPER_USER_ID = '521035584588267520';
const USER = 'user/' + SLEEPER_USER_ID + '/';
const ROSTERS = 'rosters/';
const SLEEPER_USERS = 'users/';
const LEAGUES = 'leagues/nfl/';
const TRADED_PICKS = 'traded_picks/';
const PICKS = 'picks/';
const DRAFTS = 'drafts/';
const STATE = 'state/nfl';

const APP_DB_URLS = {
    APP_DB: appDB,
    LATEST_UPDATE_ATTEMPT: appDB + latestUpdateAttempt + typeParams,
    ACTIVE_PLAYERS: fta + ftaLegacy,
    // Leaguemate intel (docs/leaguemate-intel.md §3e). Same origin and the
    // same dev-relative treatment as ACTIVE_PLAYERS above - see the comment
    // on `fta` about why localhost must go through the Vite proxy.
    AVAILABILITY: (draftId) => fta + ftaAvailability(draftId),
    // The leaguemates of one league, and what they do in their other ones
    // (docs/leaguemate-intel.md §3e). Keyed by league despite being the
    // "cross-league" view - the cross-league part is what the managers do
    // elsewhere, not what the request spans.
    LEAGUE_INTEL: (leagueId) => fta + ftaLeagueIntel(leagueId),
    // One leaguemate's recent trades, waivers and free-agent adds, across
    // every league they are in. Not nested under a league on purpose - the
    // data spans all of theirs, so a league in the path would imply a filter
    // that does not happen.
    MANAGER_ACTIVITY: (userId) => fta + ftaManagerActivity(userId),
    DLF_ADP: appDB + dlfADP + typeParams,
    APP_USERS: appDB + users,
    TYPE_PARAMS: typeParams,
};

const SLEEPER_API_URLS = {
    LEAGUE: sleeperAPI + V1 + LEAGUE,
    USER_LEAGUES: (season) => sleeperAPI + V1 + USER + LEAGUES + season,
    NFL_STATE: sleeperAPI + V1 + STATE,
    DRAFT: sleeperAPI + V1 + DRAFT,
    ROSTERS: ROSTERS,
    SLEEPER_USERS: SLEEPER_USERS,
    TRADED_PICKS: TRADED_PICKS,
    PICKS: PICKS,
    DRAFTS: DRAFTS,
};

export default APP_DB_URLS;
export { SLEEPER_API_URLS, SLEEPER_USER_ID };
