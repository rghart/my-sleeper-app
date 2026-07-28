import { useState } from 'react';
import RoundSection from './RoundSection';
import ManualPickModal from './ManualPickModal';
import { applyManualPick } from '../lib/liveDraft.js';

// All rounds of the by-round draft board, rebuilt as a feed: each round is a
// section with a sticky header and one row per pick. The manual-pick modal is
// lifted up here rather than living inside each round, since only one pick
// can be open at a time regardless of which round it belongs to.
const PickFeed = ({
    builtDraft,
    playerInfo,
    rosterInfo,
    rosterData,
    rankingPlayersIdsList,
    myDisplayName,
    onPickChange,
}) => {
    const [activePick, setActivePick] = useState(null);

    const openPick = (round, pick) => setActivePick({ round, pick });
    const closeModal = () => setActivePick(null);

    const selectPlayer = (playerID) => {
        const updatedRound = applyManualPick({
            round: activePick.round,
            currentManualPick: activePick.pick,
            playerID,
        });
        onPickChange(updatedRound);
        closeModal();
    };

    return (
        <div>
            {builtDraft.map((round) => (
                <RoundSection
                    key={round.round}
                    round={round}
                    playerInfo={playerInfo}
                    rosterData={rosterData}
                    myDisplayName={myDisplayName}
                    onOpenPick={openPick}
                />
            ))}
            {activePick && (
                <ManualPickModal
                    round={activePick.round}
                    currentManualPick={activePick.pick}
                    playerInfo={playerInfo}
                    rosterInfo={rosterInfo}
                    rankingPlayersIdsList={rankingPlayersIdsList}
                    onSelect={selectPlayer}
                    onClose={closeModal}
                />
            )}
        </div>
    );
};

export default PickFeed;
