import DraftPanel from './DraftPanel';
import LineupPanel from './LineupPanel';
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
    myDisplayName,
    view,
}) => {
    return (
        <div className="panel league-panel">
            {isLoading ? (
                <Spinner size="panel" />
            ) : (
                <>
                    {view === 'weekly' && (
                        <LineupPanel
                            playerInfo={playerInfo}
                            rosterSlots={rosterSlots}
                            removeFromLineup={removeFromLineup}
                        />
                    )}
                    {view === 'draft' && (
                        <DraftPanel
                            leagueData={leagueData}
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            myDisplayName={myDisplayName}
                            updateDraftBoard={updateDraftBoard}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default LeaguePanel;
