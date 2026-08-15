import { slotAccessibleName, slotOccupantLabel } from './lineupLabels.js';
import ListRow from '../Components/ListRow';
import PositionTag from '../Components/PositionTag';
import InjuryTag from '../Components/InjuryTag';
import { injuryDetail } from '../Components/injuryLabels.js';

const SlotRow = ({ slot, index, playerInfo, onOpen }) => {
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

    // Both states now open the slot-scoped sheet: a filled slot's Remove
    // action moved there (a single tap must not be destructive), and an empty
    // slot fills from there too - there is no longer such a thing as a
    // fill-from-slot-that-does-nothing row.
    if (!slot.playerId) {
        return (
            <li>
                <ListRow
                    label={accessibleName}
                    onClick={() => onOpen(index)}
                    ordinal={slot.label}
                    ordinalWidth="44px"
                    ordinalClassName="text-[10px] font-semibold tracking-[.08em] text-ink-muted"
                    name="Add player"
                    nameTone="dim"
                    meta="Empty slot"
                    tone="empty"
                    trailing={<span className="text-ink-dim w-[7px] shrink-0 text-center text-[13px]">›</span>}
                />
            </li>
        );
    }

    return (
        <li>
            <ListRow
                label={accessibleName}
                onClick={() => onOpen(index)}
                ordinal={slot.label}
                ordinalWidth="44px"
                ordinalClassName="text-[10px] font-semibold tracking-[.08em] text-ink-muted"
                name={occupantName}
                nameAfter={<InjuryTag player={player} />}
                // No opponent/schedule data is available here, so only the
                // team renders on the meta line - inventing an opponent would
                // be worse than leaving the line short.
                //
                // No expected return date either: that lives on the value row
                // and this panel does not fetch values. Status and body part
                // are the parts a lineup decision actually turns on.
                meta={[player?.team, injuryDetail(player, null)].filter(Boolean).join(' · ')}
                trailing={player && <PositionTag position={player.position} />}
            />
        </li>
    );
};

export default SlotRow;
