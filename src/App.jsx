import React from 'react';
import AppBar from './Components/AppBar';
import AppShell from './Components/AppShell';
import ErrorBanner from './Components/ErrorBanner';
import LeaguePanel from './Panels/LeaguePanel';
import RanksPanel from './Panels/RanksPanel';
import LeaguemateIntelPanel from './Panels/LeaguemateIntelPanel';
import Spinner from './Components/Spinner';
import { SyncStatusProvider } from './SyncStatus.jsx';
import { RankListProvider, useRankList } from './RankList.jsx';
import { SECTIONS, defaultSectionFor } from './sections.js';
import { currentUserIdentity, observeAuthState, signInAnonymous, signInWithGoogle, signOutUser } from './lib/auth.js';
import createRankings from './helpers.js';
import { buildDraftRounds } from './lib/draft.js';
import {
    fetchDraft,
    fetchLeagueBundle,
    fetchLeagueSeason,
    fetchPlayerData,
    fetchSleeperUser,
    fetchTradedDraftPicks,
    fetchUserLeagues,
} from './lib/sleeperApi.js';
import {
    pickStartingLeague,
    readLastLeagueId,
    readLocalAccount,
    readRemoteAccount,
    reconcileAccounts,
    writeLastLeagueId,
    writeLocalAccount,
    writeRemoteAccount,
} from './lib/sleeperIdentity.js';
import { addPlayerToRoster, removePlayerFromLineup, toRosterSlots } from './lib/roster.js';
import { buildLineupSet, memoizeRosterInfo } from './lib/rosterInfo.js';
import { resolveMyDisplayName } from './lib/sleeper.js';
import { checkErrors } from './lib/http.js';
import { auth } from './firebase.js';
import APP_DB_URLS from './urls.js';
import ConnectSleeper from './Components/ConnectSleeper';
import BestAvailable, { countAvailable } from './Components/BestAvailable';
import { draftDefaultOwnership } from './Components/OwnershipFilters';

const { APP_USERS, TYPE_PARAMS } = APP_DB_URLS;

// The rank-list switcher's "nothing saved yet" state - the same placeholder
// RanksPanel's own selector has always shown. Lifted alongside the fetch it
// used to own (see loadSavedRankLists below) so the switcher (in
// LineupPanel, via the Lineup section) and the selector (in RanksPanel) read
// off one map rather than two independently-fetched copies of it.
const DEFAULT_RANK_LIST_SELECTOR = 'default';
const DEFAULT_SAVED_RANK_LISTS = {
    [DEFAULT_RANK_LIST_SELECTOR]: { pretty_name: '-- Select saved ranks list', route_name: DEFAULT_RANK_LIST_SELECTOR },
};

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
const NO_LEAGUES = "This Sleeper account isn't in any leagues for the current season.";

// The `users/{uid}` record is not only rank lists any more - the connected
// Sleeper account is saved in the same subtree, so a signed-in user's record
// now has a key that is not a list. Filtering on shape rather than on the one
// known key name keeps the rank-list switcher from sprouting a phantom entry
// for it (labelled "dunno", since it has no pretty_name), and keeps doing so
// for whatever gets stored there next.
const onlyRankLists = (record) =>
    Object.fromEntries(Object.entries(record).filter(([, value]) => value && value.route_name));

const LOADING = {
    NONE: 'none',
    INITIAL: 'initial',
    LEAGUE_PANEL: 'leaguePanel',
    RANKS_PANEL: 'ranksPanel',
};

// The best-available rail's subtitle needs the real rank list name, which
// only exists in RankList's context - not reachable from a class component's
// render via a hook. This is the smallest possible wrapper: a function
// component that reads the context itself and renders exactly the line
// renderBestAvailableRail used to build from a hardcoded "Ranks" string.
// Falls back to "Ranks" both before RanksPanel has ever mounted (no list
// published yet) and while nothing is selected (the default "-- Select saved
// ranks list" placeholder), so the rail never shows that placeholder text.
const BestAvailableSubtitle = ({ left }) => {
    const rankList = useRankList();
    const selected = rankList?.options?.find((option) => option.value === rankList.currentValue);
    const listName = selected && selected.value !== 'default' ? selected.label : 'Ranks';
    return (
        <p className="text-ink-quiet m-0 font-mono text-[11px]">
            {listName} · {left} left
        </p>
    );
};

class App extends React.Component {
    state = {
        playerInfo: {},
        leagueData: {},
        loadError: null,
        draftWarning: null,
        loading: LOADING.INITIAL,
        rankingPlayersIdsList: [],
        // No hardcoded league any more - it is chosen from whatever leagues
        // the connected account is actually in (see startLoadingLeagues).
        leagueID: null,
        rosterSlots: [],
        notFoundPlayers: [],
        signedIn: false,
        signedInEmail: null,
        // The Sleeper account the app is pointed at, `{ userId, username }`,
        // and whether we have finished looking for one yet. The second flag is
        // what keeps the connect screen from flashing on every load before
        // storage has been read - "not connected" and "don't know yet" are
        // different screens.
        sleeperAccount: null,
        accountResolved: false,
        season: null,
        myDisplayName: null,
        savedRankLists: DEFAULT_SAVED_RANK_LISTS,
        savedRankListsLoading: false,
    };

    selectRosterInfo = memoizeRosterInfo();

    componentDidMount() {
        this.unsubscribeAuth = observeAuthState(async (user) => {
            if (!user) {
                signInAnonymous();
                return;
            }
            const { playerInfo } = this.state;
            this.setState(currentUserIdentity());

            // Resolved before anything loads, because it decides *what* loads:
            // every league request below is built from this account's id.
            const sleeperAccount = await this.resolveSleeperAccount(user);
            this.setState({ sleeperAccount, accountResolved: true });

            if (playerInfo && Object.keys(playerInfo).length === 0) {
                this.loadEverything(sleeperAccount);
            } else {
                this.loadLeague(playerInfo, sleeperAccount);
            }
        });
    }

    // Where the connected account comes from, and the one place the two
    // storage sides are reconciled. Signed-out visitors have only the local
    // one; signing in with Google brings a saved account down (or pushes the
    // local one up, if the account is new). See reconcileAccounts for why the
    // remote copy wins.
    resolveSleeperAccount = async (user) => {
        const local = readLocalAccount();
        if (user.isAnonymous) {
            return local;
        }
        const { account, promote } = reconcileAccounts({ local, remote: await readRemoteAccount(user) });
        if (promote) {
            await writeRemoteAccount(user, account);
        }
        // Mirrored back down so the next signed-out visit to this device opens
        // on the same account rather than back on whatever it had before.
        if (account) {
            writeLocalAccount(account);
        }
        return account;
    };

    // Connecting from the ConnectSleeper screen. The account is stored before
    // anything is fetched: a load failure should still leave you connected,
    // otherwise a flaky network bounces you back to the form and loses the
    // username you just typed.
    connectSleeperAccount = async (account) => {
        writeLocalAccount(account);
        if (this.state.signedIn) {
            await writeRemoteAccount(auth.currentUser, account);
        }
        this.setState({ sleeperAccount: account, leagueID: null, loadError: null, loading: LOADING.INITIAL }, () =>
            this.loadLeague(this.state.playerInfo, account),
        );
    };

    // Deliberately clears both copies, not just this device's: "disconnect"
    // read as a per-device action would silently reconnect the account on the
    // next sign-in, from the copy still in the database.
    disconnectSleeperAccount = async () => {
        writeLocalAccount(null);
        if (this.state.signedIn) {
            await writeRemoteAccount(auth.currentUser, null);
        }
        this.setState({
            sleeperAccount: null,
            leagueID: null,
            leagueData: {},
            myDisplayName: null,
            rosterSlots: [],
            loadError: null,
            draftWarning: null,
            loading: LOADING.NONE,
        });
    };

    componentDidUpdate(prevProps, prevState) {
        // Mirrors the effect RanksPanel used to run on `[signedIn]`: a fresh
        // sign-in fetches the saved lists, a sign-out (or the initial
        // not-yet-signed-in render) resets to the placeholder-only map.
        if (prevState.signedIn !== this.state.signedIn) {
            this.loadSavedRankLists();
        }
    }

    componentWillUnmount() {
        this.unsubscribeAuth();
    }

    // Lifted out of RanksPanel's getSavedRankLists effect so the rank-list
    // switcher (LineupPanel, reached from the Lineup section) and RanksPanel's
    // own selector can both read the same fetch's result instead of each
    // running it independently. Uses the raw `fetch` + `checkErrors` pattern
    // the original effect used, not `fetchRequest` - this is a GET with no
    // body to swallow errors around, and the original never used fetchRequest
    // here either.
    loadSavedRankLists = async () => {
        if (!this.state.signedIn) {
            this.setState({ savedRankLists: DEFAULT_SAVED_RANK_LISTS, savedRankListsLoading: false });
            return;
        }
        this.setState({ savedRankListsLoading: true });
        const result = await fetch(
            APP_USERS + auth.currentUser.uid + TYPE_PARAMS + (await auth.currentUser.getIdToken(true)),
        )
            .then(checkErrors)
            .then((response) => response.json())
            .catch((error) => {
                console.error('Error:', error);
                return null;
            });
        if (result) {
            this.setState({
                savedRankLists: { ...DEFAULT_SAVED_RANK_LISTS, ...onlyRankLists(result) },
                savedRankListsLoading: false,
            });
        } else {
            this.setState({ savedRankListsLoading: false });
        }
    };

    // The updater RanksPanel's saveRankList/deleteRankList call instead of
    // mutating the map directly. Accepting either a plain value or a
    // prevState -> nextState function mirrors setState's own dual signature -
    // both callers need the previous value, since both build a new object
    // from it rather than replacing the whole map.
    updateSavedRankLists = (updater) => {
        this.setState((prevState) => ({
            savedRankLists: typeof updater === 'function' ? updater(prevState.savedRankLists) : updater,
        }));
    };

    // The whole load chain, from player database through to a built draft
    // board. Each step passes its result to the next as an argument instead of
    // writing it to state and reading it back: #96 and #98 were both a read of
    // a value that had not settled, and neither is expressible in this shape.
    loadEverything = async (sleeperAccount) => {
        const playerInfo = await fetchPlayerData();
        if (playerInfo) {
            this.setState({ playerInfo });
        }
        await this.loadLeague(playerInfo || this.state.playerInfo, sleeperAccount);
    };

    // `playerInfo` is a parameter rather than a state read for the same
    // reason: on the very first load the setState above has not necessarily
    // flushed, and warnAboutMissingRosterPlayers would compare rosters against
    // an empty database and warn about every player in the league.
    loadLeague = async (playerInfo, sleeperAccount = this.state.sleeperAccount) => {
        // Nothing to load without an account, and this is not a failure: it is
        // the connect screen's state, which render() picks up from
        // `sleeperAccount` being null.
        if (!sleeperAccount) {
            this.setState({ loading: LOADING.NONE });
            return;
        }

        const season = this.state.season || (await fetchLeagueSeason());
        const leagueID = this.state.leagueID || (await this.chooseLeague(sleeperAccount, season));
        // Three outcomes, and they must not be collapsed: a league to open, a
        // Sleeper account genuinely in no leagues, and a failed request.
        // Telling someone whose league list failed to load that they are in no
        // leagues is both wrong and unactionable.
        if (leagueID === undefined) {
            this.setState({ season, loading: LOADING.NONE, loadError: LEAGUE_LOAD_FAILED });
            return;
        }
        if (leagueID === null) {
            this.setState({ season, loading: LOADING.NONE, loadError: NO_LEAGUES });
            return;
        }

        const leagueData = await fetchLeagueBundle({ leagueID, season, userId: sleeperAccount.userId });
        if (!leagueData) {
            // Both panels read league data unconditionally - LeaguePanel goes
            // straight for currentLeague.name - so there is nothing to render
            // them from and no partial view worth showing. Before this the app
            // fell through to a render with leagueData still empty and threw,
            // leaving a blank page.
            this.setState({ season, leagueID, loading: LOADING.NONE, loadError: LEAGUE_LOAD_FAILED });
            return;
        }

        this.warnAboutMissingRosterPlayers(leagueData.rosterData, playerInfo);
        this.setState({
            season,
            leagueID,
            leagueData,
            loadError: null,
            loading: LOADING.LEAGUE_PANEL,
            myDisplayName: resolveMyDisplayName(leagueData.managerData, sleeperAccount.userId),
            rosterSlots: toRosterSlots(leagueData.currentLeague.roster_positions),
        });

        await this.loadDraft(leagueData);
    };

    // Which league to open on for an account that has not picked one this
    // session. Costs one extra request that the league bundle also makes -
    // unavoidable, because the bundle is built *from* a league id, so
    // something has to know the list before it can run at all.
    //
    // Returns `undefined` when the list could not be fetched and `null` when
    // it came back empty, keeping apart the two states the caller renders
    // different messages for.
    chooseLeague = async (sleeperAccount, season) => {
        const leagues = await fetchUserLeagues({ userId: sleeperAccount.userId, season });
        if (!leagues) {
            return undefined;
        }
        return pickStartingLeague({ leagues, lastLeagueId: readLastLeagueId(sleeperAccount.userId) });
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
        // Remembered per account so the next visit opens here, which is what
        // the hardcoded league id used to give for free.
        if (this.state.sleeperAccount) {
            writeLastLeagueId(this.state.sleeperAccount.userId, leagueID);
        }
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

    // The slot-scoped sheet's fill action: unlike addToRoster above, the
    // target slot is already chosen (the user tapped it), so this always
    // fills or replaces that exact index rather than searching for the first
    // eligible open one.
    fillSlot = (slotIndex, player) => {
        this.setState((prevState) => addPlayerToRoster({ player, rosterSlots: prevState.rosterSlots, slotIndex }));
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

    // The wide-screen aside for the Draft and Lineup sections. Ranks used to
    // render here in full; the redesign replaces that with a narrower "best
    // available" rail that shows the same BestAvailable rows the phone sheet
    // does (see BestAvailable.jsx - splitting the rows out of Sheet is what
    // lets both render identically). Ranks itself is still reachable as its
    // own section; "Edit list" below is a shortcut there.
    //
    renderBestAvailableRail = (activeId) => {
        const { playerInfo, leagueData, rankingPlayersIdsList, rosterSlots, myDisplayName } = this.state;
        const rosterInfoValue = this.selectRosterInfo({
            rosterData: leagueData.rosterData,
            builtDraft: leagueData.currentDraft?.built_draft,
        });
        const eligibleSlots =
            activeId === 'lineup'
                ? [...new Set(rosterSlots.filter((slot) => !slot.playerId).map((slot) => slot.label))]
                : null;
        // Only the draft rail's resting scope cares which pool the board is
        // drawn from - the lineup rail is never scoped to a specific draft.
        const defaultOwnership =
            activeId === 'lineup' ? undefined : draftDefaultOwnership(leagueData.currentDraft?.player_pool);
        const left = countAvailable({
            entries: rankingPlayersIdsList,
            playerInfo,
            rosterInfo: rosterInfoValue,
            eligibleSlots,
        });

        return (
            <div className="bg-raised border-line rounded-card flex flex-col gap-3.5 border p-[18px]">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-ink m-0 text-[16px] font-semibold">Best available</p>
                        <BestAvailableSubtitle left={left} />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            window.location.hash = '#/ranks';
                        }}
                        className="border-line text-ink-muted shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold"
                    >
                        Edit list
                    </button>
                </div>
                <div className="bg-line-mid h-px w-full" />
                <BestAvailable
                    entries={rankingPlayersIdsList}
                    playerInfo={playerInfo}
                    rosterInfo={rosterInfoValue}
                    myDisplayName={myDisplayName}
                    eligibleSlots={eligibleSlots}
                    defaultOwnership={defaultOwnership}
                    lineupSet={activeId === 'lineup' ? buildLineupSet(rosterSlots) : undefined}
                    onSelect={activeId === 'lineup' ? this.addToRoster : null}
                />
            </div>
        );
    };

    render() {
        const {
            playerInfo,
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
            savedRankLists,
            savedRankListsLoading,
            season,
            sleeperAccount,
            accountResolved,
        } = this.state;
        if (loading === LOADING.INITIAL) {
            return <Spinner size="page" />;
        }

        // No Sleeper account connected - the state that could not exist while
        // the account was a constant. Checked before everything below because
        // none of it has anything to render: no league, no roster, no draft.
        // `accountResolved` gates it so this does not flash on top of a load
        // that is about to find a stored account.
        if (accountResolved && !sleeperAccount) {
            return (
                <div>
                    <AppBar signedIn={signedIn} signedInEmail={signedInEmail} onSignIn={this.googleSignIn} />
                    <ConnectSleeper
                        onConnect={this.connectSleeperAccount}
                        resolveUsername={fetchSleeperUser}
                        signedIn={signedIn}
                        onSignIn={this.googleSignIn}
                    />
                </div>
            );
        }

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
                savedRankLists={savedRankLists}
                savedRankListsLoading={savedRankListsLoading}
                updateSavedRankLists={this.updateSavedRankLists}
            />
        );
        return (
            <RankListProvider>
                <SyncStatusProvider>
                    <div>
                        {/*
                        The shell renders its own top bar, because the bar's
                        section pills and the tab bar have to share one
                        active id. So this is an either/or, not a stack: the
                        bare bar below covers the states where there is no
                        shell yet - still loading a league, or a load error
                        that replaced everything under it - and the shell
                        takes over the moment there is a league to navigate.
                        Rendering both is what it looked like first, and it
                        put two top bars on the screen.
                    */}
                        {!loadError && leagueData.currentLeague ? (
                            <AppShell
                                sections={SECTIONS}
                                // The league bundle already carries the draft's status, so this is
                                // known the moment the shell can mount. Reading it off
                                // currentDraft instead would be a render too late: that is
                                // filled by loadDraft, which resolves after the shell is
                                // already on screen.
                                defaultSectionId={defaultSectionFor(leagueData.currentLeagueDrafts?.[0]?.status)}
                                identity={{
                                    signedIn,
                                    signedInEmail,
                                    myDisplayName,
                                    sleeperUsername: sleeperAccount?.username,
                                    onSignIn: this.googleSignIn,
                                    onSignOut: this.signOut,
                                    onDisconnectSleeper: this.disconnectSleeperAccount,
                                }}
                                leagueID={leagueID}
                                leagueIds={leagueData.leagueIds}
                                updateLeagueID={this.updateLeagueID}
                                // Inside the shell rather than above it: the
                                // shell owns the top bar now, so a banner
                                // rendered as a sibling would sit above the bar
                                // instead of under it.
                                banner={
                                    draftWarning ? (
                                        <ErrorBanner
                                            message={draftWarning}
                                            variant="warning"
                                            onRetry={this.retryDraftLoad}
                                        />
                                    ) : null
                                }
                                renderAside={this.renderBestAvailableRail}
                                renderSection={(activeId) => {
                                    if (activeId === 'ranks') {
                                        return ranksPanel;
                                    }
                                    if (activeId === 'leaguemates') {
                                        return <LeaguemateIntelPanel leagueID={leagueID} season={season} />;
                                    }
                                    return (
                                        <LeaguePanel
                                            view={activeId === 'lineup' ? 'weekly' : 'draft'}
                                            leagueData={leagueData}
                                            rankingPlayersIdsList={rankingPlayersIdsList}
                                            rosterSlots={rosterSlots}
                                            playerInfo={playerInfo}
                                            rosterInfo={rosterInfo}
                                            isLoading={loading === LOADING.LEAGUE_PANEL}
                                            removeFromLineup={this.removeFromLineup}
                                            updateDraftBoard={this.updateDraftBoard}
                                            myDisplayName={myDisplayName}
                                            sleeperUserId={sleeperAccount?.userId}
                                            addToRoster={this.addToRoster}
                                            fillSlot={this.fillSlot}
                                            savedRankLists={savedRankLists}
                                            savedRankListsLoading={savedRankListsLoading}
                                            signedIn={signedIn}
                                            lineupSet={lineupSet}
                                        />
                                    );
                                }}
                            />
                        ) : (
                            <>
                                <AppBar
                                    signedIn={signedIn}
                                    signedInEmail={signedInEmail}
                                    myDisplayName={myDisplayName}
                                    onSignIn={this.googleSignIn}
                                    onSignOut={this.signOut}
                                />
                                {/* The banner is a card, so it needs the
                                    screen's own gutter around it rather
                                    than sitting flush to the viewport
                                    edges with its corners rounded. */}
                                <div className="p-3.5 md:p-4">
                                    {loadError ? (
                                        <ErrorBanner message={loadError} onRetry={this.retryLeagueLoad} />
                                    ) : null}
                                    {!loadError && draftWarning ? (
                                        <ErrorBanner
                                            message={draftWarning}
                                            variant="warning"
                                            onRetry={this.retryDraftLoad}
                                        />
                                    ) : null}
                                </div>
                            </>
                        )}
                    </div>
                </SyncStatusProvider>
            </RankListProvider>
        );
    }
}

export default App;
