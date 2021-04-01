import React, { useState } from 'react';

const DraftRound = ({ round, playerInfo, rosterData }) => {
    const [showRound, setShowRound] = useState(true);

    return (
        <div key={round.round} className="draft-round-box">    
            <div className={"draft-picks-box"}>
                <h4 className="round-number clickable-item" onClick={() => setShowRound(!showRound)}>Round {round.round}</h4>
                {round.picks.map(pick => (
                    <div key={pick.pick_spot_string} className={`draft-pick ${!showRound ? 'is-hidden' : null}`}>
                        <p className="pick-string">
                            {pick.pick_spot_string}
                        </p>
                        <div className="player-info-item draft-pick-rows">
                        <div style={{display: "flex"}}>
                            <img className="avatar" src={`https://sleepercdn.com/avatars/thumbs/${rosterData.find(roster => roster.roster_id === pick.owner_id).avatar}`} alt="Users avatar"/>
                            <p className="draft-pick">
                                {rosterData.find(roster => roster.roster_id === pick.owner_id).manager_display_name}
                                { (pick.is_traded && pick.roster_id !== pick.owner_id) ? ` via ${rosterData.find(roster => roster.roster_id === pick.roster_id).manager_display_name}` : null }
                            </p>
                        </div>
                        {
                            pick.player_id && (
                                <div className={`${playerInfo[pick.player_id] ? playerInfo[pick.player_id].position : null} draft-pick-details`}>
                                    <span className="full-text">{playerInfo[pick.player_id].full_name}</span>
                                    <span className="abbr-text">{`${playerInfo[pick.player_id].first_name.split('')[0]}.${playerInfo[pick.player_id].last_name}`}</span>
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
    );
}

export default DraftRound;
