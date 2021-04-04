import React, { useState } from 'react';
import DraftPanel from './DraftPanel';
import Dropdown from '../Components/Dropdown';

const LeaguePanel = ({ leagueData, playerInfo, updateParentState, rosterPositions, leagueID, loadingMessage, removeFromLineup }) => {
    const [leaguePanel, setLeaguePanel] = useState("draft");
    const updateLeagueID = (value) => {
        updateParentState("leagueID", value, "getLeagueData", "Loading league panel...")
    }

    return (
        <div className="panel league-panel">
        { 
            loadingMessage === "Loading league panel..." ? 
            <div className="panel-loader"></div> : 
            <>
                <div className="league-grid">
                    <p>
                        <b>{leagueData.currentLeague.name}</b>
                    </p>
                    <Dropdown currentValue={leagueID} updateCurrentValue={updateLeagueID}>
                        {leagueData.leagueIds.map(league => (
                            <option key={league.league_id} value={league.league_id}>{league.name}</option>
                        ))}
                    </Dropdown>
                    <div className="custom-horizontal-select">
                        <div className={`custom-horizontal-select-item ${leaguePanel === "weekly" ? "selected" : null}`} onClick={() => setLeaguePanel("weekly")}>
                            <div className="meta">
                                <div className="name">Weekly</div>
                                <div className="description">Lineup setter</div>
                            </div>
                        </div>
                        <div className={`custom-horizontal-select-item ${leaguePanel === "draft" ? "selected" : null}`}  onClick={() => setLeaguePanel("draft")}>
                            <div className="meta">
                                <div className="name">Draft</div>
                                <div className="description">Sync</div>
                            </div>
                        </div>
                    </div>
                </div>
                { leaguePanel === "weekly" && (
                    <div className="roster-positions">
                        {rosterPositions.map((id, i) => (
                            <div style={{cursor: "pointer"}} className={`${playerInfo[id] ? playerInfo[id].position : id} lineup-position`} key={playerInfo[id] ? playerInfo[id].player_id + new Date().getTime() + i : id + new Date().getTime() + i} onClick={() => playerInfo[id] ? removeFromLineup(id, i) : null}>
                                <span className="full-text" style={{marginRight: 0}}>{playerInfo[id] ? (<><b>{playerInfo[id].roster_text}</b> {playerInfo[id].full_name}</>) : <b>{id}</b>}</span>
                                <span className="abbr-text" style={{marginRight: 0}}>{playerInfo[id] ? (<><b>{playerInfo[id].roster_text}</b> {playerInfo[id].first_name.split("")[0]}.{playerInfo[id].last_name}</>) : <b>{id}</b>}</span>
                                { playerInfo[id] ? 
                                    <div style={{marginBottom: -19 + "px", marginLeft: 3 + "px", position: "relative", bottom: 3 + "px"}}>
                                        <div className="avatar-player" aria-label="nfl Player" style={{width: 22 + "px", height: 22 + "px", flex: "0 0 32 px", background: `url(https://sleepercdn.com/content/nfl/players/thumb/${playerInfo[id].player_id}.jpg) center center / cover rgb(239, 239, 239)`, borderRadius: 33 + "%", backgroundColor: "transparent"}}></div>
                                        <div className="avatar-player" aria-label="nfl Player" style={{width: 17 + "px", height: 17 + "px", flex: "0 0 32 px", background: `url(https://sleepercdn.com/images/team_logos/nfl/${playerInfo[id].team ? playerInfo[id].team.toLowerCase() : null}.png) center center / cover rgb(239, 239, 239)`, borderRadius: 33 + "%", position: "relative", top: -12 + "px", left: 10 + "px", backgroundColor: "transparent"}}></div>
                                    </div> 
                                    : null
                                }
                            </div>
                        ))}
                    </div>
                )}
                { leaguePanel === "draft" && (
                    <DraftPanel leagueData={leagueData} playerInfo={playerInfo} updateParentState={updateParentState}/>
                )}
            </>
        } 
        </div>
    );
}

export default LeaguePanel;
