import React, { useState } from 'react';
import Button from './Button';

const PlayerInfoItem = ({ player, playerInfo, addToRoster, searchData, updatePlayerId, isNewRankList }) => {
    const [editingPlayer, setEditingPlayer] = useState(false);

    const updatePlayerInfo = (e) => {
        const newPlayerId = e.target.value;
        const newPlayerIdIndex = searchData.match_results.findIndex((result) => result[0] === newPlayerId);
        const newPlayerIdResult = searchData.match_results.splice(newPlayerIdIndex, 1)[0];
        searchData.match_results.unshift(newPlayerIdResult);
        updatePlayerId(searchData);
        setEditingPlayer(false);
    };

    return (
        <div
            key={player.player_id}
            className={`single-player-item ${
                Number(searchData.match_results[0][1]) <= 0 ? player.position : 'search-alert'
            } ${player.is_taken ? '' : 'available'}`}
        >
            <div>
                <div className="player-name">
                    {editingPlayer && (
                        <>
                            <select className="dropdown" value={player.player_id} onChange={updatePlayerInfo}>
                                {searchData.match_results.map((result) => (
                                    <option key={result[0]} value={result[0]}>{`${playerInfo[result[0]].full_name} - ${
                                        playerInfo[result[0]].team ? playerInfo[result[0]].team : 'FA'
                                    } (${playerInfo[result[0]].position})`}</option>
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
                {(isNewRankList || Number(searchData.match_results[0][1]) > 0 || editingPlayer) && (
                    <div>
                        <p style={{ fontSize: 'small' }}>
                            <i>&quot;{searchData.search_string}&quot; </i> - Search score:{' '}
                            {searchData.match_results[0][1]}
                        </p>
                    </div>
                )}
                <div className="player-info">
                    <p className="player-info-item">
                        <b>Manager:</b> {player.rostered_by ? player.rostered_by : 'Free Agent'}
                    </p>
                    <p className="player-info-item">
                        <b>Rank:</b> {searchData.ranking}
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
