import React, { useState, useEffect } from 'react';
import DraftRound from './DraftRound';

const DraftPanel = ({ leagueData, playerInfo, updateParentState: updatePlayerInfo }) => {
    const { currentDraft, rosterData } = leagueData;
    const [liveDraft, setLiveDraft] = useState(currentDraft);
    const [isSyncing, setIsSyncing] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState(currentDraft.draft_id);

    const getLiveDraft = async () => {
        let newPlayerInfo = playerInfo;
        const liveDraftData = await fetch(`https://api.sleeper.app/v1/draft/${currentDraftId}/picks`)
          .then(response => response.json())
          .then(data => data)
          .catch((error) => {
            console.error('Error:', error);
        })
        console.log(liveDraftData)
        let newLiveDraft = liveDraft;
        await liveDraftData.forEach(livePick => {
            let { round, draft_slot: draftSlot } = livePick;
            round -= 1;
            draftSlot -= 1;
            const pick = newLiveDraft.built_draft[round].picks[draftSlot];
            pick.player_id = livePick.player_id;
            pick.picked = true;
            newPlayerInfo[livePick.player_id].is_taken = true;
            newPlayerInfo[livePick.player_id].rostered_by = rosterData.find(roster => pick.owner_id === roster.roster_id).manager_display_name;
            newLiveDraft.built_draft[round].picks[draftSlot] = pick;
        })
        updatePlayerInfo("playerInfo", {...newPlayerInfo}, "filterPlayers", "");
        newLiveDraft = await getTradedDraftPicks(newLiveDraft);
        setLiveDraft({...newLiveDraft});
    }

    const getTradedDraftPicks = async (newLiveDraft) => {
        const { built_draft: builtDraft, draft_id: draftId } = newLiveDraft;
        const tradedPicks = await fetch(`https://api.sleeper.app/v1/draft/${draftId}/traded_picks`)
          .then(response => response.json())
          .then(data => data)
          .catch((error) => {
            console.error('Error:', error);
        })
        console.log(tradedPicks);

        tradedPicks.forEach(tradedPick => {
            let { round } = tradedPick;
            round -= 1;
            const { picks } = builtDraft[round];
            let pickIndex = picks.findIndex(pick => pick.roster_id === tradedPick.roster_id);
            Object.assign(picks[pickIndex], {
                owner_id: tradedPick.owner_id, 
                is_traded: true
            })
            builtDraft[round].picks = picks;
        })
        newLiveDraft.built_draft = builtDraft;
        return newLiveDraft;
    }

    useEffect(() => {
        let timer;
        if (isSyncing) {
            const callback = async () => {
                await getLiveDraft();
                timer = setTimeout(callback, 3000);
            }
            callback();
        } else {
            clearTimeout(timer);
        }
        return () => clearTimeout(timer);
        // eslint-disable-next-line
    }, [isSyncing])

    return (
        <div>
            <div className="league-grid">
                <p><b>Draft ID</b></p>
                <input type="text" className="input-small" value={currentDraftId} onChange={(e) => setCurrentDraftId(e.target.value)} />
                <button className="button sign-in-button" onClick={getLiveDraft}>Update</button>
                <p><b>{`${currentDraft.season} ${currentDraft.player_pool} Draft`}</b></p>
                <p>Status: {currentDraft.status}</p>
                <button className={`button search-button ${isSyncing ? 'syncing' : null}`} onClick={() => setIsSyncing(!isSyncing)}>
                    { !isSyncing ? "Sync draft" : "Stop sync"}
                </button>
            </div>
            <div className="player-grid">
                { liveDraft.built_draft && liveDraft.built_draft.map(round =>(
                    <div key={round.round} className="draft-round-box">    
                        <DraftRound round={round} playerInfo={playerInfo} rosterData={rosterData} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DraftPanel;
