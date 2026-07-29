import { slotAccessibleName, slotOccupantLabel } from './lineupLabels.js';
import ListRow from '../Components/ListRow';
import PositionTag from '../Components/PositionTag';

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

    // Filled slots remove on click; empty slots have nothing to do. The
    // design captions empty slots "Tap to fill", but no fill-from-slot action
    // exists in this app - filling happens from the Ranks panel's Add button.
    // A control that does nothing is worse than none, so an empty slot is a
    // plain non-interactive row rather than a button with no effect.
    if (!slot.playerId) {
        return (
            <li>
                <ListRow
                    as="div"
                    label={accessibleName}
                    ordinal={slot.label}
                    ordinalWidth="44px"
                    ordinalClassName="text-[10px] font-semibold tracking-[.08em] text-ink-muted"
                    name="Add player"
                    nameTone="dim"
                    meta="Empty slot"
                    tone="empty"
                />
            </li>
        );
    }

    return (
        <li>
            <ListRow
                label={accessibleName}
                onClick={() => onRemove(index)}
                ordinal={slot.label}
                ordinalWidth="44px"
                ordinalClassName="text-[10px] font-semibold tracking-[.08em] text-ink-muted"
                name={occupantName}
                // No opponent/schedule data is available here, so only the
                // team renders on the meta line - inventing an opponent would
                // be worse than leaving the line short.
                meta={player?.team}
                trailing={player && <PositionTag position={player.position} />}
            />
        </li>
    );
};

export default SlotRow;
