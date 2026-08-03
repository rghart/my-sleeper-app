import { useState, useEffect, useRef } from 'react';
import SegmentedControl from '../Components/SegmentedControl';
import PickFeed from './PickFeed';
import DraftGrid from './DraftGrid';
import Sheet from '../Components/Sheet';
import BestAvailable, { countAvailable } from '../Components/BestAvailable';
import { draftDefaultOwnership } from '../Components/OwnershipFilters';
import BestAvailableHandle from '../Components/BestAvailableHandle';
import ClockCard from '../Components/ClockCard';
import DraftSourceSheet, { readLastMock, writeLastMock } from './DraftSourceSheet';
import RankListSwitcher from '../Components/RankListSwitcher';
import { managerLabel, pickNumberLabel } from './pickLabels.js';
import { SLEEPER_API_URLS } from '../urls';
import { syncLiveDraft } from '../lib/liveDraft.js';
import { pollIntervalMs } from '../lib/draftClock.js';
import { nextUnpickedPick, picksUntilMine } from '../lib/onTheClock.js';
import { agoLabel } from '../lib/relativeTime.js';
import { useSeenPicks } from '../useSeenPicks.js';
import { usePublishSyncStatus } from '../SyncStatus.jsx';
const { DRAFT, PICKS, TRADED_PICKS } = SLEEPER_API_URLS;

const VIEW_OPTIONS = [
    { value: 'feed', label: 'Feed' },
    { value: 'grid', label: 'Grid' },
];

const DraftPanel = ({
    leagueData,
    playerInfo,
    rosterInfo,
    rankingPlayersIdsList,
    myDisplayName,
    updateDraftBoard,
    savedRankLists,
    savedRankListsLoading,
    signedIn,
}) => {
    const { currentDraft, rosterData } = leagueData;
    const draftPath = DRAFT + currentDraft.draft_id + '/';
    const [isSyncing, setIsSyncing] = useState(false);
    // The top bar's sync pill reads this through the context, several
    // components above - see SyncStatus.jsx for why the state itself stays
    // right here rather than moving up to it.
    usePublishSyncStatus(isSyncing);
    const [currentDraftId, setCurrentDraftId] = useState(currentDraft.draft_id);
    const [DRAFT_PATH, setDraftPath] = useState(draftPath);
    // Feed is the default view - the grid is the newer, denser one and
    // shouldn't change what people already sync a draft against.
    const [boardView, setBoardView] = useState('feed');
    const [isBestAvailableOpen, setIsBestAvailableOpen] = useState(false);
    const [isSourceOpen, setIsSourceOpen] = useState(false);
    // Read once at mount rather than on every render: this is a per-league
    // memory of the last mock, and only this component writes it.
    const [lastMockId, setLastMockId] = useState(() => readLastMock(currentDraft.draft_id));
    // When the last sync landed, for the resting clock card's "synced 2m ago".
    // Set from the sync itself rather than from the poll's schedule, so a tick
    // that failed does not claim to have refreshed anything.
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    // null means "whatever list the session currently has"
    // (rankingPlayersIdsList); otherwise a saved list's route_name. Local to
    // this panel on purpose - the draft sheet can be reading a different list
    // than the Ranks section is editing, same as the Lineup sheet's.
    const [rankListId, setRankListId] = useState(null);
    // Held here rather than inside BestAvailable for the same reason
    // LineupPanel holds its own: the sheet is mounted only while open, so a
    // scope kept down there would reset every time it was reopened - and
    // switching "Other rosters" on to check who has somebody would never
    // survive closing the sheet. `currentDraft.player_pool` is fixed for the
    // life of this panel (it comes from the league's own draft, not from
    // `currentDraftId`/mock switching - see the sync effects below), so
    // computing it once here rather than through a ref is safe.
    const ownershipDefault = draftDefaultOwnership(currentDraft.player_pool);
    const [ownership, setOwnership] = useState(ownershipDefault);
    const bestAvailableHandleRef = useRef(null);
    const sourceButtonRef = useRef(null);

    // Keyed on the draft actually being read, not the league's own: switching
    // to a mock and back must not flood the feed with "NEW" flags for picks
    // that were already seen on the real draft (useSeenPicks keeps one
    // snapshot per id, so this is the whole of that behaviour).
    const { newPickKeys, markSeen } = useSeenPicks({
        draftId: currentDraftId,
        builtDraft: currentDraft.built_draft,
    });

    const updateDraftID = (val) => {
        setCurrentDraftId(val);
        setDraftPath(DRAFT + val + '/');
    };

    const selectDraftSource = (draftId) => {
        updateDraftID(draftId);
        if (draftId !== currentDraft.draft_id) {
            writeLastMock(currentDraft.draft_id, draftId);
            setLastMockId(draftId);
        }
        setIsSourceOpen(false);
    };

    const entries =
        rankListId && savedRankLists?.[rankListId] ? savedRankLists[rankListId].rank_list : rankingPlayersIdsList;

    const picksMade = currentDraft.built_draft
        ? currentDraft.built_draft.reduce(
              (total, round) => total + round.picks.filter((pick) => pick.player_id).length,
              0,
          )
        : null;

    const onTheClock = nextUnpickedPick(currentDraft.built_draft);
    // null, not a "nobody is up" sentence: ClockCard reads this as the signal
    // to fall back to its resting shape, which says what the draft's state is
    // instead. It used to be handed that sentence and print it as a headline.
    const onTheClockName = onTheClock
        ? managerLabel({ pick: onTheClock.pick, rosterData, myDisplayName, markYours: false })
        : null;
    const pickLabel = onTheClock
        ? `Pick ${pickNumberLabel(onTheClock.round, onTheClock.pick)} · Round ${onTheClock.round.round}`
        : null;

    // `changedKey` is only ever passed when the round object came from a
    // manual pick (see PickFeed.selectPlayer) - the live sync path below
    // calls updateDraftBoard directly and never goes through here at all, so
    // there is nothing to distinguish there. Marking it seen immediately is
    // what stops a "NEW" chip flashing on the pick the user just made.
    const handlePickChange = (updatedRound, changedKey) => {
        updateDraftBoard((builtDraft) =>
            builtDraft.map((round) => (round.round === updatedRound.round ? updatedRound : round)),
        );
        if (changedKey) {
            markSeen(changedKey);
        }
    };

    const getLiveDraft = async () => {
        // Nothing to apply picks to. `built_draft` is null whenever the draft
        // response was missing `settings` or `slot_to_roster_id` (see App's
        // loadDraft), and syncLiveDraft maps over the board unguarded - so
        // this used to be a crash waiting for someone to press Sync on a
        // board that had already failed to build, and became one that fired
        // on its own once the panel started syncing at mount.
        if (!currentDraft.built_draft) {
            return;
        }
        const livePicks = await fetch(DRAFT_PATH + PICKS)
            .then((response) => response.json())
            .then((data) => data)
            .catch((error) => {
                console.error('Error:', error);
            });
        const tradedPicks = await fetch(DRAFT_PATH + TRADED_PICKS)
            .then((response) => response.json())
            .then((data) => data)
            .catch((error) => {
                console.error('Error:', error);
            });

        // Both fetches resolve to undefined on failure, and syncLiveDraft's
        // helpers forEach over their lists unguarded - so an unsubstituted
        // failure threw and took the board down. That is worse here than
        // anywhere else in the app: this runs on the 3-second poll during a
        // live draft, so one network blip killed the board and the poll kept
        // firing into the wreckage.
        //
        // Substituting an empty list rather than bailing out is deliberate. It
        // makes the failed half a no-op - applyLivePicks fills picks in and
        // applyTradedPicks only ever sets owner_id, neither clears anything -
        // so the board keeps what it already had while the half that succeeded
        // still lands. Bailing would discard a good live pick because an
        // unrelated traded-picks request failed.
        updateDraftBoard(
            (builtDraft) =>
                syncLiveDraft({
                    liveDraft: { built_draft: builtDraft },
                    livePicks: livePicks || [],
                    tradedPicks: tradedPicks || [],
                }).built_draft,
        );

        // Only when something actually came back. Both fetches swallow their
        // own failures above, so a tick where the network was down still
        // reaches this line - and stamping it then would let the card claim a
        // fresh sync off a request that returned nothing.
        if (livePicks || tradedPicks) {
            setLastSyncedAt(Date.now());
        }
    };

    const getLiveDraftRef = useRef(getLiveDraft);
    useEffect(() => {
        getLiveDraftRef.current = getLiveDraft;
    });

    // Read through a ref, same as getLiveDraftRef above: the poll effect
    // below only re-runs on isSyncing, so a stale closure over currentDraft
    // would keep polling at whatever cadence was current the moment sync
    // was switched on, rather than following the draft's own pace.
    const currentDraftRef = useRef(currentDraft);
    useEffect(() => {
        currentDraftRef.current = currentDraft;
    });

    // One sync as soon as there is a draft to read, and again whenever the
    // draft being read changes - a league switch (which remounts this panel,
    // since LeaguePanel swaps in its loader while the new league loads) or a
    // mock picked from the source sheet.
    //
    // The board arrives empty: buildDraftRounds only lays out the pick order
    // from the draft's slots, and player ids come from the picks endpoint that
    // getLiveDraft calls. So without this, opening a league showed an
    // empty board until the user pressed Sync, and the sheet's "best
    // available" counted players who were long gone.
    //
    // Deliberately not the poll. `isSyncing` stays false, so this brings the
    // board up to date exactly once and then leaves it alone until the user
    // starts syncing themselves. It runs whether or not they do, which is also
    // what lets useSeenPicks flag what arrived since the last visit without
    // anyone pressing anything.
    useEffect(() => {
        getLiveDraftRef.current();
        // getLiveDraft is read through the ref that the effect above keeps
        // current, so the draft id is the only real dependency here. The
        // board's presence is the second one because getLiveDraft returns
        // early without it - without this the panel would skip its one sync
        // for good if the board arrived a render later.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDraftId, Boolean(currentDraft.built_draft)]);

    useEffect(() => {
        if (!isSyncing) {
            return;
        }
        let timer;
        let cancelled = false;
        const poll = async () => {
            await getLiveDraftRef.current();
            // The await above can resolve after cleanup has already run, so re-check
            // before scheduling the next tick or the loop never stops.
            if (cancelled) {
                return;
            }
            timer = setTimeout(poll, pollIntervalMs(currentDraftRef.current));
        };
        poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [isSyncing]);

    return (
        <div>
            <ClockCard
                draft={currentDraft}
                onTheClockName={onTheClockName}
                pickLabel={pickLabel}
                picksUntilMine={picksUntilMine({
                    builtDraft: currentDraft.built_draft,
                    rosterData,
                    myDisplayName,
                })}
                picksMade={picksMade}
                syncedLabel={agoLabel(lastSyncedAt) ? `synced ${agoLabel(lastSyncedAt)}` : null}
                sourceLabel={`…${String(currentDraftId).slice(-4)}`}
                sourceRef={sourceButtonRef}
                isSourceOpen={isSourceOpen}
                onOpenSource={() => setIsSourceOpen((open) => !open)}
                isSyncing={isSyncing}
                onToggleSync={() => setIsSyncing(!isSyncing)}
            />
            {isSourceOpen && (
                <DraftSourceSheet
                    leagueDraft={currentDraft}
                    currentDraftId={currentDraftId}
                    lastMockId={lastMockId}
                    onSelect={selectDraftSource}
                    onClose={() => setIsSourceOpen(false)}
                    triggerRef={sourceButtonRef}
                />
            )}
            {/* No inner scroll box. This used to be a `max-h-[600px]`
                overflow-y-scroll region, which on a phone clipped the board
                partway down the screen and left the rest of the viewport
                empty - and it was the reason the best-available handle sat in
                the middle of the page rather than at the bottom of it. The
                page is the scroller now; the handle is pinned above the tab
                bar and this leaves its height clear at the end of the
                content. */}
            <div className="pb-[var(--handle-h)] md:pb-0">
                {currentDraft.built_draft && (
                    <>
                        <div className="flex items-center justify-between gap-3 px-3.5 pb-2">
                            <span className="text-ink text-[15px] font-semibold">Picks</span>
                            <SegmentedControl
                                label="Draft board view"
                                options={VIEW_OPTIONS}
                                value={boardView}
                                onChange={setBoardView}
                            />
                        </div>
                        {boardView === 'feed' ? (
                            <PickFeed
                                builtDraft={currentDraft.built_draft}
                                playerInfo={playerInfo}
                                rosterInfo={rosterInfo}
                                rankingPlayersIdsList={rankingPlayersIdsList}
                                rosterData={rosterData}
                                myDisplayName={myDisplayName}
                                onPickChange={handlePickChange}
                                newPickKeys={newPickKeys}
                            />
                        ) : (
                            <DraftGrid
                                builtDraft={currentDraft.built_draft}
                                playerInfo={playerInfo}
                                rosterInfo={rosterInfo}
                                rankingPlayersIdsList={rankingPlayersIdsList}
                                rosterData={rosterData}
                                myDisplayName={myDisplayName}
                                onPickChange={handlePickChange}
                            />
                        )}
                    </>
                )}
            </div>
            {/* Phone only - the aside covers `md` and up (see AppShell's
                SECTIONS_WITH_ASIDE / App's renderAside). Read-only: unlike
                Lineup's sheet, there is no unambiguous pick to attach a tap
                here to, so this never records anything.

                Rendered whether or not a list is loaded. It used to be an
                either/or - a handle when there were entries, and otherwise a
                flat strip carrying "paste one in the Ranks section" - which
                left a signed-in user with saved lists no way to reach them
                from this screen at all. The sheet's own switcher is that way,
                so the handle has to open even when there is nothing in it yet. */}
            <BestAvailableHandle
                buttonRef={bestAvailableHandleRef}
                isExpanded={isBestAvailableOpen}
                onClick={() => setIsBestAvailableOpen((open) => !open)}
                subtitle={
                    entries.length > 0
                        ? `${countAvailable({
                              entries,
                              playerInfo,
                              rosterInfo,
                              eligibleSlots: null,
                              ownership,
                              myDisplayName,
                          })} left`
                        : 'Paste a rank list'
                }
            />
            {isBestAvailableOpen && (
                <Sheet
                    title="Best available"
                    subtitle={entries.length > 0 ? `${entries.length} ranked` : 'No list selected'}
                    onClose={() => setIsBestAvailableOpen(false)}
                    triggerRef={bestAvailableHandleRef}
                    headerAction={
                        <RankListSwitcher
                            savedRankLists={savedRankLists}
                            savedRankListsLoading={savedRankListsLoading}
                            signedIn={signedIn}
                            rankListId={rankListId}
                            onSelect={setRankListId}
                            onPasteNew={() => {
                                window.location.hash = '#/ranks';
                            }}
                            sessionCount={rankingPlayersIdsList.length}
                        />
                    }
                >
                    <BestAvailable
                        entries={entries}
                        playerInfo={playerInfo}
                        rosterInfo={rosterInfo}
                        myDisplayName={myDisplayName}
                        eligibleSlots={null}
                        defaultOwnership={ownershipDefault}
                        ownership={ownership}
                        onOwnershipChange={setOwnership}
                        onSelect={null}
                    />
                </Sheet>
            )}
        </div>
    );
};

export default DraftPanel;
