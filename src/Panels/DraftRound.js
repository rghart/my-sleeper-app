import React, { useState, useEffect } from 'react';
import Button from '../Components/Button';

const DraftRound = ({ round, playerInfo, rosterData, updatePlayerInfo, rankingPlayersIdsList }) => {
    const [picks, setPicks] = useState(round.picks);
    const [showRound, setShowRound] = useState(true);
    const [showPickSelection, setShowPickSelection] = useState(false);
    const [currentManualPick, setCurrentManualPick] = useState();
    const [searchValue, setSearchValue] = useState('');

    const manualPickSelection = (pick) => {
        setCurrentManualPick({ ...pick });
        setShowPickSelection(!showPickSelection);
    };

    const updatePickSelection = async (playerID) => {
        picks[picks.findIndex((pick) => pick.pick_number === currentManualPick.pick_number)].player_id = playerID;
        let newPlayerInfo = playerInfo;
        if (playerID) {
            newPlayerInfo[playerID].is_taken = true;
            newPlayerInfo[playerID].rostered_by = rosterData.find(
                (roster) => currentManualPick.owner_id === roster.roster_id,
            ).manager_display_name;
        } else {
            newPlayerInfo[currentManualPick.player_id].is_taken = false;
            newPlayerInfo[currentManualPick.player_id].rostered_by = null;
        }
        setCurrentManualPick(null);
        setPicks(picks);
        updatePlayerInfo('playerInfo', { ...newPlayerInfo });
        setShowPickSelection(!showPickSelection);
        setSearchValue('');
    };

    const style = {
        manualPickModal: {
            position: 'fixed',
            background: '#18202f',
            zIndex: 999,
            bottom: 0,
            top: 45 + '%',
            right: 0,
            left: 51.1 + '%',
            borderRadius: 10 + 'px',
            padding: 6 + 'px',
        },
    };

    return (
        <>
            <div key={round.round} className="draft-round-box">
                <div className={'draft-picks-box'}>
                    <h4 className="round-number clickable-item" onClick={() => setShowRound(!showRound)}>
                        Round {round.round}
                    </h4>
                    {picks.map((pick) => (
                        <div
                            key={pick.pick_number}
                            className={`draft-pick clickable-item ${!showRound ? 'is-hidden' : null}`}
                            onClick={() => manualPickSelection(pick)}
                        >
                            <p className="pick-string">{`${round.round}.${pick.pick_number}`}</p>
                            <div className="player-info-item draft-pick-rows">
                                <div style={{ display: 'flex' }}>
                                    <img
                                        className="avatar"
                                        src={`https://sleepercdn.com/avatars/thumbs/${
                                            rosterData.find((roster) => roster.roster_id === pick.owner_id).avatar
                                        }`}
                                        alt="Users avatar"
                                    />
                                    <p className="draft-pick">
                                        {
                                            rosterData.find((roster) => roster.roster_id === pick.owner_id)
                                                .manager_display_name
                                        }
                                        {pick.is_traded && pick.roster_id !== pick.owner_id
                                            ? ` via ${
                                                  rosterData.find((roster) => roster.roster_id === pick.roster_id)
                                                      .manager_display_name
                                              }`
                                            : null}
                                    </p>
                                </div>
                                {pick.player_id && (
                                    <div
                                        className={`${
                                            playerInfo[pick.player_id] ? playerInfo[pick.player_id].position : null
                                        } draft-pick-details`}
                                    >
                                        <span className="full-text" style={{ paddingRight: 3 + 'px' }}>
                                            {playerInfo[pick.player_id].full_name}
                                        </span>
                                        <span className="abbr-text" style={{ paddingRight: 3 + 'px' }}>
                                            {`${playerInfo[pick.player_id].first_name.split('')[0]}.${
                                                playerInfo[pick.player_id].last_name
                                            }`}{' '}
                                        </span>
                                        <p>{playerInfo[pick.player_id].team}</p>
                                        <p>{playerInfo[pick.player_id].position}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {showPickSelection && (
                <div style={style.manualPickModal}>
                    <div>
                        <h4>Manually select pick {`${round.round}.${currentManualPick.pick_number}`}</h4>
                        <input
                            type="text"
                            className="input-small"
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Start typing player name to search"
                        />
                        <Button
                            text="Exit"
                            btnStyle="primary"
                            onClick={() => {
                                setShowPickSelection(!showPickSelection);
                                setSearchValue('');
                            }}
                        />
                    </div>
                    <div style={{ overflow: 'scroll', height: 75 + '%' }}>
                        {currentManualPick.player_id && (
                            <p
                                className="clickable-item draft-pick-rows QB"
                                style={{ width: 'fit-content', padding: `${0} ${3}px`, border: 2 + 'px' }}
                                onClick={() => updatePickSelection(null)}
                            >
                                Remove pick?
                            </p>
                        )}
                        {searchValue.length < 2 &&
                            rankingPlayersIdsList
                                .filter((result) => !playerInfo[result.match_results[0][0]].is_taken)
                                .map((data, i) => (
                                    <p
                                        className={`clickable-item draft-pick-rows ${
                                            playerInfo[data.match_results[0][0]].position
                                        }`}
                                        style={{ padding: `${0} ${3}px` }}
                                        key={playerInfo[data.match_results[0][0]].player_id + i}
                                        onClick={() =>
                                            updatePickSelection(playerInfo[data.match_results[0][0]].player_id)
                                        }
                                    >
                                        {playerInfo[data.match_results[0][0]].full_name}{' '}
                                        {playerInfo[data.match_results[0][0]].position}{' '}
                                        {playerInfo[data.match_results[0][0]].team
                                            ? playerInfo[data.match_results[0][0]].team
                                            : null}
                                    </p>
                                ))}
                        {searchValue.length > 2 &&
                            Object.values(playerInfo)
                                .filter((player) =>
                                    player.full_name
                                        ? player.full_name.toLowerCase().includes(searchValue.toLowerCase()) &&
                                          ['QB', 'RB', 'WR', 'TE'].includes(player.position)
                                        : null,
                                )
                                .sort((a, b) => a.years_exp - b.years_exp)
                                .sort((a, b) => a.search_rank - b.search_rank)
                                .map((player) => (
                                    <p
                                        className={`clickable-item draft-pick-rows ${player.position}`}
                                        style={{ padding: `${0} ${3}px` }}
                                        key={player.player_id}
                                        onClick={() => updatePickSelection(player.player_id)}
                                    >
                                        {player.full_name} {player.position} {player.team ? player.team : null}
                                    </p>
                                ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default DraftRound;
