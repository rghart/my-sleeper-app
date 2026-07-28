import { useState } from 'react';
import PickRow from './PickRow';
import { countNewInRound } from '../lib/seenPicks.js';

const RoundSection = ({ round, playerInfo, rosterData, myDisplayName, onOpenPick, newPickKeys = new Set() }) => {
    const [showRound, setShowRound] = useState(true);
    const newCount = countNewInRound(round, newPickKeys);

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
                    className="text-ink m-0 flex w-full cursor-pointer appearance-none items-center gap-2 rounded-none border-0 bg-transparent px-3 py-2 text-left text-sm font-semibold"
                >
                    {/* Kept as its own element, not concatenated into the
                        "N new" chip's text, so screen.getByText('Round 1')
                        keeps resolving - the round-collapsing test depends on
                        this exact node. */}
                    <span>Round {round.round}</span>
                    {newCount > 0 && (
                        <span className="bg-ink text-ground rounded-[4px] px-1.5 py-0.5 text-xs font-semibold">
                            {newCount} new
                        </span>
                    )}
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
                            newPickKeys={newPickKeys}
                        />
                    ))}
                </ol>
            )}
        </section>
    );
};

export default RoundSection;
