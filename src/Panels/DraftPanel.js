import React, {useState} from 'react';

const DraftPanel = ({ leagueData, playerInfo, updatePlayerInfo }) => {
    const { currentDraft, rosterData } = leagueData;
    // May need to pass this state and function in as a prop if it needs to interact with outer state. Just testing for now.
    const [liveDraft, setLiveDraft] = useState(currentDraft);

    const getLiveDraft = async () => {
        let newPlayerInfo = playerInfo;
        const liveDraftData = await fetch('https://api.sleeper.app/v1/draft/674338685663117312/picks')
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
        updatePlayerInfo({...newPlayerInfo});
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

    return (
        <div>
            <div className="league-grid">
                <p><b>{`${currentDraft.season} ${currentDraft.player_pool} Draft`}</b></p>
                <p>Status: {currentDraft.status}</p>
                <button className="button search-button" onClick={getLiveDraft}>Sync draft</button>
            </div>
            <div className="player-grid">
                {liveDraft.built_draft.map(round =>(
                    <div key={round.round} className="draft-round-box">    
                        <div className={"draft-picks-box"}>
                            <h4 className="round-number">Round {round.round}</h4>
                            {round.picks.map(pick => (
                                <div key={pick.pick_spot_string} className="draft-pick">
                                    <p className="pick-string">
                                        {pick.pick_spot_string}
                                    </p>
                                    <div className="player-info-item draft-pick-rows">
                                    <img className="avatar" src={`https://sleepercdn.com/avatars/thumbs/${rosterData.find(roster => roster.roster_id === pick.owner_id).avatar}`} alt="Users avatar"/>
                                        <p className="draft-pick">
                                            {rosterData.find(roster => roster.roster_id === pick.owner_id).manager_display_name}
                                            { (pick.is_traded && pick.roster_id !== pick.owner_id) ? ` via ${rosterData.find(roster => roster.roster_id === pick.roster_id).manager_display_name}` : null }
                                        </p>
                                        {
                                            pick.player_id && (
                                                <div className={`${playerInfo[pick.player_id] ? playerInfo[pick.player_id].position : null} draft-pick-details`}>
                                                    <p>{playerInfo[pick.player_id].full_name}</p> 
                                                    <p>{playerInfo[pick.player_id].team}</p>
                                                    <p>{playerInfo[pick.player_id].position}</p>
                                                </div>
                                            )
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DraftPanel;
