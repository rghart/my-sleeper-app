import { useState, useEffect, useRef } from 'react';
import Button from '../Components/Button';
import DraftRound from './DraftRound';
import { SLEEPER_API_URLS } from '../urls';
import { syncLiveDraft } from '../lib/liveDraft.js';
const { DRAFT, PICKS, TRADED_PICKS } = SLEEPER_API_URLS;

const DraftPanel = ({ leagueData, playerInfo, rosterInfo, rankingPlayersIdsList, updateDraftBoard }) => {
    const { currentDraft, rosterData } = leagueData;
    const draftPath = DRAFT + currentDraft.draft_id + '/';
    const [isSyncing, setIsSyncing] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState(currentDraft.draft_id);
    const [DRAFT_PATH, setDraftPath] = useState(draftPath);

    const updateDraftID = (val) => {
        setCurrentDraftId(val);
        setDraftPath(DRAFT + val + '/');
    };

    const handlePickChange = (updatedRound) => {
        updateDraftBoard((builtDraft) =>
            builtDraft.map((round) => (round.round === updatedRound.round ? updatedRound : round)),
        );
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
            timer = setTimeout(poll, 3000);
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
                <Button
                    text={!isSyncing ? 'Sync draft' : 'Stop sync'}
                    btnStyle={isSyncing ? 'primary-large active' : 'primary-large'}
                    onClick={() => setIsSyncing(!isSyncing)}
                />
            </div>
            <div className="player-grid">
                {currentDraft.built_draft &&
                    currentDraft.built_draft.map((round) => (
                        <div key={round.round} className="draft-round-box">
                            <DraftRound
                                round={round}
                                playerInfo={playerInfo}
                                rosterInfo={rosterInfo}
                                rankingPlayersIdsList={rankingPlayersIdsList}
                                rosterData={rosterData}
                                onPickChange={handlePickChange}
                            />
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default DraftPanel;
