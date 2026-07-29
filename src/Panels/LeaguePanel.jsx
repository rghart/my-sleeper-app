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
        // Panel chrome copied from RanksPanel's own conversion of `.panel` -
        // both were `.panel` in the old sheet and must keep matching geometry.
        // `.league-panel` only ever zeroed out the padding side of it (and lost
        // that override on phones, where `.panel`'s `!important` rule won), so
        // `p-0` plus the same `max-md:p-[5px]` reproduces both halves.
        <div className="bg-raised mt-2 mr-[3px] mb-[3px] ml-[3px] flex h-full flex-1 flex-col rounded-[10px] p-0 max-md:p-[5px]">
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
