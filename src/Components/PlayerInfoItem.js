import React, { useState } from 'react';

const PlayerInfoItem = ({ player, addToRoster, rankingPlayersIdsList, updatePlayerId }) => {
    
    const [editingPlayer, setEditingPlayer] = useState(false);
    const rankPlayerId = rankingPlayersIdsList.find(obj => obj.match_results[0].item.player_id === player.player_id);
    const updatePlayerInfo = (e) => {
        const newPlayerId = e.target.value;
        const newPlayerIdIndex = rankPlayerId.match_results.findIndex(result => result.item.player_id === newPlayerId);
        const newPlayerIdResult = rankPlayerId.match_results.splice(newPlayerIdIndex, 1)[0];
        rankPlayerId.match_results.unshift(newPlayerIdResult);
        const currentIdIndex = rankingPlayersIdsList.findIndex(obj => obj.ranking === rankPlayerId.ranking);
        rankingPlayersIdsList.splice(currentIdIndex, 1, rankPlayerId);
        updatePlayerId(rankingPlayersIdsList);
        setEditingPlayer(false);
    }

    return (
        <div key={player.player_id} className={`single-player-item ${player.position} ${player.is_taken ? "" : "available"}`}>
            <div>
                <div className="player-name">
                    {
                        editingPlayer &&
                        <> 
                            <select className="dropdown" value={player.player_id} onChange={updatePlayerInfo}>
                                {rankPlayerId.match_results.map(result => (   
                                    <option key={result.refIndex} value={result.item.player_id}>{`${result.item.full_name} - ${result.item.team ? result.item.team : "FA"} (${result.item.position})`}</option>
                                ))}
                            </select>
                            <button className="button player-add-button" onClick={() => setEditingPlayer(false)}>
                                Close
                            </button>
                        </>
                    }
                    { 
                        !editingPlayer && 
                        <>
                            <p className="clickable-player-name" onClick={() => setEditingPlayer(true)}><b>Player name: {player.full_name}</b></p>
                            <p className="player-info-item">- {player.team}</p>
                            <p className="player-info-item">({player.position})</p>
                        </>
                    }
                </div>
                <div className="player-info">
                    <p className="player-info-item"><b>Is rostered:</b> {player.is_taken ? player.is_taken.toString() : "false"} </p>
                    <p className="player-info-item"><b>Rostered by:</b> {player.rostered_by ? player.rostered_by : "None"}</p>
                    <p className="player-info-item"><b>Weekly rank:</b> {rankPlayerId.ranking}</p>
                </div>
            </div>
            {
                (player.rostered_by && player.rostered_by === "ryangh") || !player.is_taken ?   
                <button className="button player-add-button" onClick={() => addToRoster(player)}>
                    Add
                </button>
                : null
            }
        </div>
    );
}

export default PlayerInfoItem;
