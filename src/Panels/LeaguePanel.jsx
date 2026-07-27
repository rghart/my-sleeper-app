import DraftPanel from './DraftPanel';
import Spinner from '../Components/Spinner';

const LeaguePanel = ({
    leagueData,
    playerInfo,
    rosterInfo,
    rosterSlots,
    isLoading,
    removeFromLineup,
    rankingPlayersIdsList,
    updateDraftBoard,
    view,
}) => {
    return (
        <div className="panel league-panel">
            {isLoading ? (
                <Spinner size="panel" />
            ) : (
                <>
                    {view === 'weekly' && (
                        <div className="roster-positions">
                            {rosterSlots.map((slot, i) => {
                                // A slot is occupied whenever it holds a player id, even if
                                // that id is missing from the player database (a retired
                                // player dropped from it). Keying the click off the id
                                // rather than off the lookup means such a slot can still be
                                // cleared - previously it rendered the raw id and could not
                                // be emptied at all.
                                const player = slot.playerId ? playerInfo[slot.playerId] : null;
                                const occupantName = player ? player.full_name : slot.playerId;
                                return (
                                    <div
                                        style={{ cursor: 'pointer' }}
                                        className={`${player ? player.position : slot.label} lineup-position`}
                                        key={`${slot.label}-${i}`}
                                        onClick={() => (slot.playerId ? removeFromLineup(i) : null)}
                                    >
                                        <span className="full-text" style={{ marginRight: 0 }}>
                                            <b>{slot.label}</b>
                                            {slot.playerId ? ` ${occupantName}` : null}
                                        </span>
                                        <span className="abbr-text" style={{ marginRight: 0 }}>
                                            <b>{slot.label}</b>
                                            {slot.playerId
                                                ? ` ${player ? `${player.first_name.split('')[0]}.${player.last_name}` : slot.playerId}`
                                                : null}
                                        </span>
                                        {player ? (
                                            <div
                                                style={{
                                                    marginBottom: -19 + 'px',
                                                    marginLeft: 3 + 'px',
                                                    position: 'relative',
                                                    bottom: 3 + 'px',
                                                }}
                                            >
                                                <div
                                                    className="avatar-player"
                                                    aria-label="nfl Player"
                                                    style={{
                                                        width: 22 + 'px',
                                                        height: 22 + 'px',
                                                        flex: '0 0 32 px',
                                                        background: `url(https://sleepercdn.com/content/nfl/players/thumb/${player.player_id}.jpg) center center / cover rgb(239, 239, 239)`,
                                                        borderRadius: 33 + '%',
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
                                                        position: 'relative',
                                                        top: -12 + 'px',
                                                        left: 10 + 'px',
                                                        backgroundColor: 'transparent',
                                                    }}
                                                ></div>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {view === 'draft' && (
                        <DraftPanel
                            leagueData={leagueData}
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            updateDraftBoard={updateDraftBoard}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default LeaguePanel;
