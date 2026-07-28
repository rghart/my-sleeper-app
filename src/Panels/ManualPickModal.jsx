import { useState } from 'react';
import Button from '../Components/Button';
import { isTaken } from '../lib/rosterInfo.js';

// Lifted out of DraftRound as-is - this is the modal's existing behaviour and
// styling, not a redesigned piece of this migration.
const style = {
    manualPickModal: {
        position: 'fixed',
        background: '#0F1720',
        zIndex: 999,
        bottom: 0,
        top: 45 + '%',
        right: 0,
        left: 51.1 + '%',
        borderRadius: 10 + 'px',
        padding: 6 + 'px',
    },
};

const ManualPickModal = ({
    round,
    currentManualPick,
    playerInfo,
    rosterInfo,
    rankingPlayersIdsList,
    onSelect,
    onClose,
}) => {
    const [searchValue, setSearchValue] = useState('');

    const selectPlayer = (playerID) => {
        onSelect(playerID);
        setSearchValue('');
    };

    return (
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
                        setSearchValue('');
                        onClose();
                    }}
                />
            </div>
            <div style={{ overflow: 'scroll', height: 75 + '%' }}>
                {currentManualPick.player_id && (
                    <p
                        className="clickable-item draft-pick-rows QB"
                        style={{ width: 'fit-content', padding: `${0} ${3}px`, border: 2 + 'px' }}
                        onClick={() => selectPlayer(null)}
                    >
                        Remove pick?
                    </p>
                )}
                {searchValue.length < 2 &&
                    rankingPlayersIdsList
                        .filter((result) => !isTaken(rosterInfo, result.match_results[0][0]))
                        .map((data, i) => (
                            <p
                                className={`clickable-item draft-pick-rows ${
                                    playerInfo[data.match_results[0][0]].position
                                }`}
                                style={{ padding: `${0} ${3}px` }}
                                key={playerInfo[data.match_results[0][0]].player_id + i}
                                onClick={() => selectPlayer(playerInfo[data.match_results[0][0]].player_id)}
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
                                onClick={() => selectPlayer(player.player_id)}
                            >
                                {player.full_name} {player.position} {player.team ? player.team : null}
                            </p>
                        ))}
            </div>
        </div>
    );
};

export default ManualPickModal;
