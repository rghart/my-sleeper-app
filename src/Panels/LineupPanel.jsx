import SlotRow from './SlotRow';

const LineupPanel = ({ playerInfo, rosterSlots, removeFromLineup }) => {
    const emptyCount = rosterSlots.filter((slot) => !slot.playerId).length;

    return (
        <div>
            <h4 className="border-line bg-ground sticky top-0 z-10 m-0 flex items-center justify-between border-b border-solid px-3 py-2 text-sm font-semibold">
                <span>Starters</span>
                {/* Omitted entirely at zero rather than reading "0 empty" -
                    a full lineup has nothing to draw attention to. */}
                {emptyCount > 0 && <span className="text-ink-muted font-normal">{emptyCount} empty</span>}
            </h4>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 py-1">
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
