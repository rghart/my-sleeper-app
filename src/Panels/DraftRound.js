import React, { useState } from 'react';
import Button from '../Components/Button';

const DraftRound = ({ round, playerInfo, rosterData }) => {
    const [picks, setPicks] = useState(round.picks);
    const [showRound, setShowRound] = useState(true);
    const [showPickSelection, setShowPickSelection] = useState(false);
    const [currentManualPick, setCurrentManualPick] = useState();
    const [searchValue, setSearchValue] = useState('');

    const manualPickSelection = (pick) => {
        setCurrentManualPick(pick);
        setShowPickSelection(!showPickSelection);
    };

    const updatePickSelection = (playerID) => {
        picks[
            picks.findIndex((pick) => pick.pick_spot_string === currentManualPick.pick_spot_string)
        ].player_id = playerID;
        setCurrentManualPick(null);
        setPicks(picks);
        setShowPickSelection(!showPickSelection);
        setSearchValue('');
    };

    return (
        <>
            {!showPickSelection && (
                <div key={round.round} className="draft-round-box">
                    <div className={'draft-picks-box'}>
                        <h4 className="round-number clickable-item" onClick={() => setShowRound(!showRound)}>
                            Round {round.round}
                        </h4>
                        {picks.map((pick) => (
                            <div
                                key={pick.pick_spot_string}
                                className={`draft-pick clickable-item ${!showRound ? 'is-hidden' : null}`}
                                onClick={() => manualPickSelection(pick)}
                            >
                                <p className="pick-string">{pick.pick_spot_string}</p>
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
            )}
            {showPickSelection && (
                <div>
                    <h4>Manually select pick</h4>
                    <input
                        type="text"
                        className="input-small"
                        onChange={(e) => setSearchValue(e.target.value)}
                        placeholder="Start typing player name to search"
                    />
                    <Button btnStyle="primary" text="Exit" onClick={() => setShowPickSelection(!showPickSelection)} />
                    {currentManualPick.player_id && (
                        <p
                            className="clickable-item draft-pick-rows QB"
                            style={{ width: 'fit-content', padding: `${0} ${3}px`, border: 2 + 'px' }}
                            onClick={() => updatePickSelection(null)}
                        >
                            Remove pick?
                        </p>
                    )}
                    {searchValue.length > 2 &&
                        Object.values(playerInfo)
                            .filter((player) =>
                                player.full_name
                                    ? player.full_name.toLowerCase().includes(searchValue.toLowerCase())
                                    : null,
                            )
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
            )}
        </>
    );
};

export default DraftRound;
