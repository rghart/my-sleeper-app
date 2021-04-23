import React, { useState, useEffect } from 'react';
import Button from '../Components/Button';
import DraftRound from './DraftRound';
import { SLEEPER_API_URLS } from '../urls';
const { DRAFT, PICKS, TRADED_PICKS } = SLEEPER_API_URLS;

const DraftPanel = ({ leagueData, playerInfo, updateParentState: updatePlayerInfo }) => {
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

    const getLiveDraft = async () => {
        let newPlayerInfo = playerInfo;
        const liveDraftData = await fetch(DRAFT_PATH + PICKS)
            .then((response) => response.json())
            .then((data) => data)
            .catch((error) => {
                console.error('Error:', error);
            });
        console.log(liveDraftData);
        let newLiveDraft = liveDraft;
        await liveDraftData.forEach((livePick) => {
            let { round, draft_slot: draftSlot } = livePick;
            round -= 1;
            draftSlot -= 1;
            const pick = newLiveDraft.built_draft[round].picks[draftSlot];
            pick.player_id = livePick.player_id;
            pick.picked = true;
            newPlayerInfo[livePick.player_id].is_taken = true;
            newPlayerInfo[livePick.player_id].rostered_by = rosterData.find(
                (roster) => pick.owner_id === roster.roster_id,
            ).manager_display_name;
            newLiveDraft.built_draft[round].picks[draftSlot] = pick;
        });
        updatePlayerInfo('playerInfo', { ...newPlayerInfo }, 'filterPlayers', '');
        newLiveDraft = await getTradedDraftPicks(newLiveDraft);
        setLiveDraft({ ...newLiveDraft });
    };

    const getTradedDraftPicks = async (newLiveDraft) => {
        const { built_draft: builtDraft } = newLiveDraft;
        const tradedPicks = await fetch(DRAFT_PATH + TRADED_PICKS)
            .then((response) => response.json())
            .then((data) => data)
            .catch((error) => {
                console.error('Error:', error);
            });
        console.log(tradedPicks);

        tradedPicks.forEach((tradedPick) => {
            let { round } = tradedPick;
            round -= 1;
            const { picks } = builtDraft[round];
            let pickIndex = picks.findIndex((pick) => pick.roster_id === tradedPick.roster_id);
            Object.assign(picks[pickIndex], {
                owner_id: tradedPick.owner_id,
                is_traded: true,
            });
            builtDraft[round].picks = picks;
        });
        newLiveDraft.built_draft = builtDraft;
        return newLiveDraft;
    };

    useEffect(() => {
        let timer;
        if (isSyncing) {
            const callback = async () => {
                await getLiveDraft();
                timer = setTimeout(callback, 3000);
            };
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
                                rosterData={rosterData}
                                updatePlayerInfo={updatePlayerInfo}
                            />
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default DraftPanel;
