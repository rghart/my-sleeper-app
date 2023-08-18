import React from 'react';
import './App.css';
import './loader.css';
import Button from './Components/Button';
import LeaguePanel from './Panels/LeaguePanel';
import RanksPanel from './Panels/RanksPanel';
import firebase, { auth } from './firebase.js';
import createRankings from './helpers.js';
import APP_DB_URLS, { SLEEPER_API_URLS } from './urls.js';
const { LATEST_UPDATE_ATTEMPT, ACTIVE_PLAYERS } = APP_DB_URLS;
const { LEAGUE, ALL_LEAGUES_ACTIVE_YEAR, DRAFT, ROSTERS, SLEEPER_USERS, TRADED_PICKS, DRAFTS } = SLEEPER_API_URLS;
var provider = new firebase.auth.GoogleAuthProvider();

class App extends React.Component {
    state = {
        playerInfo: {},
        leagueData: [],
        tradedDraftPicks: [],
        isLoading: true,
        loadingMessage: 'Initial load...',
        rankingPlayersIdsList: [],
        isTyping: false,
        leagueID: '784538565915897856',
        rosterPositions: [],
        notFoundPlayers: [],
        lastUpdate: null,
        liveDraft: [],
        signedIn: false,
        signedInEmail: null,
    };

    componentDidMount() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                const { playerInfo } = this.state;
                const { currentUser } = auth;
                this.setState({
                    signedIn: !currentUser.isAnonymous,
                    signedInEmail: currentUser.email ? currentUser.email : null,
                });
                if (playerInfo && Object.keys(playerInfo).length === 0) {
                    this.getPlayerData();
                } else {
                    this.getLeagueData();
                }
            } else {
                auth.signInAnonymously().catch((err) => console.error('Error:', err));
            }
        });
    }
    // TODO clean up and pull out helper functions and search function into separate file(s)
    checkErrors = (response) => {
        if (!response.ok) {
            throw new Error(response.statusText, response.status);
        }
        return response;
    };

    fetchRequest = async (url, type, data, custHeaders) => {
        const response = await fetch(url, {
            method: type,
            headers: custHeaders
                ? custHeaders
                : {
                      'Content-type': 'application/json',
                  },
            body: data ? JSON.stringify(data) : null,
        })
            .then(this.checkErrors)
            .catch((err) => console.error('Error:', err));
        console.log(response.statusText);
        return response;
    };

    getLatestUpdateAttempt = async () => {
        return await fetch(LATEST_UPDATE_ATTEMPT + (await auth.currentUser.getIdToken(true)))
            .then(this.checkErrors)
            .then((response) => response.json())
            .then((data) => {
                this.setState({
                    lastUpdate: data,
                });
                return data;
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    };

    getPlayerData = async () => {
        this.getLatestUpdateAttempt();
        await fetch(ACTIVE_PLAYERS)
            .then((response) => response.json())
            .then((data) => {
                this.setState({
                    playerInfo: data,
                });
            })
            .catch((error) => {
                console.error('Error:', error);
            });
        this.getLeagueData();
    };

    getLeagueData = () => {
        const leagueID = this.state.leagueID;
        const LEAGUE_PATH = LEAGUE + leagueID + '/';
        const urls = [
            LEAGUE_PATH + ROSTERS,
            LEAGUE_PATH + SLEEPER_USERS,
            LEAGUE_PATH,
            ALL_LEAGUES_ACTIVE_YEAR,
            LEAGUE_PATH + DRAFTS,
        ];
        let requests = urls.map(async (url) => {
            const response = await fetch(url);
            return response.json();
        });
        Promise.all(requests)
            .then((data) => {
                const leagueData = {};
                [
                    leagueData.rosterData,
                    leagueData.managerData,
                    leagueData.currentLeague,
                    leagueData.leagueIds,
                    leagueData.currentLeagueDrafts,
                ] = data;
                this.markTakenPlayers(leagueData.rosterData, leagueData.managerData);
                this.setState(
                    {
                        leagueData: leagueData,
                        isLoading: false,
                        loadingMessage: 'Loading league panel...',
                        rosterPositions: leagueData.currentLeague.roster_positions
                            .filter((pos) => pos !== 'BN')
                            .map((pos) => {
                                if (pos === 'SUPER_FLEX') {
                                    return 'SFLX';
                                } else if (pos === 'FLEX') {
                                    return 'FLX';
                                } else {
                                    return pos;
                                }
                            }),
                    },
                    this.getTradedDraftPicks,
                );
                if (this.state.rankingPlayersIdsList.length > 0) {
                    this.setState({ rankingPlayersIdsList: [...this.state.rankingPlayersIdsList] });
                }
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    };

    getTradedDraftPicks = async () => {
        const draftId = this.state.leagueData.currentLeagueDrafts[0].draft_id;
        const DRAFT_PATH = DRAFT + draftId + '/';
        const tradedPicks = await fetch(DRAFT_PATH + TRADED_PICKS)
            .then((response) => response.json())
            .then((data) => data)
            .catch((error) => {
                console.error('Error:', error);
            });
        this.setState({
            tradedDraftPicks: tradedPicks,
        });
        this.getSpecificDraft();
    };

    getSpecificDraft = async () => {
        let { leagueData } = this.state;
        const draftId = leagueData.currentLeagueDrafts[0].draft_id;
        const DRAFT_PATH = DRAFT + draftId;
        const draftData = await fetch(DRAFT_PATH)
            .then((response) => response.json())
            .then((data) => data)
            .catch((error) => {
                console.error('Error:', error);
            });
        leagueData.currentDraft = draftData;
        this.setState({
            leagueData,
        });
        if (draftData.draft_order) {
            this.buildDraft();
        } else {
            this.setState({
                loadingMessage: '',
            });
        }
    };

    markTakenPlayers = (rosterData, managerData) => {
        let playerObject = this.state.playerInfo;
        if (this.state.rankingPlayersIdsList) {
            Object.keys(playerObject).forEach((i) => {
                if (playerObject[i]) {
                    playerObject[i].is_taken = false;
                    playerObject[i].rostered_by = null;
                    playerObject[i].in_lineup = false;
                }
            });
        }
        rosterData.forEach((roster) => {
            const currentManagerId = roster.owner_id;
            const currentManagerData = managerData.find((manager) => manager.user_id === currentManagerId);
            roster.manager_display_name = currentManagerData
                ? currentManagerData.display_name
                : 'Unassigned' + ' ' + roster.roster_id;
            roster.avatar = currentManagerData ? currentManagerData.avatar : null;
            if (roster.players) {
                roster.players.forEach((player) => {
                    if (playerObject[player]) {
                        playerObject[player].is_taken = true;
                        playerObject[player].rostered_by = roster.manager_display_name;
                    } else {
                        console.warn(
                            `Can't find player ID ${player} - may be a retired player that was removed from the database`,
                        );
                    }
                });
            }
        });
        this.setState({
            playerInfo: playerObject,
        });
    };

    updateParentState = (state, value, callback, loadingMessage) => {
        this.setState(
            {
                [state]: value,
                loadingMessage,
            },
            this[callback],
        );
    };

    startLoad = (loadMessage, searchText) => {
        this.setState(
            {
                loadingMessage: loadMessage,
            },
            () => setTimeout(() => this.updateRankings(searchText)),
            0,
        );
    };

    updateRankings = (searchText) => {
        const { playerInfo } = this.state;
        const [searchResultsArray, notFoundPlayers] = createRankings(searchText, playerInfo);

        this.setState({
            rankingPlayersIdsList: searchResultsArray,
            isLoading: false,
            loadingMessage: '',
            notFoundPlayers: notFoundPlayers,
            searchText: '',
        });
    };

    updatePlayerId = (searchData, deleting) => {
        let { rankingPlayersIdsList } = this.state;
        const currentIdIndex = rankingPlayersIdsList.findIndex((obj) => obj.ranking === searchData.ranking);
        if (deleting) {
            rankingPlayersIdsList.splice(currentIdIndex, 1);
            rankingPlayersIdsList.forEach((rankList, i) => (rankList.ranking = i + 1));
        } else {
            rankingPlayersIdsList.splice(currentIdIndex, 1, searchData);
        }
        this.setState({ rankingPlayersIdsList: rankingPlayersIdsList });
    };

    addToRoster = (player) => {
        let { rosterPositions, playerInfo } = this.state;
        if (player.position === 'TE' || player.position === 'RB' || player.position === 'WR') {
            player.fantasy_positions.push('FLX');
            player.fantasy_positions.push('SFLX');
        } else if (player.position === 'QB') {
            player.fantasy_positions.push('SFLX');
        }

        for (let i = 0; i < player.fantasy_positions.length; i++) {
            const includesPosition = rosterPositions.includes(player.fantasy_positions[i]);
            if (includesPosition) {
                const positionIndex = rosterPositions.indexOf(player.fantasy_positions[i]);
                player.roster_text = player.fantasy_positions[i];
                rosterPositions.splice(positionIndex, 1, player.player_id);
                break;
            }
        }
        player.in_lineup = true;
        playerInfo[player.player_id] = player;
        this.setState({
            playerInfo,
            rosterPositions,
        });
    };

    removeFromLineup = (id, i) => {
        const { rosterPositions, playerInfo } = this.state;
        rosterPositions.splice(i, 1, playerInfo[id].roster_text);
        playerInfo[id].in_lineup = false;
        this.setState({
            playerInfo,
            rosterPositions,
        });
    };

    buildDraft = () => {
        const { leagueData, tradedDraftPicks } = this.state;
        const { currentDraft } = leagueData;
        const { settings } = currentDraft;
        let draftType = '';
        switch (settings.player_type) {
            case 1:
                draftType = 'Rookie';
                break;
            case 2:
                draftType = 'Veteran';
                break;
            default:
                draftType = 'All players';
                break;
        }
        const createPickOrder = (round) => {
            let pickOrder = [];
            for (const [key, value] of Object.entries(currentDraft.slot_to_roster_id)) {
                const userID = leagueData.rosterData.find((roster) => roster.roster_id === value)
                    ? leagueData.rosterData.find((roster) => roster.roster_id === value).owner_id
                    : null;
                let obj = {
                    user_id: userID,
                    roster_id: value,
                    is_traded: false,
                    owner_id: value,
                    pick_round: round,
                    pick_number: Number(key),
                    board_spot: Number(key),
                    player_id: null,
                };
                pickOrder.push(obj);
            }
            pickOrder.sort((a, b) => a.pick_number - b.pick_number);
            if (currentDraft.type === 'snake' && round % 2 === 0) {
                pickOrder.reverse();
                pickOrder.forEach((pick, i) => {
                    pick.pick_number = i + 1;
                    return pick;
                });
            }

            return pickOrder;
        };

        let draftRounds = [];
        for (let i = 0; i < settings.rounds; i++) {
            let round = {};
            round.round = settings.rounds - i;
            round.picks = createPickOrder(round.round);
            draftRounds.unshift(round);
        }
        tradedDraftPicks.forEach((tradedPick) => {
            let draftRoundIndex = draftRounds[tradedPick.round - 1].picks.findIndex(
                (pick) => pick.roster_id === tradedPick.roster_id,
            );
            Object.assign(draftRounds[tradedPick.round - 1].picks[draftRoundIndex], {
                owner_id: tradedPick.owner_id,
                is_traded: true,
            });
        });
        leagueData.currentDraft.built_draft = draftRounds;
        leagueData.currentDraft.player_pool = draftType;
        this.setState({
            leagueData,
            loadingMessage: '',
        });
    };

    googleSignIn = () => {
        firebase
            .auth()
            .signInWithPopup(provider)
            .catch((error) => {
                console.log(error);
            });
    };

    signOut = () => {
        firebase
            .auth()
            .signOut()
            .then(() => {
                this.setState({
                    rankingPlayersIdsList: [],
                });
                console.log('Sign-out successful.');
            })
            .catch((error) => {
                // An error happened.
            });
    };

    render() {
        const {
            playerInfo,
            isLoading,
            lastUpdate,
            loadingMessage,
            rankingPlayersIdsList,
            rosterPositions,
            leagueData,
            notFoundPlayers,
            leagueID,
            signedIn,
            signedInEmail,
        } = this.state;
        if (isLoading && loadingMessage === 'Initial load...') {
            return <div className="loader"></div>;
        } else {
            return (
                <div>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            padding: `${0}px ${3}px`,
                        }}
                    >
                        <h1 className="title">Sleeper Team Assistant</h1>
                        {signedIn ? (
                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
                                <p className="latest-update">
                                    <i>{signedInEmail}</i>
                                </p>
                                <Button text="Sign out" onClick={this.signOut} btnStyle="primary" />
                            </div>
                        ) : (
                            <Button text="Sign in" onClick={this.googleSignIn} btnStyle="primary" />
                        )}
                    </div>
                    <p className="latest-update">
                        <i>Latest player DB update attempt: {new Date(lastUpdate).toString()}</i>
                    </p>
                    <div className="main-container">
                        <RanksPanel
                            loadingMessage={loadingMessage}
                            signedIn={signedIn}
                            playerInfo={playerInfo}
                            updateFilter={this.updateParentState}
                            startLoad={this.startLoad}
                            fetchRequest={this.fetchRequest}
                            checkErrors={this.checkErrors}
                            addToRoster={this.addToRoster}
                            updatePlayerId={this.updatePlayerId}
                            notFoundPlayers={notFoundPlayers}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                        />
                        <LeaguePanel
                            leagueData={leagueData}
                            leagueID={leagueID}
                            updateParentState={this.updateParentState}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            rosterPositions={rosterPositions}
                            playerInfo={playerInfo}
                            loadingMessage={loadingMessage}
                            removeFromLineup={this.removeFromLineup}
                        />
                    </div>
                </div>
            );
        }
    }
}

export default App;
