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
import {
    fetchDraft,
    fetchLatestUpdateAttempt,
    fetchLeagueBundle,
    fetchLeagueSeason,
    fetchPlayerData,
    fetchTradedDraftPicks,
} from './lib/sleeperApi.js';
import { addPlayerToRoster, removePlayerFromLineup } from './lib/roster.js';
import { buildLineupSet, memoizeRosterInfo } from './lib/rosterInfo.js';
import { resolveMyDisplayName } from './lib/sleeper.js';
import { SLEEPER_USER_ID } from './urls.js';

// What, if anything, is currently loading. These states are mutually exclusive
// - at most one thing loads at a time - which is why this is one field rather
// than a set of independent booleans that could contradict each other.
//
// This replaces a string that three components compared against magic
// literals, with RanksPanel passing 'Loading search panel...' *up* through
// startLoad and then comparing against that same literal coming back down as a
// prop. The panels now receive a plain boolean and no longer share a
// vocabulary with App at all, so these names stay private to this file.
// Sleeper's own labels, shortened for display, with bench slots dropped -
// only startable positions appear in the weekly lineup.
function toRosterPositions(rosterPositions) {
    return rosterPositions
        .filter((pos) => pos !== 'BN')
        .map((pos) => {
            if (pos === 'SUPER_FLEX') {
                return 'SFLX';
            } else if (pos === 'FLEX') {
                return 'FLX';
            }
            return pos;
        });
}

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
                    this.loadEverything();
                } else {
                    this.loadLeague(playerInfo);
                }
            } else {
                signInAnonymously(auth).catch((err) => console.error('Error:', err));
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribeAuth();
    }

    // The whole load chain, from player database through to a built draft
    // board. Each step passes its result to the next as an argument instead of
    // writing it to state and reading it back: #96 and #98 were both a read of
    // a value that had not settled, and neither is expressible in this shape.
    loadEverything = async () => {
        // Deliberately not awaited, matching the original: this is a display-only
        // timestamp and the player database is the critical path, so serialising
        // the two would add a whole round trip to every cold start. The guard
        // keeps a failed request from replacing the null default with undefined,
        // which renders as 'Invalid Date' rather than being ignored.
        fetchLatestUpdateAttempt().then((lastUpdate) => {
            if (lastUpdate !== undefined) {
                this.setState({ lastUpdate });
            }
        });

        const playerInfo = await fetchPlayerData();
        if (playerInfo) {
            this.setState({ playerInfo });
        }
        await this.loadLeague(playerInfo || this.state.playerInfo);
    };

    // `playerInfo` is a parameter rather than a state read for the same
    // reason: on the very first load the setState above has not necessarily
    // flushed, and warnAboutMissingRosterPlayers would compare rosters against
    // an empty database and warn about every player in the league.
    loadLeague = async (playerInfo) => {
        const season = this.state.season || (await fetchLeagueSeason());
        const leagueData = await fetchLeagueBundle({ leagueID: this.state.leagueID, season });
        if (!leagueData) {
            this.setState({ season, loading: LOADING.NONE });
            return;
        }

        this.warnAboutMissingRosterPlayers(leagueData.rosterData, playerInfo);
        this.setState({
            season,
            leagueData,
            loading: LOADING.LEAGUE_PANEL,
            myDisplayName: resolveMyDisplayName(leagueData.managerData, SLEEPER_USER_ID),
            rosterPositions: toRosterPositions(leagueData.currentLeague.roster_positions),
        });

        await this.loadDraft(leagueData);
    };

    loadDraft = async (leagueData) => {
        const draftId = leagueData.currentLeagueDrafts[0].draft_id;
        const tradedDraftPicks = await fetchTradedDraftPicks(draftId);
        const draftData = await fetchDraft(draftId);

        // fetchDraft resolves to undefined on failure and DraftPanel reads
        // currentDraft.draft_id unconditionally, so currentDraft has to stay a
        // real object even when the request fails or the next render crashes
        // (#103).
        const currentDraft = draftData || { draft_id: draftId };
        const built =
            draftData && draftData.draft_order
                ? buildDraftRounds({ currentDraft, rosterData: leagueData.rosterData, tradedDraftPicks })
                : null;

        // Composed against prevState rather than the leagueData this call
        // captured. Note this is defensive, not load-bearing today: the only
        // things that could rewrite leagueData during the two awaits above are
        // a second league switch or a manual pick, and both are impossible
        // while this runs because LeaguePanel is showing its loader - the
        // dropdown and DraftPanel are unmounted behind it. No test covers it
        // for that reason. It stays because it costs nothing and that gating
        // is incidental: a loader change elsewhere would otherwise reintroduce
        // #96's shape here, one level up.
        this.setState((prevState) => ({
            leagueData: {
                ...prevState.leagueData,
                currentDraft: built ? { ...currentDraft, ...built } : currentDraft,
            },
            loading: LOADING.NONE,
        }));
    };

    // Diagnostic carried over from the old markTakenPlayers: a roster player id
    // that isn't in the player DB is usually a retired player that was removed
    // from it. Purely informational - it doesn't affect what gets rendered.
    warnAboutMissingRosterPlayers = (rosterData, playerInfo) => {
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
            () => this.loadLeague(this.state.playerInfo),
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
