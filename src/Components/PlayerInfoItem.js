import React, { useState } from 'react';
import Button from './Button';

const PlayerInfoItem = ({ player, playerInfo, addToRoster, searchData, updatePlayerId, isNewRankList, adpData }) => {
    const [editingPlayer, setEditingPlayer] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    const updatePlayerInfo = (newPlayerId) => {
        let newSearchData = { ...searchData };
        let newPlayerIdResult;
        const newPlayerIdIndex = newSearchData.match_results.findIndex((result) => result[0] === newPlayerId);

        if (newPlayerIdIndex > 0) {
            newPlayerIdResult = newSearchData.match_results.splice(newPlayerIdIndex, 1)[0];
            newSearchData.match_results.unshift(newPlayerIdResult);
        } else {
            newPlayerIdResult = [newPlayerId, '0.000'];
            if (newPlayerIdIndex === 0) {
                newSearchData.match_results.shift();
            }
            newSearchData.match_results.unshift(newPlayerIdResult);
        }

        updatePlayerId(newSearchData);
        setEditingPlayer(false);
    };

    return (
        <div
            key={player.player_id}
            className={`single-player-item ${
                Number(searchData.match_results[0][1]) <= 0 ? player.position : 'search-alert'
            } ${player.is_taken ? '' : `${player.position}-available`}`}
        >
            <div className="player-name" style={{ gridColumnStart: 1, gridColumnEnd: 4 }}>
                {editingPlayer && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <select
                            className="dropdown"
                            value={player.player_id}
                            onChange={(e) => updatePlayerInfo(e.target.value)}
                        >
                            {searchData.match_results.map((result) => (
                                <option key={result[0]} value={result[0]}>{`${playerInfo[result[0]].full_name} - ${
                                    playerInfo[result[0]].team ? playerInfo[result[0]].team : 'FA'
                                } (${playerInfo[result[0]].position})`}</option>
                            ))}
                        </select>
                        <div>
                            <Button text="Close" btnStyle="primary-invert" onClick={() => setEditingPlayer(false)} />
                            <Button text="Delete" btnStyle="alert" onClick={() => updatePlayerId(searchData, true)} />
                        </div>
                        {(isNewRankList || Number(searchData.match_results[0][1]) > 0 || editingPlayer) && (
                            <div>
                                <p style={{ fontSize: 'small' }}>
                                    <i>&quot;{searchData.search_string}&quot; </i> - Search score:{' '}
                                    {searchData.match_results[0][1]}
                                </p>
                                {editingPlayer && (
                                    <input
                                        type="text"
                                        className="input-small"
                                        onChange={(e) => setSearchValue(e.target.value)}
                                        placeholder="Manually update player"
                                    />
                                )}
                                {searchValue.length > 2 &&
                                    Object.values(playerInfo)
                                        .filter((player) =>
                                            player.full_name
                                                ? player.full_name.toLowerCase().includes(searchValue.toLowerCase()) &&
                                                  ['QB', 'RB', 'WR', 'TE'].includes(player.position)
                                                : null,
                                        )
                                        .sort((a, b) => a.search_rank - b.search_rank)
                                        .map((player) => (
                                            <p
                                                className={`clickable-item draft-pick-rows ${player.position}`}
                                                style={{ padding: `${0} ${3}px` }}
                                                key={player.player_id}
                                                onClick={() => updatePlayerInfo(player.player_id)}
                                            >
                                                {player.full_name} {player.position} {player.team ? player.team : null}
                                            </p>
                                        ))}
                            </div>
                        )}
                    </div>
                )}
                {!editingPlayer && (
                    <>
                        <span className="clickable-item full-text" onClick={() => setEditingPlayer(true)}>
                            <b>{player.full_name}</b>
                        </span>
                        <span className="clickable-item abbr-text" onClick={() => setEditingPlayer(true)}>
                            <b>{`${player.first_name.split('')[0]}.${player.last_name}`}</b>
                        </span>
                        <span className="player-info-item" style={{ marginLeft: 2 + 'px', whiteSpace: 'nowrap' }}>
                            {` - ${player.team}`} ({player.position})
                        </span>
                    </>
                )}
            </div>
            <div className="player-info" style={{ gridRowStart: 2 }}>
                <p className="player-info-item">
                    <b>Rank:</b> {searchData.ranking}
                </p>
                <p className="player-info-item">
                    <b>Manager:</b> {player.rostered_by ? player.rostered_by : 'Free Agent'}
                </p>
            </div>
            {adpData && (
                <div style={{ display: 'flex', alignItems: 'center', gridRowStart: 3 }}>
                    <p className="player-info-item">
                        <b>ADP:</b> {adpData ? adpData : null}
                    </p>
                    <p className="player-info-item" style={{ fontSize: 'x-small' }}>
                        {Math.round(Number(searchData.ranking) - adpData) < 0
                            ? 'Ranked ' + Math.round(adpData - Number(searchData.ranking)) + ' picks before ADP'
                            : Math.round(Number(searchData.ranking) - adpData) === 0
                            ? 'Rank matches ADP'
                            : 'Ranked ' + Math.round(Number(searchData.ranking) - adpData) + ' picks after ADP'}
                    </p>
                </div>
            )}
            <div style={{ gridRowStart: 2, gridColumnStart: 2 }}>
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
            {(player.rostered_by && player.rostered_by === 'ryangh') || !player.is_taken ? (
                <div style={{ gridColumnStart: 2, gridRowStart: 3 }}>
                    <Button
                        text={`${player.in_lineup ? 'Added' : 'Add'}`}
                        isDisabled={player.in_lineup}
                        btnStyle="player-add-button"
                        onClick={() => addToRoster(player)}
                    />
                </div>
            ) : null}
        </div>
    );
};

export default PlayerInfoItem;
