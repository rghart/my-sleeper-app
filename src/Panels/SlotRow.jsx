import { positionClass } from './pickLabels.js';
import { slotAccessibleName, slotOccupantLabel } from './lineupLabels.js';

const SlotRow = ({ slot, index, playerInfo, onRemove }) => {
    // A slot is occupied whenever it holds a player id, even if that id is
    // missing from the player database (a retired player dropped from it).
    // Keying the occupied state off the id rather than off the lookup means
    // such a slot still renders as filled and removable - matching PickRow,
    // which renders the raw id rather than a blank for the same case.
    const player = slot.playerId ? playerInfo[slot.playerId] : null;
    // Read off the same helper as the accessible name below. These were two
    // separate expressions and disagreed for a missing player - the row read a
    // bare id while the name said "Unknown player <id>", which is precisely the
    // drift lineupLabels.js exists to prevent.
    const occupantName = slotOccupantLabel({ slot, player });
    const accessibleName = slotAccessibleName({ slot, player });

    // Shared classes for the row geometry - copied from PickRow rather than
    // reinvented. min-h-14 rather than min-h-11 because the filled row's two
    // stacked lines already exceed 44px: the floor is what makes an empty and
    // a filled row agree on height instead of merely both clearing the 44px
    // touch minimum.
    const rowClasses =
        'm-0 flex min-h-14 w-full items-center gap-3 rounded-[5px] border bg-transparent px-3 py-2 text-left';

    const content = (
        <>
            <span className="text-ink-muted w-12 shrink-0 text-sm">{slot.label}</span>
            {slot.playerId ? (
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-ink truncate text-sm">{occupantName}</span>
                    {/* No opponent/schedule data is available here, so only the
                        team renders on the second line - inventing an opponent
                        would be worse than leaving the line short. */}
                    {player?.team && <span className="text-ink-muted truncate text-xs">{player.team}</span>}
                </span>
            ) : (
                <span className="text-ink-muted flex min-w-0 flex-1 flex-col text-sm">Empty</span>
            )}
            {player && (
                <span
                    className={`text-ground shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold ${positionClass(player.position)}`}
                >
                    {player.position}
                </span>
            )}
        </>
    );

    // Filled slots remove on click; empty slots have nothing to do. The
    // design captions empty slots "Tap to fill", but no fill-from-slot action
    // exists in this app - filling happens from the Ranks panel's Add button.
    // A control that does nothing is worse than none, so an empty slot is a
    // plain non-interactive row rather than a button with no effect.
    if (!slot.playerId) {
        return (
            <li>
                {/* role="group" so the aria-label is actually exposed: on a
                    bare div - role `generic` - most screen readers drop it,
                    which would leave the name working in tests and nowhere
                    else. The filled row below is a button and needs no role. */}
                <div role="group" aria-label={accessibleName} className={`${rowClasses} border-line border-dashed`}>
                    {content}
                </div>
            </li>
        );
    }

    return (
        <li>
            <button
                type="button"
                aria-label={accessibleName}
                onClick={() => onRemove(index)}
                className={`${rowClasses} border-line`}
            >
                {content}
            </button>
        </li>
    );
};

export default SlotRow;
