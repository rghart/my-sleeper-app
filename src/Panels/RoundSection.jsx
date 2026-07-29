import { useState } from 'react';
import PickRow from './PickRow';
import { countNewInRound } from '../lib/seenPicks.js';

const RoundSection = ({ round, playerInfo, rosterData, myDisplayName, onOpenPick, newPickKeys = new Set() }) => {
    const [showRound, setShowRound] = useState(true);
    const newCount = countNewInRound(round, newPickKeys);
    const madeCount = round.picks.filter((pick) => pick.player_id).length;

    return (
        <section>
            {/* The toggle is a real button inside the heading rather than a
                click handler on the heading itself: collapsing a round is
                reachable from the keyboard, and aria-expanded says which way
                it currently is. */}
            <h4 className="border-line-quiet bg-ground sticky top-0 z-10 border-b px-3.5 py-2">
                <button
                    type="button"
                    aria-expanded={showRound}
                    onClick={() => setShowRound((prev) => !prev)}
                    className="flex w-full cursor-pointer items-center gap-2 text-left"
                >
                    {/* Kept as its own element, not concatenated into the
                        "N new" chip's text, so screen.getByText('Round 1')
                        keeps resolving - the round-collapsing test depends on
                        this exact node. Uppercased via CSS rather than a
                        literal "ROUND 1" so that text query still matches. */}
                    <span className="text-ink font-mono text-[11px] font-semibold tracking-[.12em] uppercase">
                        Round {round.round}
                    </span>
                    <span className="text-ink-dim font-mono text-[11px]">
                        {madeCount} / {round.picks.length}
                    </span>
                    {newCount > 0 && (
                        <span className="text-live ml-auto font-mono text-[10px] font-semibold tracking-[.1em] uppercase">
                            {newCount} new
                        </span>
                    )}
                </button>
            </h4>
            {showRound && (
                <ol aria-label={`Round ${round.round}`} className="flex flex-col gap-0.5 px-2 py-1">
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
