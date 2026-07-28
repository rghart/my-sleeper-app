import { useState } from 'react';
import PickRow from './PickRow';

const RoundSection = ({ round, playerInfo, rosterData, myDisplayName, onOpenPick }) => {
    const [showRound, setShowRound] = useState(true);

    return (
        <section>
            {/* The toggle is a real button inside the heading rather than a
                click handler on the heading itself: collapsing a round is
                reachable from the keyboard, and aria-expanded says which way
                it currently is. */}
            <h4 className="border-line bg-ground sticky top-0 z-10 m-0 border-b border-solid text-sm font-semibold">
                <button
                    type="button"
                    aria-expanded={showRound}
                    onClick={() => setShowRound((prev) => !prev)}
                    className="text-ink m-0 w-full cursor-pointer appearance-none rounded-none border-0 bg-transparent px-3 py-2 text-left text-sm font-semibold"
                >
                    Round {round.round}
                </button>
            </h4>
            {showRound && (
                <ol aria-label={`Round ${round.round}`} className="m-0 flex list-none flex-col gap-1 p-0 py-1">
                    {round.picks.map((pick) => (
                        <PickRow
                            key={pick.pick_number}
                            round={round}
                            pick={pick}
                            playerInfo={playerInfo}
                            rosterData={rosterData}
                            myDisplayName={myDisplayName}
                            onSelect={() => onOpenPick(round, pick)}
                        />
                    ))}
                </ol>
            )}
        </section>
    );
};

export default RoundSection;
