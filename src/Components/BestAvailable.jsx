import { useState } from 'react';
import ListRow from './ListRow';
import PositionTag from './PositionTag';
import OwnershipFilters, { DEFAULT_OWNERSHIP, matchesOwnership } from './OwnershipFilters';
import { playerAccessibleName } from './playerInfoLabels.js';
import { eligiblePositionsForSlot } from '../lib/roster.js';
import { isInLineup, isTaken, rosteredBy } from '../lib/rosterInfo.js';

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
//
// `fantasy_positions` is defaulted rather than dereferenced: a player database
// entry without one is rare but real, and reading straight through it threw
// out of the render and took the whole sheet down rather than dropping the one
// player nothing can be said about.
const eligibleForAny = (player, slots) =>
    slots.some((slot) => eligiblePositionsForSlot(slot).some((pos) => (player.fantasy_positions || []).includes(pos)));

/**
 * `entries` narrowed down to the ones with a resolvable player and (when
 * `eligibleSlots` isn't null) eligibility for at least one label in it. This
 * is exported so a caller's collapsed handle (BestAvailableHandle) can build
 * its own count off the same rule this component renders by - see
 * `countAvailable` below for the "n left" figure specifically.
 *
 * `ownership` is optional and defaults to no ownership filtering at all, which
 * is what keeps `countAvailable` below (and the draft's unfiltered list)
 * reading exactly as they did before the FILTERS chip existed. Callers that
 * show the chip pass their scope so the count in a subtitle and the rows under
 * it can't disagree.
 */
export function filterBestAvailable({ entries, playerInfo, eligibleSlots, ownership, rosterInfo, myDisplayName }) {
    return entries
        .map((entry) => ({ entry, player: playerInfo[playerId(entry)] }))
        .filter(({ player }) => Boolean(player))
        .filter(({ player }) => eligibleSlots === null || eligibleForAny(player, eligibleSlots))
        .filter(
            ({ entry, player }) =>
                !ownership ||
                matchesOwnership({ ownership, player, playerId: playerId(entry), rosterInfo, myDisplayName }),
        );
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
    ownership: controlledOwnership,
    onOwnershipChange,
    lineupSet,
    onSelect,
}) => {
    const [activeChip, setActiveChip] = useState(initialActiveChip);
    const [filtersOpen, setFiltersOpen] = useState(false);
    // Uncontrolled by default so the draft sheet and the desktop rail keep
    // working untouched; LineupPanel controls it instead, because its sheet is
    // mounted only while open and a scope held down here would reset every
    // time the sheet was reopened - which is precisely what "Reset to default"
    // exists to do deliberately.
    const [localOwnership, setLocalOwnership] = useState(DEFAULT_OWNERSHIP);
    const ownership = controlledOwnership ?? localOwnership;
    const setOwnership = onOwnershipChange ?? setLocalOwnership;

    // No rank list at all is the normal state for a signed-out user (or one
    // who hasn't pasted anything yet), not an edge case of an otherwise-full
    // list - so it gets its own plain message rather than an empty list under
    // a chip row that filters nothing.
    //
    // It no longer tells the reader to go somewhere else, because it no longer
    // has to: the sheet's own header carries the rank-list switcher, so
    // choosing a saved list or starting a new one both happen from here. The
    // old copy ("paste one in the Ranks section") was written when this sheet
    // could not be opened at all without a list already loaded.
    if (entries.length === 0) {
        return (
            <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                No rank list selected - pick one from the switcher above, or paste a new one.
            </p>
        );
    }

    const chipLabels = eligibleSlots ? [...new Set(eligibleSlots)] : [];
    const narrowedSlots = eligibleSlots && activeChip ? [activeChip] : eligibleSlots;
    // The ownership scope only applies where the chip that controls it is
    // rendered - the lineup's slot-scoped list. The draft's read-only sheet
    // passes `eligibleSlots: null` and shows the whole ranked board, taken
    // players included and marked, which is what it is for.
    const rows = filterBestAvailable({
        entries,
        playerInfo,
        eligibleSlots: narrowedSlots,
        ownership: eligibleSlots ? ownership : undefined,
        rosterInfo,
        myDisplayName,
    });

    return (
        <div className="flex flex-col gap-3">
            {eligibleSlots && (
                // Only the slot chips scroll. FILTERS is pinned to the end
                // because it is how you get rows back when the list looks
                // empty - it must not be the thing that has scrolled out of
                // sight when that happens. A lineup with six distinct slot
                // labels overflows any phone width, so wrapping the whole row
                // instead just left the divider stranded mid-air.
                <div className="flex items-stretch gap-2 px-2 pt-2">
                    <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
                        <button
                            type="button"
                            className={`shrink-0 ${chipClasses(activeChip === null)}`}
                            onClick={() => setActiveChip(null)}
                        >
                            ALL
                        </button>
                        {chipLabels.map((label) => (
                            <button
                                key={label}
                                type="button"
                                className={`shrink-0 ${chipClasses(activeChip === label)}`}
                                onClick={() => setActiveChip(label)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Divided off from the slot chips because it filters a
                        different axis: those narrow *where* a player could go,
                        this narrows *whether you can have them*. */}
                    <span className="bg-line my-0.5 w-px shrink-0" />
                    <OwnershipFilters
                        ownership={ownership}
                        onChange={setOwnership}
                        isOpen={filtersOpen}
                        onToggle={() => setFiltersOpen((open) => !open)}
                    />
                </div>
            )}
            {/* Distinct from the "no rank list yet" message above: there is a
                list, it just has nothing left in it once the chips and the
                ownership scope are applied. Saying so beats an empty box under
                a row of controls the user just touched. */}
            {rows.length === 0 && (
                <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                    Nothing in this list fits - try another slot chip, or widen FILTERS.
                </p>
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
                    // Already filling one of your slots. Adding them again
                    // would silently move them out of the slot they are in -
                    // the fill path writes the id into the tapped slot without
                    // checking the rest of the lineup - so the row says so and
                    // offers nothing to tap. `lineupSet` is optional: the
                    // draft's read-only sheet has no lineup to compare against
                    // and passes none.
                    const started = Boolean(lineupSet) && isInLineup(lineupSet, id);
                    const accessibleName = playerAccessibleName({ player, taken, rosteredByName, isMine, started });

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
                                                    disabled={started}
                                                    onClick={() => onSelect(player)}
                                                    className="bg-mine-chip text-mine shrink-0 rounded-full px-[11px] py-1.5 font-mono text-[11px] font-semibold disabled:opacity-50"
                                                >
                                                    {started ? 'Started' : 'Add'}
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
