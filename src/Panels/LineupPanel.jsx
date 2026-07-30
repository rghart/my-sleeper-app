import { useRef, useState } from 'react';
import SlotRow from './SlotRow';
import { slotAccessibleName, slotOccupantLabel } from './lineupLabels.js';
import Sheet from '../Components/Sheet';
import BestAvailable, { filterBestAvailable } from '../Components/BestAvailable';
import { DEFAULT_OWNERSHIP } from '../Components/OwnershipFilters';
import BestAvailableHandle from '../Components/BestAvailableHandle';
import ListRow from '../Components/ListRow';
import PositionTag from '../Components/PositionTag';
import RankListSwitcher from '../Components/RankListSwitcher';

const LineupPanel = ({
    playerInfo,
    rosterInfo,
    rosterSlots,
    removeFromLineup,
    rankingPlayersIdsList,
    myDisplayName,
    addToRoster,
    fillSlot,
    savedRankLists,
    savedRankListsLoading,
    signedIn,
    lineupSet,
}) => {
    const emptyCount = rosterSlots.filter((slot) => !slot.playerId).length;
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    // null while the sheet was opened from the bottom handle (every open slot
    // selected); { index, label } while it was opened by tapping a specific
    // slot - the two are the same view at different starting chip states, per
    // the design, so this is the one piece of state that tells them apart
    // rather than two separate sheets.
    const [scope, setScope] = useState(null);
    // null means "the live session list" (rankingPlayersIdsList); otherwise a
    // saved list's route_name, resolved against savedRankLists below.
    const [rankListId, setRankListId] = useState(null);
    // Held here rather than inside BestAvailable because the sheet is mounted
    // only while open: a scope kept in the sheet would silently reset itself
    // every time it was reopened, so switching "Other rosters" on would never
    // last longer than one visit.
    const [ownership, setOwnership] = useState(DEFAULT_OWNERSHIP);
    // Only meaningful for the handle entry point - Sheet returns focus to it
    // on close. A slot-tap entry has no single stable trigger element to
    // return to (each SlotRow button is one of many, re-rendered on every
    // roster change), so triggerRef is left undefined for that path and Sheet
    // already tolerates that (see its own optional chaining).
    const bestAvailableHandleRef = useRef(null);

    // The slots still worth filling, by label - the chip row and the
    // eligibility filter both key off this. Order follows rosterSlots, and
    // duplicates collapse: two open FLX slots must not produce two FLX chips.
    const openSlotLabels = [...new Set(rosterSlots.filter((slot) => !slot.playerId).map((slot) => slot.label))];

    const openFromHandle = () => {
        setScope(null);
        setIsSheetOpen(true);
    };

    const openSlot = (index) => {
        setScope({ index, label: rosterSlots[index].label });
        setIsSheetOpen(true);
    };

    const closeSheet = () => setIsSheetOpen(false);

    // Selecting a candidate for a slot tapped directly fills that exact slot
    // - the user already chose it - rather than the first eligible open one,
    // which is what the handle's un-scoped entry point still does.
    const handleSelect = (player) => {
        if (scope) {
            fillSlot(scope.index, player);
        } else {
            addToRoster(player);
        }
        // The sheet stays open after a fill so several slots can be filled in
        // a row - only Remove (below) closes it.
    };

    const handleRemove = () => {
        removeFromLineup(scope.index);
        closeSheet();
    };

    const entries =
        rankListId && savedRankLists?.[rankListId] ? savedRankLists[rankListId].rank_list : rankingPlayersIdsList;

    // The chip row's full set: the tapped slot's own label plus every other
    // open slot. A tapped slot can itself be filled (that's what lets
    // Remove/replace work), so its label is not necessarily already in
    // openSlotLabels - union rather than reusing that list outright.
    const sheetEligibleSlots = scope ? [...new Set([scope.label, ...openSlotLabels])] : openSlotLabels;
    // The subtitle's count is fixed at the sheet's *initial* scope (the
    // tapped slot alone, or every open slot for the handle) rather than
    // tracking BestAvailable's own internal chip clicks, which this
    // component has no view into once the chip row is live.
    const subtitleEligibleSlots = scope ? [scope.label] : openSlotLabels;
    const subtitleCount = filterBestAvailable({
        entries,
        playerInfo,
        eligibleSlots: subtitleEligibleSlots,
        ownership,
        rosterInfo,
        myDisplayName,
    }).length;

    const occupantSlot = scope ? rosterSlots[scope.index] : null;
    const occupantPlayer = occupantSlot?.playerId ? playerInfo[occupantSlot.playerId] : null;

    const title = scope ? `Fill ${scope.label}` : 'Best available';
    const subtitle = `${subtitleCount} eligible in this list`;

    return (
        <div>
            {/* The app has no week number and no bye-week source in the
                Sleeper bundle, so the subhead reads just "{n} slots" rather
                than inventing "Week 1". */}
            <h4 className="border-line bg-ground sticky top-0 z-10 flex items-center justify-between border-b px-3.5 py-2">
                <span className="flex flex-col">
                    <span className="text-ink text-xl font-bold tracking-[-0.02em]">Starters</span>
                    <span className="text-ink-quiet font-mono text-[11px]">{rosterSlots.length} slots</span>
                </span>
                {/* Omitted entirely at zero rather than reading "0 empty" -
                    a full lineup has nothing to draw attention to. Text
                    content stays lowercase ("N empty") so the existing
                    getByText('2 empty') query keeps resolving; uppercase is
                    applied only visually via CSS, the same trick RoundSection
                    uses for "Round 1". */}
                {emptyCount > 0 && (
                    <span className="bg-warn-tint text-warn rounded-tag px-2.5 py-[5px] font-mono text-[11px] font-semibold tracking-[.08em] uppercase">
                        {emptyCount} empty
                    </span>
                )}
            </h4>
            {/* Leaves the pinned handle's height clear at the end of the list,
                or its last slot row sits underneath it. */}
            <ul className="flex flex-col gap-0.5 px-2 py-1 pb-[var(--handle-h)] md:pb-1">
                {rosterSlots.map((slot, i) => (
                    <SlotRow
                        key={`${slot.label}-${i}`}
                        slot={slot}
                        index={i}
                        playerInfo={playerInfo}
                        onOpen={openSlot}
                    />
                ))}
            </ul>
            {/* Phone only - the aside covers `md` and up with the desktop
                rail instead (see AppShell / App's renderAside). This handle is
                the bottom entry point specifically; every slot row above opens
                the same sheet directly.

                It opens whether or not a list is loaded. The either/or it
                replaced showed a flat "paste one in the Ranks section" strip
                instead of the handle, so a signed-in user with saved lists had
                no way to reach them from this screen - and the switcher that
                is the way to reach them lives inside the sheet the handle
                opens. */}
            {openSlotLabels.length > 0 && (
                <BestAvailableHandle
                    buttonRef={bestAvailableHandleRef}
                    isExpanded={isSheetOpen && !scope}
                    onClick={openFromHandle}
                    subtitle={entries.length > 0 ? `fills ${openSlotLabels.join(', ')}` : 'Paste a rank list'}
                />
            )}
            {isSheetOpen && (
                <Sheet
                    title={title}
                    subtitle={subtitle}
                    onClose={closeSheet}
                    triggerRef={scope ? undefined : bestAvailableHandleRef}
                    headerAction={
                        <RankListSwitcher
                            savedRankLists={savedRankLists}
                            savedRankListsLoading={savedRankListsLoading}
                            signedIn={signedIn}
                            rankListId={rankListId}
                            onSelect={setRankListId}
                            onPasteNew={() => {
                                window.location.hash = '#/ranks';
                            }}
                            sessionCount={rankingPlayersIdsList.length}
                        />
                    }
                >
                    {/* A filled slot's occupant renders first, above the
                        candidates, carrying Remove instead of Add - the same
                        sheet opens for a filled slot as for an empty one, this
                        row is the only difference. */}
                    {occupantSlot?.playerId && (
                        <div className="border-line-mid border-b px-2 py-2.5">
                            <ListRow
                                as="div"
                                label={slotAccessibleName({ slot: occupantSlot, player: occupantPlayer })}
                                name={slotOccupantLabel({ slot: occupantSlot, player: occupantPlayer })}
                                meta={occupantPlayer?.team}
                                trailing={
                                    <>
                                        {occupantPlayer && <PositionTag position={occupantPlayer.position} />}
                                        <button
                                            type="button"
                                            onClick={handleRemove}
                                            className="bg-danger/15 text-danger shrink-0 rounded-full px-[11px] py-1.5 font-mono text-[11px] font-semibold"
                                        >
                                            Remove
                                        </button>
                                    </>
                                }
                            />
                        </div>
                    )}
                    <BestAvailable
                        entries={entries}
                        playerInfo={playerInfo}
                        rosterInfo={rosterInfo}
                        myDisplayName={myDisplayName}
                        eligibleSlots={sheetEligibleSlots}
                        initialActiveChip={scope ? scope.label : null}
                        ownership={ownership}
                        onOwnershipChange={setOwnership}
                        lineupSet={lineupSet}
                        onSelect={handleSelect}
                    />
                </Sheet>
            )}
        </div>
    );
};

export default LineupPanel;
