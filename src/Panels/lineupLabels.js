import { injuryAccessibleText } from '../Components/injuryLabels.js';

// Builds the accessible name shared by SlotRow's filled and empty renders, so
// the visible text and the name cannot drift the way pickLabels.js does for
// the feed: "FLX, Colston Loveland, WR" for a filled slot, "WR, empty" for an
// empty one. The slot's own label always leads - see slotAccessibleName's
// callers in SlotRow for why the occupant's position is never substituted.

// The occupant's visible name. A slot can hold an id that is absent from the
// player database (a retired player dropped from it), and the raw id alone
// renders as a bare number that reads like a bug rather than a diagnosable
// gap - PickRow spells the same case out, so this matches it.
export const slotOccupantLabel = ({ slot, player }) => (player ? player.full_name : `Unknown player ${slot.playerId}`);

export const slotAccessibleName = ({ slot, player }) => {
    if (!slot.playerId) {
        return `${slot.label}, empty`;
    }
    const nameParts = [slot.label, slotOccupantLabel({ slot, player })];
    if (player) {
        nameParts.push(player.position);
        // The injury badge is a colour and two letters, neither of which a
        // screen reader conveys — same reason `playerAccessibleName` spells
        // its colour-only states out. No return date here: this panel has no
        // values to read one from.
        const injury = injuryAccessibleText(player, null);
        if (injury) {
            nameParts.push(injury);
        }
    }
    return nameParts.join(', ');
};
