const appDB = 'https://sleeper-player-db-default-rtdb.firebaseio.com/';
const fta = 'https://fantasyteamassistant.com/';
const ftaLegacy = 'api/legacy/players';
const latestUpdateAttempt = 'latest_update_attempt/';
const activePlayers = 'active_players/';
const dlfADP = 'dlf_adp/';
const users = 'users/';
const typeParams = '.json?auth=';

const sleeperAPI = 'https://api.sleeper.app/';
const V1 = 'v1/';
const LEAGUE = 'league/';
const DRAFT = 'draft/';
const USER = 'user/521035584588267520/';
const ROSTERS = 'rosters/';
const SLEEPER_USERS = 'users/';
const LEAGUES = 'leagues/nfl/';
const YEAR = '2025';
const TRADED_PICKS = 'traded_picks/';
const PICKS = 'picks/';
const DRAFTS = 'drafts/';

const APP_DB_URLS = {
    APP_DB: appDB,
    LATEST_UPDATE_ATTEMPT: appDB + latestUpdateAttempt + typeParams,
    ACTIVE_PLAYERS: fta + ftaLegacy,
    DLF_ADP: appDB + dlfADP + typeParams,
    APP_USERS: appDB + users,
    TYPE_PARAMS: typeParams,
};

const SLEEPER_API_URLS = {
    LEAGUE: sleeperAPI + V1 + LEAGUE,
    ALL_LEAGUES_ACTIVE_YEAR: sleeperAPI + V1 + USER + LEAGUES + YEAR,
    DRAFT: sleeperAPI + V1 + DRAFT,
    ROSTERS: ROSTERS,
    SLEEPER_USERS: SLEEPER_USERS,
    TRADED_PICKS: TRADED_PICKS,
    PICKS: PICKS,
    DRAFTS: DRAFTS,
};

export default APP_DB_URLS;
export { SLEEPER_API_URLS };
