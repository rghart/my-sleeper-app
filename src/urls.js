const appDB = 'https://sleeper-player-db-default-rtdb.firebaseio.com/';
// In dev this is left relative so it goes through the Vite proxy (see
// vite.config.mjs) — the API only sends CORS headers for the deployed origin,
// so a direct cross-origin request from localhost is blocked by the browser.
const fta = import.meta.env.DEV ? '/' : 'https://fantasyteamassistant.com/';
const ftaLegacy = 'api/legacy/players';
const ftaAvailability = (draftId) => `api/v1/drafts/${draftId}/availability`;
const ftaMarketValues = 'api/v1/values';
const ftaDynastyValues = 'api/v1/dynasty-values';
const ftaFaab = 'api/v1/faab';
const ftaLeagueIntel = (leagueId) => `api/v1/leagues/${leagueId}/intel`;
const ftaLeagueTrades = (leagueId) => `api/v1/leagues/${leagueId}/trades`;
const ftaManagerActivity = (userId) => `api/v1/users/${userId}/activity`;
const latestUpdateAttempt = 'latest_update_attempt/';
const dlfADP = 'dlf_adp/';
const users = 'users/';
const typeParams = '.json?auth=';

const sleeperAPI = 'https://api.sleeper.app/';
const V1 = 'v1/';
const LEAGUE = 'league/';
const DRAFT = 'draft/';
const USER = 'user/';
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
    // The market's current dynasty values, best player first, keyed by
    // Sleeper id. A rank list the user does not have to supply - see
    // lib/marketValues.js for what is and is not claimed about it.
    MARKET_VALUES: fta + ftaMarketValues,
    // KeepTradeCut values and how far each has moved. Distinct from
    // MARKET_VALUES above, and the two are not interchangeable: that one is
    // FantasyCalc and *seeds* a rank list for a league shape, this one is KTC
    // and *decorates* rows that already exist. It is also the only source
    // that can price a draft pick.
    DYNASTY_VALUES: fta + ftaDynastyValues,
    FAAB: fta + ftaFaab,
    // The leaguemates of one league, and what they do in their other ones
    // (docs/leaguemate-intel.md §3e). Keyed by league despite being the
    // "cross-league" view - the cross-league part is what the managers do
    // elsewhere, not what the request spans.
    LEAGUE_INTEL: (leagueId) => fta + ftaLeagueIntel(leagueId),
    // Trades the asking manager and each leaguemate might both want. Keyed
    // by league because it is about these twelve rosters, and read live -
    // a suggestion built on last night's roster is about a team that no
    // longer exists.
    LEAGUE_TRADES: (leagueId) => fta + ftaLeagueTrades(leagueId),
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
    // Both keyed by the connected Sleeper account rather than a constant: the
    // app used to be pinned to one hardcoded user id, and every one of these
    // is a place that pinning leaked into a URL.
    USER_LEAGUES: (userId, season) => sleeperAPI + V1 + USER + userId + '/' + LEAGUES + season,
    // Sleeper has no OAuth, so a username lookup is the whole "connect your
    // account" handshake: this resolves the name someone types to the
    // `user_id` every other request here is built from.
    USER_BY_NAME: (username) => sleeperAPI + V1 + USER + encodeURIComponent(username),
    NFL_STATE: sleeperAPI + V1 + STATE,
    DRAFT: sleeperAPI + V1 + DRAFT,
    ROSTERS: ROSTERS,
    SLEEPER_USERS: SLEEPER_USERS,
    TRADED_PICKS: TRADED_PICKS,
    PICKS: PICKS,
    DRAFTS: DRAFTS,
};

export default APP_DB_URLS;
export { SLEEPER_API_URLS };
