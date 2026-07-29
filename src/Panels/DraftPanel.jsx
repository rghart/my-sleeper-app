import { useState, useEffect, useRef } from 'react';
import SegmentedControl from '../Components/SegmentedControl';
import PickFeed from './PickFeed';
import DraftGrid from './DraftGrid';
import Sheet from '../Components/Sheet';
import BestAvailable, { countAvailable } from '../Components/BestAvailable';
import BestAvailableHandle from '../Components/BestAvailableHandle';
import ClockCard from '../Components/ClockCard';
import DraftSourceSheet, { readLastMock, writeLastMock } from './DraftSourceSheet';
import { managerLabel, pickNumberLabel } from './pickLabels.js';
import { SLEEPER_API_URLS } from '../urls';
import { syncLiveDraft } from '../lib/liveDraft.js';
import { pollIntervalMs } from '../lib/draftClock.js';
import { nextUnpickedPick, picksUntilMine } from '../lib/onTheClock.js';
import { useSeenPicks } from '../useSeenPicks.js';
import { usePublishSyncStatus } from '../SyncStatus.jsx';
const { DRAFT, PICKS, TRADED_PICKS } = SLEEPER_API_URLS;

const VIEW_OPTIONS = [
    { value: 'feed', label: 'Feed' },
    { value: 'grid', label: 'Grid' },
];

const DraftPanel = ({ leagueData, playerInfo, rosterInfo, rankingPlayersIdsList, myDisplayName, updateDraftBoard }) => {
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

    const onTheClock = nextUnpickedPick(currentDraft.built_draft);
    const onTheClockName = onTheClock
        ? managerLabel({ pick: onTheClock.pick, rosterData, myDisplayName, markYours: false })
        : 'No pick on the clock';
    const pickLabel = onTheClock
        ? `Pick ${pickNumberLabel(onTheClock.round, onTheClock.pick)} · Round ${onTheClock.round.round}`
        : `${currentDraft.season ?? ''} ${currentDraft.player_pool ?? ''}`.trim();

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
            <div className="max-h-[600px] overflow-x-visible overflow-y-scroll">
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
                        {/* Phone only - the aside covers `md` and up (see
                            AppShell's SECTIONS_WITH_ASIDE / App's renderAside).
                            Read-only: unlike Lineup's sheet, there is no
                            unambiguous pick to attach a tap here to, so this
                            never records anything - see DraftPanel's own
                            comment on that near the top of the file for why. */}
                        {rankingPlayersIdsList.length > 0 ? (
                            <>
                                <BestAvailableHandle
                                    buttonRef={bestAvailableHandleRef}
                                    isExpanded={isBestAvailableOpen}
                                    onClick={() => setIsBestAvailableOpen((open) => !open)}
                                    subtitle={`${countAvailable({
                                        entries: rankingPlayersIdsList,
                                        playerInfo,
                                        rosterInfo,
                                        eligibleSlots: null,
                                    })} left`}
                                />
                                {isBestAvailableOpen && (
                                    <Sheet
                                        title="Best available"
                                        subtitle={`${rankingPlayersIdsList.length} ranked`}
                                        onClose={() => setIsBestAvailableOpen(false)}
                                        triggerRef={bestAvailableHandleRef}
                                    >
                                        <BestAvailable
                                            entries={rankingPlayersIdsList}
                                            playerInfo={playerInfo}
                                            rosterInfo={rosterInfo}
                                            myDisplayName={myDisplayName}
                                            eligibleSlots={null}
                                            onSelect={null}
                                        />
                                    </Sheet>
                                )}
                            </>
                        ) : (
                            <div className="border-line bg-raised border-t md:hidden">
                                <BestAvailable
                                    entries={[]}
                                    playerInfo={playerInfo}
                                    rosterInfo={rosterInfo}
                                    eligibleSlots={null}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DraftPanel;
