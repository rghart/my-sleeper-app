import React from 'react';
import './App.css';
import './loader.css';
import AppShell from './Components/AppShell';
import ErrorBanner from './Components/ErrorBanner';
import Header from './Components/Header';
import LeaguePanel from './Panels/LeaguePanel';
import RanksPanel from './Panels/RanksPanel';
import { SECTIONS } from './sections.js';
import { currentUserIdentity, observeAuthState, signInAnonymous, signInWithGoogle, signOutUser } from './lib/auth.js';
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
import { addPlayerToRoster, removePlayerFromLineup, toRosterSlots } from './lib/roster.js';
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
const LEAGUE_LOAD_FAILED = "Couldn't load your league data. The Sleeper API may be unavailable.";
const TRADED_PICKS_FAILED = "Couldn't load traded draft picks. The board shows every pick under its original owner.";

const LOADING = {
    NONE: 'none',
    INITIAL: 'initial',
    LEAGUE_PANEL: 'leaguePanel',
    RANKS_PANEL: 'ranksPanel',
};

class App extends React.Component {
    state = {
        playerInfo: {},
        leagueData: {},
        loadError: null,
        draftWarning: null,
        loading: LOADING.INITIAL,
        rankingPlayersIdsList: [],
        leagueID: '1312088290526003200',
        rosterSlots: [],
        notFoundPlayers: [],
        lastUpdate: null,
        signedIn: false,
        signedInEmail: null,
        season: null,
        myDisplayName: null,
    };

    selectRosterInfo = memoizeRosterInfo();

    componentDidMount() {
        this.unsubscribeAuth = observeAuthState((user) => {
            if (user) {
                const { playerInfo } = this.state;
                this.setState(currentUserIdentity());
                if (playerInfo && Object.keys(playerInfo).length === 0) {
                    this.loadEverything();
                } else {
                    this.loadLeague(playerInfo);
                }
            } else {
                signInAnonymous();
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
            // Both panels read league data unconditionally - LeaguePanel goes
            // straight for currentLeague.name - so there is nothing to render
            // them from and no partial view worth showing. Before this the app
            // fell through to a render with leagueData still empty and threw,
            // leaving a blank page.
            this.setState({ season, loading: LOADING.NONE, loadError: LEAGUE_LOAD_FAILED });
            return;
        }

        this.warnAboutMissingRosterPlayers(leagueData.rosterData, playerInfo);
        this.setState({
            season,
            leagueData,
            loadError: null,
            loading: LOADING.LEAGUE_PANEL,
            myDisplayName: resolveMyDisplayName(leagueData.managerData, SLEEPER_USER_ID),
            rosterSlots: toRosterSlots(leagueData.currentLeague.roster_positions),
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

        // The old guard here checked `draft_order`, which buildDraftRounds never
        // reads - it was standing in for "this is a real draft" rather than for
        // what the builder actually needs. A response carrying draft_order but
        // no settings threw on settings.player_type, and one with no
        // slot_to_roster_id threw in createPickOrder. Check the two fields that
        // are genuinely dereferenced instead.
        const canBuild = Boolean(draftData && draftData.settings && draftData.slot_to_roster_id);
        if (draftData && !canBuild) {
            console.warn(`Draft ${draftId} is missing settings or slot_to_roster_id; rendering an empty board`);
        }

        // fetchTradedDraftPicks also resolves to undefined on failure, and
        // buildDraftRounds forEaches over it. That took out the whole load
        // chain: loadDraft threw, its setState never ran, and the app sat on
        // the LEAGUE_PANEL loader forever. Trades are an overlay on a board
        // that is perfectly renderable without them, so build without them.
        // Building without them cannot be silent, though: 42 of 48 picks in the
        // real league carry a "via" attribution, so the board would look
        // authoritative while misattributing most of itself. Hence draftWarning
        // in the setState below.
        const built = canBuild
            ? buildDraftRounds({
                  currentDraft,
                  rosterData: leagueData.rosterData,
                  tradedDraftPicks: tradedDraftPicks || [],
              })
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
            draftWarning: canBuild && !tradedDraftPicks ? TRADED_PICKS_FAILED : null,
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

    // Retries only the league load, not the whole app: the player database is
    // already in memory and is not what failed. The full-page loader comes back
    // because both panels are hidden while there is no league data, so there is
    // nowhere for a panel-level spinner to appear.
    retryLeagueLoad = () => {
        this.setState({ loadError: null, loading: LOADING.INITIAL }, () => this.loadLeague(this.state.playerInfo));
    };

    // Retries only the draft load, not the whole league: leagueData is already
    // in state and is not what failed, mirroring retryLeagueLoad's reasoning
    // about the player database above.
    retryDraftLoad = () => {
        this.setState({ draftWarning: null, loading: LOADING.LEAGUE_PANEL }, () =>
            this.loadDraft(this.state.leagueData),
        );
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
        this.setState((prevState) => addPlayerToRoster({ player, rosterSlots: prevState.rosterSlots }));
    };

    removeFromLineup = (i) => {
        this.setState((prevState) => removePlayerFromLineup({ i, rosterSlots: prevState.rosterSlots }));
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

    googleSignIn = () => signInWithGoogle();

    // The rank list is per signed-in user, so it has to go with them. Cleared
    // only on a sign-out that actually succeeded - a failed one leaves the user
    // signed in, and dropping their list under them would be worse than the
    // failure.
    signOut = async () => {
        if (await signOutUser()) {
            this.setState({ rankingPlayersIdsList: [] });
        }
    };

    render() {
        const {
            playerInfo,
            lastUpdate,
            loading,
            rankingPlayersIdsList,
            rosterSlots,
            leagueData,
            notFoundPlayers,
            leagueID,
            loadError,
            draftWarning,
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
            const lineupSet = buildLineupSet(rosterSlots);
            // One element, two possible slots: beside the league section on a
            // wide screen, or as the main column when Ranks is the active
            // section. Built once so the two call sites cannot drift apart.
            const ranksPanel = (
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
            );
            return (
                <div>
                    <Header
                        signedIn={signedIn}
                        signedInEmail={signedInEmail}
                        lastUpdate={lastUpdate}
                        onSignIn={this.googleSignIn}
                        onSignOut={this.signOut}
                    />
                    {loadError ? <ErrorBanner message={loadError} onRetry={this.retryLeagueLoad} /> : null}
                    {!loadError && draftWarning ? (
                        <ErrorBanner message={draftWarning} variant="warning" onRetry={this.retryDraftLoad} />
                    ) : null}
                    {!loadError && leagueData.currentLeague ? (
                        <AppShell
                            sections={SECTIONS}
                            leagueBar={null}
                            renderAside={() => ranksPanel}
                            renderSection={(activeId) => {
                                if (activeId === 'ranks') {
                                    return ranksPanel;
                                }
                                return (
                                    <LeaguePanel
                                        view={activeId === 'lineup' ? 'weekly' : 'draft'}
                                        leagueData={leagueData}
                                        leagueID={leagueID}
                                        updateLeagueID={this.updateLeagueID}
                                        rankingPlayersIdsList={rankingPlayersIdsList}
                                        rosterSlots={rosterSlots}
                                        playerInfo={playerInfo}
                                        rosterInfo={rosterInfo}
                                        isLoading={loading === LOADING.LEAGUE_PANEL}
                                        removeFromLineup={this.removeFromLineup}
                                        updateDraftBoard={this.updateDraftBoard}
                                    />
                                );
                            }}
                        />
                    ) : null}
                </div>
            );
        }
    }
}

export default App;
