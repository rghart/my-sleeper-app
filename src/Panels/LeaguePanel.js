import React, { useState } from 'react';
import DraftPanel from './DraftPanel';
import Dropdown from '../Components/Dropdown';

const LeaguePanel = ({ leagueData, playerInfo, updateParentState, rosterPositions, leagueID, loadingMessage }) => {
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
                        {rosterPositions.map((pos, index) => (
                            <p className={`${pos} lineup-position`} key={pos + new Date().getTime() + index}>{pos}</p>
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
