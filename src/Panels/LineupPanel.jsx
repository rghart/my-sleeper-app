import { useRef, useState } from 'react';
import SlotRow from './SlotRow';
import { slotAccessibleName, slotOccupantLabel } from './lineupLabels.js';
import Sheet from '../Components/Sheet';
import BestAvailable, { filterBestAvailable, playerId } from '../Components/BestAvailable';
import { DEFAULT_OWNERSHIP } from '../Components/OwnershipFilters';
import BestAvailableHandle from '../Components/BestAvailableHandle';
import ListRow from '../Components/ListRow';
import PositionTag from '../Components/PositionTag';
import RankListSwitcher from '../Components/RankListSwitcher';
import { addPlayerToRoster, autoFillLineup, nextOpenSlotIndex } from '../lib/roster.js';
import { isTaken, rosteredBy } from '../lib/rosterInfo.js';

const LineupPanel = ({
    playerInfo,
    rosterInfo,
    rosterSlots,
    removeFromLineup,
    rankingPlayersIdsList,
    myDisplayName,
    addToRoster,
    fillSlot,
    autoSetLineup,
    clearLineup,
    savedRankLists,
    savedRankListsLoading,
    signedIn,
    lineupSet,
}) => {
    const emptyCount = rosterSlots.filter((slot) => !slot.playerId).length;
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    // Which entry point opened the sheet - only Sheet's focus return cares.
    const [openedFromSlot, setOpenedFromSlot] = useState(false);
    // The slot the next Add fills, or null for ALL (the first eligible open
    // slot, which is what the handle opens to). A slot tap starts it on the
    // tapped slot; each fill then moves it on to the next open one, so a whole
    // lineup can be set from one open sheet. The slot chip is this, seen from
    // BestAvailable: pressing a chip retargets to that label's first open slot.
    const [targetIndex, setTargetIndex] = useState(null);
    const target = targetIndex !== null ? rosterSlots[targetIndex] : null;
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
        setOpenedFromSlot(false);
        setTargetIndex(null);
        setIsSheetOpen(true);
    };

    const openSlot = (index) => {
        setOpenedFromSlot(true);
        setTargetIndex(index);
        setIsSheetOpen(true);
    };

    const closeSheet = () => setIsSheetOpen(false);

    const handleChipChange = (label) => {
        if (label === null) {
            setTargetIndex(null);
        } else if (target?.label !== label) {
            const index = rosterSlots.findIndex((slot) => !slot.playerId && slot.label === label);
            setTargetIndex(index === -1 ? null : index);
        }
    };

    // A targeted slot is filled exactly - the user chose it - and the target
    // then moves on to the next open slot, chip and title with it. ALL keeps
    // filling the first eligible open slot. Either way the sheet stays open
    // until the lineup is full; only Remove (below) closes it early.
    //
    // The fill is also run here, on the slots as this render has them, only to
    // know where the target goes next - App applies the real one.
    const handleSelect = (player) => {
        const { rosterSlots: nextSlots } = addPlayerToRoster({
            player,
            rosterSlots,
            slotIndex: targetIndex ?? undefined,
        });
        if (targetIndex !== null) {
            fillSlot(targetIndex, player);
            setTargetIndex(nextOpenSlotIndex({ rosterSlots: nextSlots, fromIndex: targetIndex, candidates: addable }));
        } else {
            addToRoster(player);
        }
        if (nextSlots.every((slot) => slot.playerId)) {
            closeSheet();
        }
    };

    const handleRemove = () => {
        removeFromLineup(targetIndex);
        closeSheet();
    };

    const entries =
        rankListId && savedRankLists?.[rankListId] ? savedRankLists[rankListId].rank_list : rankingPlayersIdsList;

    // Auto-set starts only your own players - a free agent has to be added on
    // Sleeper before they can start - and fills open slots only, so switching
    // lists part way (QBs from a QB list, then the rest from a flex list)
    // keeps what the first list set. Computed up front so the button can say
    // when there is nothing for it to do.
    const myRanked = entries
        .map((entry) => playerInfo[playerId(entry)])
        .filter((player) => player && rosteredBy(rosterInfo, player.player_id) === myDisplayName);
    const canAutoSet = autoFillLineup({ rosterSlots, candidates: myRanked }).rosterSlots.some(
        (slot, i) => slot.playerId !== rosterSlots[i].playerId,
    );

    // Everyone the sheet would offer an Add for under the current FILTERS -
    // what decides which open slot a fill moves on to. Other managers' players
    // are shown under "Other rosters" but can't be added, so they don't count.
    const addable = filterBestAvailable({
        entries,
        playerInfo,
        eligibleSlots: null,
        ownership,
        rosterInfo,
        myDisplayName,
    })
        .map(({ player }) => player)
        .filter(
            (player) =>
                !isTaken(rosterInfo, player.player_id) || rosteredBy(rosterInfo, player.player_id) === myDisplayName,
        );
    const hasStarters = rosterSlots.some((slot) => slot.playerId);

    // The chip row's full set: the target slot's own label plus every other
    // open slot. A tapped slot can itself be filled (that's what lets
    // Remove/replace work), so its label is not necessarily already in
    // openSlotLabels - union rather than reusing that list outright.
    const sheetEligibleSlots = target ? [...new Set([target.label, ...openSlotLabels])] : openSlotLabels;
    const subtitleEligibleSlots = target ? [target.label] : openSlotLabels;
    const subtitleCount = filterBestAvailable({
        entries,
        playerInfo,
        eligibleSlots: subtitleEligibleSlots,
        ownership,
        rosterInfo,
        myDisplayName,
    }).length;

    const occupantPlayer = target?.playerId ? playerInfo[target.playerId] : null;

    const title = target ? `Fill ${target.label}` : 'Best available';
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
                <span className="flex items-center gap-2">
                    {emptyCount > 0 && (
                        <span className="bg-warn-tint text-warn rounded-tag px-2.5 py-[5px] font-mono text-[11px] font-semibold tracking-[.08em] uppercase">
                            {emptyCount} empty
                        </span>
                    )}
                    {hasStarters && (
                        <button
                            type="button"
                            onClick={clearLineup}
                            className="border-line text-ink-muted rounded-full border px-3 py-1.5 text-[13px] font-semibold"
                        >
                            Clear
                        </button>
                    )}
                    {emptyCount > 0 && (
                        <button
                            type="button"
                            disabled={!canAutoSet}
                            title={canAutoSet ? undefined : 'None of your players in this list fit an open slot'}
                            onClick={() => autoSetLineup(myRanked)}
                            className="bg-mine-chip text-mine rounded-full px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50"
                        >
                            Auto-set
                        </button>
                    )}
                </span>
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
                    isExpanded={isSheetOpen && !openedFromSlot}
                    onClick={openFromHandle}
                    subtitle={entries.length > 0 ? `fills ${openSlotLabels.join(', ')}` : 'Paste a rank list'}
                />
            )}
            {isSheetOpen && (
                <Sheet
                    title={title}
                    subtitle={subtitle}
                    onClose={closeSheet}
                    triggerRef={openedFromSlot ? undefined : bestAvailableHandleRef}
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
                    {target?.playerId && (
                        <div className="border-line-mid border-b px-2 py-2.5">
                            <ListRow
                                as="div"
                                label={slotAccessibleName({ slot: target, player: occupantPlayer })}
                                name={slotOccupantLabel({ slot: target, player: occupantPlayer })}
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
                        activeChip={target ? target.label : null}
                        onActiveChipChange={handleChipChange}
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
