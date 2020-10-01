import React from 'react';

const PlayerInfoItem = ({ player, addToRoster, rankingPlayersIdsList }) => {
  return (
      <div key={player.player_id} className={`single-player-item ${player.position} ${player.is_taken ? "" : "available"}`}>
        <div className="player-name">
            <p><b>Player name: {player.full_name}</b></p>
            <p className="player-info-item">- {player.team}</p>
            <p className="player-info-item">({player.position})</p>
        </div>
        <div className="player-info">
            <p className="player-info-item"><b>Is rostered:</b> {player.is_taken ? player.is_taken.toString() : "false"} </p>
            <p className="player-info-item"><b>Rostered by:</b> {player.rostered_by ? player.rostered_by : "None"}</p>
            <p className="player-info-item"><b>Weekly rank:</b> {rankingPlayersIdsList.indexOf(player.player_id) + 1}</p>
            <button onClick={() => addToRoster(player)}>
                Add
            </button>
        </div>
      </div>
  );
}

export default PlayerInfoItem;
