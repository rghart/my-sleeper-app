import { useRef, useState } from 'react';
import SlotRow from './SlotRow';
import Sheet from '../Components/Sheet';
import BestAvailable from '../Components/BestAvailable';
import BestAvailableHandle from '../Components/BestAvailableHandle';

const LineupPanel = ({
    playerInfo,
    rosterInfo,
    rosterSlots,
    removeFromLineup,
    rankingPlayersIdsList,
    myDisplayName,
    addToRoster,
}) => {
    const emptyCount = rosterSlots.filter((slot) => !slot.playerId).length;
    const [isBestAvailableOpen, setIsBestAvailableOpen] = useState(false);
    const bestAvailableHandleRef = useRef(null);

    // The slots still worth filling, by label - the chip row and the
    // eligibility filter both key off this. Order follows rosterSlots, and
    // duplicates collapse: two open FLX slots must not produce two FLX chips.
    const openSlotLabels = [...new Set(rosterSlots.filter((slot) => !slot.playerId).map((slot) => slot.label))];

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
            <ul className="flex flex-col gap-0.5 px-2 py-1">
                {rosterSlots.map((slot, i) => (
                    <SlotRow
                        key={`${slot.label}-${i}`}
                        slot={slot}
                        index={i}
                        playerInfo={playerInfo}
                        onRemove={removeFromLineup}
                    />
                ))}
            </ul>
            {/* Phone only, filtered to the slots still open - the aside
                covers `md` and up with the desktop rail instead (see
                AppShell / App's renderAside). Unlike Draft's read-only sheet,
                there is an unambiguous target here: the first open slot the
                selected player is eligible for, exactly what
                addPlayerToRoster (src/lib/roster.js) already computes - so
                selecting a player here is a real add, and the sheet stays
                open afterward so several slots can be filled in a row. */}
            {openSlotLabels.length > 0 &&
                (rankingPlayersIdsList.length > 0 ? (
                    <>
                        <BestAvailableHandle
                            buttonRef={bestAvailableHandleRef}
                            isExpanded={isBestAvailableOpen}
                            onClick={() => setIsBestAvailableOpen((open) => !open)}
                            subtitle={`fills ${openSlotLabels.join(', ')}`}
                        />
                        {isBestAvailableOpen && (
                            <Sheet
                                title="Best available"
                                subtitle={`fills ${openSlotLabels.join(', ')}`}
                                onClose={() => setIsBestAvailableOpen(false)}
                                triggerRef={bestAvailableHandleRef}
                            >
                                <BestAvailable
                                    entries={rankingPlayersIdsList}
                                    playerInfo={playerInfo}
                                    rosterInfo={rosterInfo}
                                    myDisplayName={myDisplayName}
                                    eligibleSlots={openSlotLabels}
                                    onSelect={addToRoster}
                                />
                            </Sheet>
                        )}
                    </>
                ) : (
                    <div className="border-line bg-raised border-t md:hidden">
                        <BestAvailable
                            entries={[]}
                            playerInfo={playerInfo}
                            rosterInfo={rosterInfo}
                            eligibleSlots={openSlotLabels}
                        />
                    </div>
                ))}
        </div>
    );
};

export default LineupPanel;
