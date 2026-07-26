import { useState, useEffect, useRef } from 'react';
import Button from '../Components/Button';
import DraftRound from './DraftRound';
import { SLEEPER_API_URLS } from '../urls';
import { syncLiveDraft } from '../lib/liveDraft.js';
const { DRAFT, PICKS, TRADED_PICKS } = SLEEPER_API_URLS;

const DraftPanel = ({ leagueData, playerInfo, updateParentState: updatePlayerInfo, rankingPlayersIdsList }) => {
    const { currentDraft, rosterData } = leagueData;
    const draftPath = DRAFT + currentDraft.draft_id + '/';
    const [liveDraft, setLiveDraft] = useState(currentDraft);
    const [isSyncing, setIsSyncing] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState(currentDraft.draft_id);
    const [DRAFT_PATH, setDraftPath] = useState(draftPath);

    const updateDraftID = (val) => {
        setCurrentDraftId(val);
        setDraftPath(DRAFT + val + '/');
    };

    const handlePickChange = (updatedRound) => {
        setLiveDraft((previousLiveDraft) => ({
            ...previousLiveDraft,
            built_draft: previousLiveDraft.built_draft.map((round) =>
                round.round === updatedRound.round ? updatedRound : round,
            ),
        }));
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

        const { liveDraft: newLiveDraft, playerInfo: newPlayerInfo } = syncLiveDraft({
            liveDraft,
            livePicks,
            tradedPicks,
            playerInfo,
            rosterData,
            draftType: leagueData.currentDraft.type,
        });

        updatePlayerInfo('playerInfo', newPlayerInfo, 'filterPlayers', '');
        setLiveDraft(newLiveDraft);
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
                    btnStyle={`primary-large ${isSyncing ? 'active' : null}`}
                    onClick={() => setIsSyncing(!isSyncing)}
                />
            </div>
            <div className="player-grid">
                {liveDraft.built_draft &&
                    liveDraft.built_draft.map((round) => (
                        <div key={round.round} className="draft-round-box">
                            <DraftRound
                                round={round}
                                playerInfo={playerInfo}
                                rankingPlayersIdsList={rankingPlayersIdsList}
                                rosterData={rosterData}
                                updatePlayerInfo={updatePlayerInfo}
                                onPickChange={handlePickChange}
                            />
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default DraftPanel;
