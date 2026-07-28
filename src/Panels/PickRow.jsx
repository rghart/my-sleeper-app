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
const positionClass = (position) => POSITION_BG[position] ?? 'bg-line text-ink';

const pickNumberLabel = (round, pick) => `${round.round}.${String(pick.pick_number).padStart(2, '0')}`;

// Builds the manager attribution text once so the visible label and the
// button's accessible name can't drift apart - both read off this same
// string.
const managerLabel = ({ pick, rosterData, myDisplayName }) => {
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

const PickRow = ({ round, pick, playerInfo, rosterData, myDisplayName, onSelect }) => {
    // The player database is a snapshot and a drafted player can be absent
    // from it. Render the id itself rather than a blank cell - that is what
    // makes the gap diagnosable, and it matches warnAboutMissingRosterPlayers,
    // which logs the same situation on the roster side. Unlike the old
    // DraftRound, there is no width-hidden class in this rebuild for the
    // fallback to accidentally land inside.
    const player = pick.player_id ? playerInfo[pick.player_id] : null;
    const owner = pick.owner_id ? rosterData.find((roster) => roster.roster_id === pick.owner_id) : null;
    const isMine = Boolean(owner?.manager_display_name) && owner.manager_display_name === myDisplayName;
    const manager = managerLabel({ pick, rosterData, myDisplayName });
    const pickNumber = pickNumberLabel(round, pick);

    const nameParts = [`Round ${round.round}`, `pick ${pick.pick_number}`, manager];
    if (pick.player_id) {
        nameParts.push(player ? player.full_name : `Unknown player ${pick.player_id}`);
        if (player) {
            nameParts.push(player.position);
        }
    }
    const accessibleName = nameParts.join(', ');

    return (
        <li>
            <button
                type="button"
                aria-label={accessibleName}
                onClick={() => onSelect(pick)}
                className={`m-0 flex min-h-11 w-full appearance-none items-center gap-3 rounded-[5px] border border-solid bg-transparent px-3 py-2 text-left ${
                    isMine ? 'border-mine! bg-mine/10!' : 'border-line'
                }`}
            >
                <span className="text-ink-muted w-12 shrink-0 text-sm tabular-nums">{pickNumber}</span>
                {/* Manager above player rather than beside it. Sharing one line
                    meant a long attribution ate the name: "CHood20 via kpresley"
                    truncated "KC Concepcion" on a 375px screen. Stacked, each
                    gets the full width of the row. */}
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-ink-muted truncate text-xs">{manager}</span>
                    {pick.player_id && (
                        <span className="text-ink truncate text-sm">
                            {player ? player.full_name : `Unknown player ${pick.player_id}`}
                        </span>
                    )}
                </span>
                {player && (
                    <span
                        className={`text-ground shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold ${positionClass(player.position)}`}
                    >
                        {player.position}
                    </span>
                )}
            </button>
        </li>
    );
};

export default PickRow;
