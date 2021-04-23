import React, { useState } from 'react';
import Button from './Button';

const PlayerInfoItem = ({ player, playerInfo, addToRoster, rankingPlayersIdsList, updatePlayerId }) => {
    const [editingPlayer, setEditingPlayer] = useState(false);
    const rankPlayerId = rankingPlayersIdsList.find((obj) => obj.match_results[0] === player.player_id);
    const updatePlayerInfo = (e) => {
        const newPlayerId = e.target.value;
        const newPlayerIdIndex = rankPlayerId.match_results.findIndex((result) => result === newPlayerId);
        const newPlayerIdResult = rankPlayerId.match_results.splice(newPlayerIdIndex, 1)[0];
        rankPlayerId.match_results.unshift(newPlayerIdResult);
        const currentIdIndex = rankingPlayersIdsList.findIndex((obj) => obj.ranking === rankPlayerId.ranking);
        rankingPlayersIdsList.splice(currentIdIndex, 1, rankPlayerId);
        updatePlayerId(rankingPlayersIdsList);
        setEditingPlayer(false);
    };

    return (
        <div
            key={player.player_id}
            className={`single-player-item ${player.position} ${player.is_taken ? '' : 'available'}`}
        >
            <div>
                <div className="player-name">
                    {editingPlayer && (
                        <>
                            <select className="dropdown" value={player.player_id} onChange={updatePlayerInfo}>
                                {rankPlayerId.match_results.map((result) => (
                                    <option key={result} value={result}>{`${playerInfo[result].full_name} - ${
                                        playerInfo[result].team ? playerInfo[result].team : 'FA'
                                    } (${playerInfo[result].position})`}</option>
                                ))}
                            </select>
                            <Button text="Close" btnStyle="primary-invert" onClick={() => setEditingPlayer(false)} />
                        </>
                    )}
                    {!editingPlayer && (
                        <>
                            <span className="clickable-item full-text" onClick={() => setEditingPlayer(true)}>
                                <b>{player.full_name}</b>
                            </span>
                            <span className="clickable-item abbr-text" onClick={() => setEditingPlayer(true)}>
                                <b>{`${player.first_name.split('')[0]}.${player.last_name}`}</b>
                            </span>
                            <p className="player-info-item" style={{ marginLeft: 3 + 'px' }}>
                                {' '}
                                - {player.team}
                            </p>
                            <p className="player-info-item">({player.position})</p>
                        </>
                    )}
                </div>
                <div className="player-info">
                    <p className="player-info-item">
                        <b>Manager:</b> {player.rostered_by ? player.rostered_by : 'Free Agent'}
                    </p>
                    <p className="player-info-item">
                        <b>Rank:</b> {rankPlayerId.ranking}
                    </p>
                    <div>
                        <div
                            className="avatar-player"
                            aria-label="nfl Player"
                            style={{
                                width: 32 + 'px',
                                height: 32 + 'px',
                                flex: '0 0 32 px',
                                background: `url(https://sleepercdn.com/content/nfl/players/thumb/${player.player_id}.jpg) center center / cover rgb(239, 239, 239)`,
                                borderRadius: 33 + '%',
                                marginTop: -3 + '%',
                                marginLeft: 30 + 'px',
                                backgroundColor: 'transparent',
                            }}
                        ></div>
                        <div
                            className="avatar-player"
                            aria-label="nfl Player"
                            style={{
                                width: 17 + 'px',
                                height: 17 + 'px',
                                flex: '0 0 32 px',
                                background: `url(https://sleepercdn.com/images/team_logos/nfl/${
                                    player.team ? player.team.toLowerCase() : null
                                }.png) center center / cover rgb(239, 239, 239)`,
                                borderRadius: 33 + '%',
                                margin: `${-3}% ${0} ${-10}px ${30}px`,
                                position: 'relative',
                                top: -10 + 'px',
                                left: 17 + 'px',
                                backgroundColor: 'transparent',
                            }}
                        ></div>
                    </div>
                </div>
            </div>
            {(player.rostered_by && player.rostered_by === 'ryangh') || !player.is_taken ? (
                <Button
                    text={`${player.in_lineup ? 'Added' : 'Add'}`}
                    isDisabled={player.in_lineup}
                    btnStyle="player-add-button"
                    onClick={() => addToRoster(player)}
                />
            ) : null}
        </div>
    );
};

export default PlayerInfoItem;
