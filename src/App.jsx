import React from 'react';
import './App.css';
import './loader.css';
import Button from './Components/Button';
import LeaguePanel from './Panels/LeaguePanel';
import RanksPanel from './Panels/RanksPanel';
import { onAuthStateChanged, signInAnonymously, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import createRankings from './helpers.js';
import { buildDraftRounds } from './lib/draft.js';
import { addPlayerToRoster, removePlayerFromLineup } from './lib/roster.js';
import { buildLineupSet, decorateRosters, memoizeRosterInfo } from './lib/rosterInfo.js';
import { resolveLeagueSeason, resolveMyDisplayName } from './lib/sleeper.js';
import APP_DB_URLS, { SLEEPER_API_URLS, SLEEPER_USER_ID } from './urls.js';
const { LATEST_UPDATE_ATTEMPT, ACTIVE_PLAYERS } = APP_DB_URLS;
const { LEAGUE, USER_LEAGUES, NFL_STATE, DRAFT, ROSTERS, SLEEPER_USERS, TRADED_PICKS, DRAFTS } = SLEEPER_API_URLS;

class App extends React.Component {
    state = {
        playerInfo: {},
        leagueData: [],
        tradedDraftPicks: [],
        isLoading: true,
        loadingMessage: 'Initial load...',
        rankingPlayersIdsList: [],
        isTyping: false,
        leagueID: '1312088290526003200',
        rosterPositions: [],
        notFoundPlayers: [],
        lastUpdate: null,
        liveDraft: [],
        signedIn: false,
        signedInEmail: null,
        season: null,
        myDisplayName: null,
    };

    selectRosterInfo = memoizeRosterInfo();

    componentDidMount() {
        onAuthStateChanged(auth, (user) => {
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
                signInAnonymously(auth).catch((err) => console.error('Error:', err));
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
        if (response) {
            console.log(response.statusText);
        }
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

    getLeagueSeason = async () => {
        return await fetch(NFL_STATE)
            .then(this.checkErrors)
            .then((response) => response.json())
            .then((nflState) => resolveLeagueSeason(nflState))
            .catch((error) => {
                console.error('Error fetching NFL state, falling back to current calendar year:', error);
                return String(new Date().getFullYear());
            });
    };

    getLeagueData = async () => {
        const leagueID = this.state.leagueID;
        const LEAGUE_PATH = LEAGUE + leagueID + '/';
        const season = this.state.season ? this.state.season : await this.getLeagueSeason();
        if (!this.state.season) {
            this.setState({ season });
        }
        const urls = [
            LEAGUE_PATH + ROSTERS,
            LEAGUE_PATH + SLEEPER_USERS,
            LEAGUE_PATH,
            USER_LEAGUES(season),
            LEAGUE_PATH + DRAFTS,
        ];
        const requests = urls.map(async (url) => {
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
                leagueData.rosterData = decorateRosters({
                    rosterData: leagueData.rosterData,
                    managerData: leagueData.managerData,
                });
                this.warnAboutMissingRosterPlayers(leagueData.rosterData);
                this.setState(
                    {
                        leagueData: leagueData,
                        isLoading: false,
                        loadingMessage: 'Loading league panel...',
                        myDisplayName: resolveMyDisplayName(leagueData.managerData, SLEEPER_USER_ID),
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
        const { leagueData } = this.state;
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

    // Diagnostic carried over from the old markTakenPlayers: a roster player id
    // that isn't in the player DB is usually a retired player that was removed
    // from it. Purely informational - it doesn't affect what gets rendered.
    warnAboutMissingRosterPlayers = (rosterData) => {
        const { playerInfo } = this.state;
        rosterData.forEach((roster) => {
            (roster.players || []).forEach((player) => {
                if (!playerInfo[player]) {
                    console.warn(
                        `Can't find player ID ${player} - may be a retired player that was removed from the database`,
                    );
                }
            });
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
            () => setTimeout(() => this.updateRankings(searchText), 0),
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
        const { rankingPlayersIdsList } = this.state;
        const currentIdIndex = rankingPlayersIdsList.findIndex((obj) => obj.ranking === searchData.ranking);
        let newRankingPlayersIdsList;
        if (deleting) {
            newRankingPlayersIdsList = rankingPlayersIdsList
                .filter((_, i) => i !== currentIdIndex)
                .map((rankList, i) => ({ ...rankList, ranking: i + 1 }));
        } else {
            newRankingPlayersIdsList = [...rankingPlayersIdsList];
            newRankingPlayersIdsList.splice(currentIdIndex, 1, searchData);
        }
        this.setState({ rankingPlayersIdsList: newRankingPlayersIdsList });
    };

    addToRoster = (player) => {
        const { rosterPositions, playerInfo } = this.state;
        const updated = addPlayerToRoster({ player, rosterPositions, playerInfo });
        this.setState({
            playerInfo: updated.playerInfo,
            rosterPositions: updated.rosterPositions,
        });
    };

    removeFromLineup = (id, i) => {
        const { rosterPositions, playerInfo } = this.state;
        const updated = removePlayerFromLineup({ id, i, rosterPositions, playerInfo });
        this.setState({
            playerInfo: updated.playerInfo,
            rosterPositions: updated.rosterPositions,
        });
    };

    buildDraft = () => {
        const { leagueData, tradedDraftPicks } = this.state;
        const { currentDraft, rosterData } = leagueData;
        const { built_draft, player_pool } = buildDraftRounds({ currentDraft, rosterData, tradedDraftPicks });
        const newLeagueData = {
            ...leagueData,
            currentDraft: {
                ...currentDraft,
                built_draft,
                player_pool,
            },
        };
        this.setState({
            leagueData: newLeagueData,
            loadingMessage: '',
        });
    };

    updateDraftBoard = (built_draft) => {
        this.setState((prevState) => ({
            leagueData: {
                ...prevState.leagueData,
                currentDraft: {
                    ...prevState.leagueData.currentDraft,
                    built_draft,
                },
            },
        }));
    };

    googleSignIn = () => {
        signInWithPopup(auth, googleProvider).catch((error) => {
            console.log(error);
        });
    };

    signOut = () => {
        firebaseSignOut(auth)
            .then(() => {
                this.setState({
                    rankingPlayersIdsList: [],
                });
                console.log('Sign-out successful.');
            })
            .catch((error) => {
                console.error('Sign-out failed:', error);
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
            myDisplayName,
        } = this.state;
        if (isLoading && loadingMessage === 'Initial load...') {
            return <div className="loader"></div>;
        } else {
            const rosterInfo = this.selectRosterInfo({
                rosterData: leagueData.rosterData,
                builtDraft: leagueData.currentDraft?.built_draft,
            });
            const lineupSet = buildLineupSet(rosterPositions);
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
                            rosterInfo={rosterInfo}
                            updateFilter={this.updateParentState}
                            startLoad={this.startLoad}
                            fetchRequest={this.fetchRequest}
                            checkErrors={this.checkErrors}
                            addToRoster={this.addToRoster}
                            updatePlayerId={this.updatePlayerId}
                            notFoundPlayers={notFoundPlayers}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            myDisplayName={myDisplayName}
                            lineupSet={lineupSet}
                        />
                        <LeaguePanel
                            leagueData={leagueData}
                            leagueID={leagueID}
                            updateParentState={this.updateParentState}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            rosterPositions={rosterPositions}
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                            loadingMessage={loadingMessage}
                            removeFromLineup={this.removeFromLineup}
                            updateDraftBoard={this.updateDraftBoard}
                        />
                    </div>
                </div>
            );
        }
    }
}

export default App;
