import { useState } from 'react';
import ListRow from './ListRow';
import PositionTag from './PositionTag';
import { playerAccessibleName } from './playerInfoLabels.js';
import { eligiblePositionsForSlot } from '../lib/roster.js';
import { isTaken, rosteredBy } from '../lib/rosterInfo.js';

const playerId = (entry) => entry.match_results[0][0];

// Eligibility expressed from the slot's side, not the player's: for each slot
// label in `slots`, ask which real positions it admits
// (eligiblePositionsForSlot), then check whether the player's own positions
// include any of them. A `TE` slot's admitted-positions list is `['TE']`
// alone, so this can never let a non-TE through it - the old direction
// (asking the player which slots it could ever fill, including every flex
// slot its position implies, then checking whether that list intersects
// `slots`) happened to agree in every case this app exercises, but expressed
// the relationship backwards.
const eligibleForAny = (player, slots) =>
    slots.some((slot) => eligiblePositionsForSlot(slot).some((pos) => player.fantasy_positions.includes(pos)));

/**
 * `entries` narrowed down to the ones with a resolvable player and (when
 * `eligibleSlots` isn't null) eligibility for at least one label in it. This
 * is exported so a caller's collapsed handle (BestAvailableHandle) can build
 * its own count off the same rule this component renders by - see
 * `countAvailable` below for the "n left" figure specifically.
 */
export function filterBestAvailable({ entries, playerInfo, eligibleSlots }) {
    return entries
        .map((entry) => ({ entry, player: playerInfo[playerId(entry)] }))
        .filter(({ player }) => Boolean(player))
        .filter(({ player }) => eligibleSlots === null || eligibleForAny(player, eligibleSlots));
}

/**
 * How many eligible entries are still unrostered - the number a collapsed
 * handle shows as "{n} left". Distinct from the sheet's own row count once
 * it's open, which also lists taken players (marked "Taken", not hidden).
 */
export function countAvailable({ entries, playerInfo, rosterInfo, eligibleSlots }) {
    return filterBestAvailable({ entries, playerInfo, eligibleSlots }).filter(
        ({ entry }) => !isTaken(rosterInfo, playerId(entry)),
    ).length;
}

const chipClasses = (active) =>
    `rounded-full px-[11px] py-[7px] font-mono text-[11px] font-semibold tracking-[.08em] ${
        active ? 'bg-mine-chip text-mine' : 'border-line text-ink-quiet border'
    }`;

// The rank-list content shared by the phone sheet and the desktop rail - the
// two render identical rows, only the chrome around them differs (Sheet vs
// AppShell's aside). `eligibleSlots` of null means the Draft use, which shows
// the whole rank list unfiltered and carries no chip row at all; an array
// (Lineup's open slot labels) filters to players eligible for at least one of
// them and adds the chip row to narrow further to a single slot.
// `initialActiveChip` seeds which chip starts pressed - null (ALL) for the
// bottom handle's "every open slot" entry point, a specific label for a
// slot-tap entry that opens already scoped to the tapped slot. It only ever
// matters at mount: LineupPanel remounts this component fresh each time the
// sheet opens (see LineupPanel.jsx), so there is no need for this to be a
// controlled prop that keeps tracking a later change from outside.
const BestAvailable = ({
    entries,
    playerInfo,
    rosterInfo,
    myDisplayName,
    eligibleSlots,
    initialActiveChip = null,
    onSelect,
}) => {
    const [activeChip, setActiveChip] = useState(initialActiveChip);

    // No rank list at all is the normal state for a signed-out user (or one
    // who hasn't pasted anything yet), not an edge case of an otherwise-full
    // list - so it gets its own plain message rather than an empty list under
    // a chip row that filters nothing.
    if (entries.length === 0) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                No rank list yet - paste one in the Ranks section to see who is still left.
            </p>
        );
    }

    const chipLabels = eligibleSlots ? [...new Set(eligibleSlots)] : [];
    const narrowedSlots = eligibleSlots && activeChip ? [activeChip] : eligibleSlots;
    const rows = filterBestAvailable({ entries, playerInfo, eligibleSlots: narrowedSlots });

    return (
        <div className="flex flex-col gap-3">
            {eligibleSlots && (
                <div className="flex flex-wrap gap-2 px-2 pt-2">
                    <button
                        type="button"
                        className={chipClasses(activeChip === null)}
                        onClick={() => setActiveChip(null)}
                    >
                        ALL
                    </button>
                    {chipLabels.map((label) => (
                        <button
                            key={label}
                            type="button"
                            className={chipClasses(activeChip === label)}
                            onClick={() => setActiveChip(label)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
            <ul className="flex flex-col gap-0.5 px-2 py-2.5">
                {rows.map(({ entry, player }) => {
                    const id = playerId(entry);
                    const taken = isTaken(rosterInfo, id);
                    const rosteredByName = rosteredBy(rosterInfo, id);
                    const isMine = taken && rosteredByName === myDisplayName;
                    // "Taken" means taken *from you* - rostered by somebody
                    // else. Your own players are the whole point of the lineup
                    // sheet: those are the ones you can actually start, so they
                    // keep their Add action rather than being greyed out with
                    // everyone else's. Same rule PlayerInfoItem has always used
                    // (`!taken || isMine`). On the draft sheet this changes
                    // nothing, because that sheet passes no onSelect at all.
                    const unavailable = taken && !isMine;
                    const accessibleName = playerAccessibleName({ player, taken, rosteredByName, isMine });

                    return (
                        <li key={id}>
                            <ListRow
                                as="div"
                                label={accessibleName}
                                ordinal={entry.ranking}
                                ordinalWidth="20px"
                                ordinalClassName="text-right text-[12px] text-ink-muted"
                                name={player.full_name}
                                nameTone={unavailable ? 'muted' : 'default'}
                                flag={isMine ? { text: 'YOU', tone: 'mine' } : undefined}
                                meta={
                                    <>
                                        <span>{player.team ? player.team : 'FA'}</span>
                                        <span> · </span>
                                        <span>{taken ? `rostered by ${rosteredByName}` : 'free agent'}</span>
                                    </>
                                }
                                trailing={
                                    <>
                                        <PositionTag position={player.position} />
                                        {unavailable ? (
                                            <span className="text-ink-quiet shrink-0 font-mono text-[11px] font-semibold">
                                                Taken
                                            </span>
                                        ) : (
                                            onSelect && (
                                                <button
                                                    type="button"
                                                    onClick={() => onSelect(player)}
                                                    className="bg-mine-chip text-mine shrink-0 rounded-full px-[11px] py-1.5 font-mono text-[11px] font-semibold"
                                                >
                                                    Add
                                                </button>
                                            )
                                        )}
                                    </>
                                }
                            />
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default BestAvailable;
