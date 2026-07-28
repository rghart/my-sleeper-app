import { managerLabel, pickAccessibleName, pickNumberLabel, positionClass } from './pickLabels.js';
import { pickKey } from '../lib/seenPicks.js';

const PickRow = ({ round, pick, playerInfo, rosterData, myDisplayName, onSelect, newPickKeys = new Set() }) => {
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
    const isNew = newPickKeys.has(pickKey(round, pick));
    const accessibleName = pickAccessibleName({ round, pick, player, manager, isNew });

    return (
        <li>
            <button
                type="button"
                aria-label={accessibleName}
                onClick={() => onSelect(pick)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-[5px] border px-3 py-2 text-left ${
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
                {/* Neutral, not a saturated position colour or `bg-mine` -
                    both are already spoken for (position data and "yours"
                    respectively), so "new" gets the one high-contrast chip
                    left: ink-on-ground, same geometry as the position badge
                    above. */}
                {isNew && (
                    <span className="bg-ink text-ground shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold">
                        NEW
                    </span>
                )}
            </button>
        </li>
    );
};

export default PickRow;
