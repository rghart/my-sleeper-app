import SlotRow from './SlotRow';

const LineupPanel = ({ playerInfo, rosterSlots, removeFromLineup }) => {
    const emptyCount = rosterSlots.filter((slot) => !slot.playerId).length;

    return (
        <div>
            {/* The app has no week number and no bye-week source in the
                Sleeper bundle, so the subhead reads just "{n} slots" rather
                than inventing "Week 1". */}
            <h4 className="border-line bg-ground sticky top-0 z-10 flex items-center justify-between border-b px-3.5 py-2">
                <span className="flex flex-col">
                    <span className="text-ink text-xl font-bold tracking-[-0.02em]">Starters</span>
                    <span className="text-ink-quiet font-mono text-[11px]">{rosterSlots.length} slots</span>
                </span>
                {/* Omitted entirely at zero rather than reading "0 empty" -
                    a full lineup has nothing to draw attention to. Text
                    content stays lowercase ("N empty") so the existing
                    getByText('2 empty') query keeps resolving; uppercase is
                    applied only visually via CSS, the same trick RoundSection
                    uses for "Round 1". */}
                {emptyCount > 0 && (
                    <span className="bg-warn-tint text-warn rounded-tag px-2.5 py-[5px] font-mono text-[11px] font-semibold tracking-[.08em] uppercase">
                        {emptyCount} empty
                    </span>
                )}
            </h4>
            <ul className="flex flex-col gap-0.5 px-2 py-1">
                {rosterSlots.map((slot, i) => (
                    <SlotRow
                        key={`${slot.label}-${i}`}
                        slot={slot}
                        index={i}
                        playerInfo={playerInfo}
                        onRemove={removeFromLineup}
                    />
                ))}
            </ul>
        </div>
    );
};

export default LineupPanel;
