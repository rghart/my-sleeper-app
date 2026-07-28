// Shared between PickFeed's rows and DraftGrid's cells so the accessible name
// and the position colour classes can't drift between the two views of the
// same board - they used to live only inside PickRow, duplicated here would
// have been a second copy of exactly the logic the tests key off.

// Position colour classes have to be static strings for Tailwind's scanner to
// pick them up - a template literal built from `player.position` at runtime
// would never appear in the generated stylesheet.
const POSITION_BG = {
    QB: 'bg-qb',
    RB: 'bg-rb',
    WR: 'bg-wr',
    TE: 'bg-te',
};

// K and DEF have no colour in the palette - only the four skill positions
// encode data - so they fall back to a neutral chip rather than to the string
// "undefined" as a class name.
export const positionClass = (position) => POSITION_BG[position] ?? 'bg-line text-ink';

export const pickNumberLabel = (round, pick) => `${round.round}.${String(pick.pick_number).padStart(2, '0')}`;

// Builds the manager attribution text once so the visible label and the
// button's accessible name can't drift apart - both read off this same
// string.
export const managerLabel = ({ pick, rosterData, myDisplayName }) => {
    const owner = pick.owner_id ? rosterData.find((roster) => roster.roster_id === pick.owner_id) : null;
    if (!owner?.manager_display_name) {
        return 'Pick owner missing';
    }
    let label = owner.manager_display_name;
    if (pick.is_traded && pick.roster_id !== pick.owner_id) {
        const original = rosterData.find((roster) => roster.roster_id === pick.roster_id);
        label += ` via ${original?.manager_display_name}`;
    }
    // "you" marks the whole attribution, so it goes last: a traded pick of
    // yours reads "ryangh via crbiehl · you", not "ryangh · you via crbiehl".
    return owner.manager_display_name === myDisplayName ? `${label} · you` : label;
};

// Builds the accessible name shared by the feed's rows and the grid's cells:
// "Round 1, pick 3, ryangh · you, Carnell Tate, WR" for a made pick, or
// "Round 1, pick 1, HEFFinAround305" for one that hasn't happened yet. `player`
// is null both when the pick is unmade and when the drafted id is missing from
// the player database - the two are told apart by `pick.player_id`.
export const pickAccessibleName = ({ round, pick, player, manager }) => {
    const nameParts = [`Round ${round.round}`, `pick ${pick.pick_number}`, manager];
    if (pick.player_id) {
        nameParts.push(player ? player.full_name : `Unknown player ${pick.player_id}`);
        if (player) {
            nameParts.push(player.position);
        }
    }
    return nameParts.join(', ');
};
