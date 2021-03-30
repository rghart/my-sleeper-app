const appDB = 'https://sleeper-player-db-default-rtdb.firebaseio.com/';
const latestUpdateAttempt = 'latest_update_attempt/';
const activePlayers = 'active_players/';
const users = 'users/';
const typeParams = '.json?auth=';

const URLS = {
    APP_DB: appDB,
    LATEST_UPDATE_ATTEMPT: appDB + latestUpdateAttempt + typeParams,
    ACTIVE_PLAYERS: appDB + activePlayers + typeParams,
    USERS: appDB + users,
    TYPE_PARAMS: typeParams,
}

export default URLS;