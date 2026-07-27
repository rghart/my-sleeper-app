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
import { checkErrors } from './lib/http.js';
import { addPlayerToRoster, removePlayerFromLineup } from './lib/roster.js';
import { buildLineupSet, decorateRosters, memoizeRosterInfo } from './lib/rosterInfo.js';
import { resolveLeagueSeason, resolveMyDisplayName } from './lib/sleeper.js';
import APP_DB_URLS, { SLEEPER_API_URLS, SLEEPER_USER_ID } from './urls.js';
const { LATEST_UPDATE_ATTEMPT, ACTIVE_PLAYERS } = APP_DB_URLS;
const { LEAGUE, USER_LEAGUES, NFL_STATE, DRAFT, ROSTERS, SLEEPER_USERS, TRADED_PICKS, DRAFTS } = SLEEPER_API_URLS;

// What, if anything, is currently loading. These states are mutually exclusive
// - at most one thing loads at a time - which is why this is one field rather
// than a set of independent booleans that could contradict each other.
//
// This replaces a string that three components compared against magic
// literals, with RanksPanel passing 'Loading search panel...' *up* through
// startLoad and then comparing against that same literal coming back down as a
// prop. The panels now receive a plain boolean and no longer share a
// vocabulary with App at all, so these names stay private to this file.
const LOADING = {
    NONE: 'none',
    INITIAL: 'initial',
    LEAGUE_PANEL: 'leaguePanel',
    RANKS_PANEL: 'ranksPanel',
};

class App extends React.Component {
    state = {
        playerInfo: {},
        leagueData: [],
        loading: LOADING.INITIAL,
        rankingPlayersIdsList: [],
        leagueID: '1312088290526003200',
        rosterPositions: [],
        notFoundPlayers: [],
        lastUpdate: null,
        signedIn: false,
        signedInEmail: null,
        season: null,
        myDisplayName: null,
    };

    selectRosterInfo = memoizeRosterInfo();

    componentDidMount() {
        this.unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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

    componentWillUnmount() {
        this.unsubscribeAuth();
    }

    getLatestUpdateAttempt = async () => {
        return await fetch(LATEST_UPDATE_ATTEMPT + (await auth.currentUser.getIdToken(true)))
            .then(checkErrors)
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
            .then(checkErrors)
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
                        loading: LOADING.LEAGUE_PANEL,
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
        // Handed straight down the chain rather than round-tripped through state:
        // setState batches inside an async context, so buildDraft could read the
        // previous value and render every pick under its original roster with no
        // "via <manager>" attribution. Production only got away with it because
        // getSpecificDraft awaits another fetch first, which happened to give React
        // time to flush.
        this.getSpecificDraft(tradedPicks);
    };

    getSpecificDraft = async (tradedDraftPicks) => {
        const { leagueData } = this.state;
        const draftId = leagueData.currentLeagueDrafts[0].draft_id;
        const DRAFT_PATH = DRAFT + draftId;
        const draftData = await fetch(DRAFT_PATH)
            .then((response) => response.json())
            .then((data) => data)
            .catch((error) => {
                console.error('Error:', error);
            });
        // The fetch's own catch resolves to undefined on failure, and
        // DraftPanel reads currentDraft.draft_id unconditionally - so
        // currentDraft has to stay a real object even when the fetch fails,
        // or the next render crashes. Same shape as the ADP bug (#101).
        leagueData.currentDraft = draftData || { draft_id: draftId };
        this.setState({
            leagueData,
        });
        if (draftData && draftData.draft_order) {
            this.buildDraft(tradedDraftPicks);
        } else {
            this.setState({
                loading: LOADING.NONE,
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

    updateLeagueID = (leagueID) => {
        this.setState(
            {
                leagueID,
                loading: LOADING.LEAGUE_PANEL,
            },
            this.getLeagueData,
        );
    };

    updateRankingPlayersIdsList = (rankingPlayersIdsList) => {
        this.setState({ rankingPlayersIdsList });
    };

    // The caller no longer names the loading state it wants: there was only
    // ever one caller and it always asked for the ranks panel, so the message
    // it passed just travelled back down to it as a prop.
    startLoad = (searchText) => {
        this.setState(
            {
                loading: LOADING.RANKS_PANEL,
            },
            () => setTimeout(() => this.updateRankings(searchText), 0),
        );
    };

    updateRankings = (searchText) => {
        const { playerInfo } = this.state;
        const [searchResultsArray, notFoundPlayers] = createRankings(searchText, playerInfo);

        this.setState({
            rankingPlayersIdsList: searchResultsArray,
            loading: LOADING.NONE,
            notFoundPlayers: notFoundPlayers,
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

    buildDraft = (tradedDraftPicks) => {
        const { leagueData } = this.state;
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
            loading: LOADING.NONE,
        });
    };

    // Takes a reducer rather than a finished board on purpose. Callers compute
    // the next board from an awaited fetch, so passing a value means computing
    // it from whatever the caller's closure captured - and a manual pick made
    // during those awaits is then silently overwritten. Composing against
    // prevState instead is what makes the sync and a manual pick coexist.
    updateDraftBoard = (buildNextDraftBoard) => {
        this.setState((prevState) => ({
            leagueData: {
                ...prevState.leagueData,
                currentDraft: {
                    ...prevState.leagueData.currentDraft,
                    built_draft: buildNextDraftBoard(prevState.leagueData.currentDraft.built_draft),
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
            lastUpdate,
            loading,
            rankingPlayersIdsList,
            rosterPositions,
            leagueData,
            notFoundPlayers,
            leagueID,
            signedIn,
            signedInEmail,
            myDisplayName,
        } = this.state;
        if (loading === LOADING.INITIAL) {
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
                            isLoading={loading === LOADING.RANKS_PANEL}
                            signedIn={signedIn}
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                            updateRankingPlayersIdsList={this.updateRankingPlayersIdsList}
                            startLoad={this.startLoad}
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
                            updateLeagueID={this.updateLeagueID}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            rosterPositions={rosterPositions}
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                            isLoading={loading === LOADING.LEAGUE_PANEL}
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
