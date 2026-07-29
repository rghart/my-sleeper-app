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
    addToRoster,
    view,
}) => {
    return (
        // No card. The redesign puts lists directly on the ground plane -
        // "no cards around lists" is one of design-system.md's hard rules, and
        // the rounded `bg-raised` box this used to wear was the last of the
        // old `.panel` chrome. Elevation is now reserved for the two surfaces
        // that earn it: the clock card and sheets.
        <div className="flex h-full flex-1 flex-col">
            {isLoading ? (
                <Spinner size="panel" />
            ) : (
                <>
                    {view === 'weekly' && (
                        <LineupPanel
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                            rosterSlots={rosterSlots}
                            removeFromLineup={removeFromLineup}
                            rankingPlayersIdsList={rankingPlayersIdsList}
                            myDisplayName={myDisplayName}
                            addToRoster={addToRoster}
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
