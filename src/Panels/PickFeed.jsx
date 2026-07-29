import { useRef, useState } from 'react';
import RoundSection from './RoundSection';
import ManualPickModal from './ManualPickModal';
import { applyManualPick } from '../lib/liveDraft.js';
import { pickKey } from '../lib/seenPicks.js';

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
    newPickKeys = new Set(),
}) => {
    const [activePick, setActivePick] = useState(null);
    // Whatever had focus at the moment a pick was opened - Sheet returns
    // focus to it on close, same as Drawer.jsx does for the hamburger.
    // Captured on the fly rather than via a ref prop threaded through
    // PickRow, since the trigger can be any one of a whole round's worth of
    // pick buttons.
    const triggerRef = useRef(null);

    const openPick = (round, pick) => {
        triggerRef.current = document.activeElement;
        setActivePick({ round, pick });
    };
    const closeModal = () => setActivePick(null);

    const selectPlayer = (playerID) => {
        const updatedRound = applyManualPick({
            round: activePick.round,
            currentManualPick: activePick.pick,
            playerID,
        });
        // The second argument tells DraftPanel this change was a deliberate
        // manual entry, not a pick arriving from the live sync, so it can
        // mark it seen immediately - otherwise a manual pick would flash a
        // "NEW" chip at the person who just made it.
        onPickChange(updatedRound, pickKey(activePick.round, activePick.pick));
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
                    newPickKeys={newPickKeys}
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
                    triggerRef={triggerRef}
                />
            )}
        </div>
    );
};

export default PickFeed;
