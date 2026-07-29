// Shared between PickFeed's rows and DraftGrid's cells so the accessible name
// and the position colour classes can't drift between the two views of the
// same board - they used to live only inside PickRow, duplicated here would
// have been a second copy of exactly the logic the tests key off.

// Position colour classes have to be static strings for Tailwind's scanner to
// pick them up - a template literal built from `player.position` at runtime
// would never appear in the generated stylesheet.
//
// A position tag is a tint plus a light ink, never a solid fill, so this
// returns the pair: the caller no longer supplies its own text colour.
const POSITION_TAG = {
    QB: 'bg-qb-tint text-qb-ink',
    RB: 'bg-rb-tint text-rb-ink',
    WR: 'bg-wr-tint text-wr-ink',
    TE: 'bg-te-tint text-te-ink',
};

// K and DEF have no hue in the palette - only the four skill positions encode
// data - so they fall back to a neutral tint rather than to the string
// "undefined" as a class name.
export const positionClass = (position) => POSITION_TAG[position] ?? 'bg-pos-none-tint text-ink-muted';

// The draft grid's overview zoom is colour and nothing else - 23px cells with
// no text in them - so it needs the saturated base rather than the 16% tint a
// tag wears. This is the one place a position hue appears as a fill, and the
// reason the base colours are still tokens at all.
const POSITION_FILL = {
    QB: 'bg-qb',
    RB: 'bg-rb',
    WR: 'bg-wr',
    TE: 'bg-te',
};

export const positionFillClass = (position) => POSITION_FILL[position] ?? 'bg-line';

export const pickNumberLabel = (round, pick) => `${round.round}.${String(pick.pick_number).padStart(2, '0')}`;

// Builds the manager attribution text once so the visible label and the
// button's accessible name can't drift apart - both read off this same
// string.
// `markYours` exists for the redesigned row, which shows ownership twice
// otherwise: the row wears the violet "yours" tint and a `YOU` flag beside the
// name, so a meta line reading "WR · ATL · ryangh · you" says it a third time.
// It defaults to true, so the accessible name - which has no tint and no flag
// to lean on, and which every pick test asserts on - is unchanged.
export const managerLabel = ({ pick, rosterData, myDisplayName, markYours = true }) => {
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
    return markYours && owner.manager_display_name === myDisplayName ? `${label} · you` : label;
};

// Builds the accessible name shared by the feed's rows and the grid's cells:
// "Round 1, pick 3, ryangh · you, Carnell Tate, WR" for a made pick, or
// "Round 1, pick 1, HEFFinAround305" for one that hasn't happened yet. `player`
// is null both when the pick is unmade and when the drafted id is missing from
// the player database - the two are told apart by `pick.player_id`.
//
// `isNew` defaults to false and, when true, appends a trailing "new" part -
// it is always last so DraftGrid's call sites (which never pass it) produce
// byte-identical names to before this option existed.
export const pickAccessibleName = ({ round, pick, player, manager, isNew = false }) => {
    const nameParts = [`Round ${round.round}`, `pick ${pick.pick_number}`, manager];
    if (pick.player_id) {
        nameParts.push(player ? player.full_name : `Unknown player ${pick.player_id}`);
        if (player) {
            nameParts.push(player.position);
        }
    }
    if (isNew) {
        nameParts.push('new');
    }
    return nameParts.join(', ');
};
