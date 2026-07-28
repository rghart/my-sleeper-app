import { useState, useEffect, useRef } from 'react';
import Button from '../Components/Button';
import SegmentedControl from '../Components/SegmentedControl';
import PickFeed from './PickFeed';
import DraftGrid from './DraftGrid';
import BestAvailableSheet from './BestAvailableSheet';
import PickClock from '../Components/PickClock';
import { SLEEPER_API_URLS } from '../urls';
import { syncLiveDraft } from '../lib/liveDraft.js';
import { pollIntervalMs } from '../lib/draftClock.js';
import { useSeenPicks } from '../useSeenPicks.js';
const { DRAFT, PICKS, TRADED_PICKS } = SLEEPER_API_URLS;

const VIEW_OPTIONS = [
    { value: 'feed', label: 'Feed' },
    { value: 'grid', label: 'Grid' },
];

const DraftPanel = ({ leagueData, playerInfo, rosterInfo, rankingPlayersIdsList, myDisplayName, updateDraftBoard }) => {
    const { currentDraft, rosterData } = leagueData;
    const draftPath = DRAFT + currentDraft.draft_id + '/';
    const [isSyncing, setIsSyncing] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState(currentDraft.draft_id);
    const [DRAFT_PATH, setDraftPath] = useState(draftPath);
    // Feed is the default view - the grid is the newer, denser one and
    // shouldn't change what people already sync a draft against.
    const [boardView, setBoardView] = useState('feed');

    const { newPickKeys, markSeen } = useSeenPicks({
        draftId: currentDraft.draft_id,
        builtDraft: currentDraft.built_draft,
    });

    const updateDraftID = (val) => {
        setCurrentDraftId(val);
        setDraftPath(DRAFT + val + '/');
    };

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
            <div className="league-grid">
                <p>
                    <b>Draft ID</b>
                </p>
                <input
                    type="text"
                    className="input-small"
                    value={currentDraftId}
                    onChange={(e) => updateDraftID(e.target.value)}
                />
                <Button text="Update" btnStyle="primary" onClick={getLiveDraft} />
                <p>
                    <b>{`${currentDraft.season} ${currentDraft.player_pool} Draft`}</b>
                </p>
                <p>Status: {currentDraft.status}</p>
                <PickClock draft={currentDraft} />
                <Button
                    text={!isSyncing ? 'Sync draft' : 'Stop sync'}
                    btnStyle={isSyncing ? 'primary-large active' : 'primary-large'}
                    onClick={() => setIsSyncing(!isSyncing)}
                />
            </div>
            <div className="player-grid">
                {currentDraft.built_draft && (
                    <>
                        <SegmentedControl
                            label="Draft board view"
                            options={VIEW_OPTIONS}
                            value={boardView}
                            onChange={setBoardView}
                        />
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
                        <BestAvailableSheet
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default DraftPanel;
