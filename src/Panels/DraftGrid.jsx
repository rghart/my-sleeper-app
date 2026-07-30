import { useMemo, useRef, useState } from 'react';
import ManualPickModal from './ManualPickModal';
import { applyManualPick } from '../lib/liveDraft.js';
import { managerLabel, pickAccessibleName, pickNumberLabel, positionFillClass } from './pickLabels.js';

// The four positions the key row explains. K and DEF carry no hue anywhere in
// the system, so they get the neutral dot positionFillClass falls back to and
// no key entry - there is nothing to decode.
const KEY_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

const COLUMN_W = 108;
// 30px of rail plus the board's own 14px left inset. The inset lives inside
// the rail rather than as padding on the board, because the rail is pinned to
// the scroll container's left edge: with the padding on the board, the rail
// jumped 14px leftwards the moment the board was scrolled sideways - sticky
// pins to the scrollport, which knows nothing about an inner element's padding.
const RAIL_W = 44;

// First-initial + surname, e.g. "Jordan Love" -> "J.Love". A multi-word
// surname (a suffix, "St. Brown") keeps everything after the first token as
// one piece - this only has to fit a 108px cell, not read as a full name.
const shortPlayerName = (fullName) => {
    const [first, ...rest] = fullName.trim().split(' ');
    return rest.length === 0 ? first : `${first[0]}.${rest.join(' ')}`;
};

// Team columns are keyed by board_spot, not by pick_number: pick_number
// reverses every other round on a snake draft, but board_spot - the original
// slot_to_roster_id slot - does not, so it is the one column identity that
// stays put across every round. Read off round 0 because that mapping is
// fixed for the whole draft (see buildDraftRounds/createPickOrder).
const buildTeamColumns = (builtDraft) =>
    [...builtDraft[0].picks]
        .sort((a, b) => a.board_spot - b.board_spot)
        .map((pick) => ({ boardSpot: pick.board_spot, rosterId: pick.roster_id }));

const findPick = (round, boardSpot) => round.picks.find((pick) => pick.board_spot === boardSpot);

const PositionDot = ({ position }) => (
    <span aria-hidden="true" className={`h-[5px] w-[5px] shrink-0 rounded-full ${positionFillClass(position)}`} />
);

// One cell of the board: a button carrying the same accessible name PickRow
// builds for the feed, so the same pick reads identically in either view.
//
// Definition comes from the cell's own fill and hairline, never from a lattice
// of table rules - which is also why this is a grid of blocks rather than the
// <table> it used to be. Each cell's accessible name already spells out round,
// pick, manager and player, so nothing is lost by dropping the <th scope>
// associations a table gave: the name never depended on them.
const GridCell = ({ round, pick, playerInfo, rosterData, myDisplayName, onSelect }) => {
    const player = pick.player_id ? playerInfo[pick.player_id] : null;
    const owner = pick.owner_id ? rosterData.find((roster) => roster.roster_id === pick.owner_id) : null;
    const isMine = Boolean(owner?.manager_display_name) && owner.manager_display_name === myDisplayName;
    const manager = managerLabel({ pick, rosterData, myDisplayName });
    const accessibleName = pickAccessibleName({ round, pick, player, manager });
    const isMade = Boolean(pick.player_id);

    return (
        <button
            type="button"
            aria-label={accessibleName}
            onClick={onSelect}
            style={{ width: `${COLUMN_W}px` }}
            className={`rounded-row flex flex-col gap-[3px] border px-[9px] py-2 text-left ${
                isMine ? 'bg-mine-row border-mine-edge' : 'bg-grid-cell border-grid-line'
            }`}
        >
            <span className="flex min-w-0 items-center gap-1.5">
                {isMade && <PositionDot position={player?.position} />}
                <span
                    className={`min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] ${
                        isMine ? 'text-ink' : 'text-ink-soft'
                    }`}
                >
                    {isMade ? (player ? shortPlayerName(player.full_name) : `#${pick.player_id}`) : ''}
                </span>
            </span>
            {/* Indented to sit under the name rather than under the dot -
                11px is the dot plus its gap. An unmade cell has no dot, so
                its pick number carries the same indent for the column to
                stay straight down the board. */}
            <span className="text-ink-dim pl-[11px] font-mono text-[10px] tabular-nums">
                {isMade ? `${player?.team ?? '—'} · ${pickNumberLabel(round, pick)}` : pickNumberLabel(round, pick)}
            </span>
        </button>
    );
};

// The grid view of the draft board: managers across the top, rounds down the
// side, both pinned so a cell scrolled into the middle of the board is still
// identifiable.
//
// One density. The old overview zoom stop - 23px colour blocks with no text -
// is deleted rather than restyled: it answered nothing the feed didn't answer
// better, and it was the only place a position hue appeared as a solid fill
// wide enough to compete with the violet that means "yours". The dot is the
// grid's tag form now, and the key row above the board is what makes it
// legible.
const DraftGrid = ({
    builtDraft,
    playerInfo,
    rosterInfo,
    rosterData,
    rankingPlayersIdsList,
    myDisplayName,
    onPickChange,
}) => {
    const [activePick, setActivePick] = useState(null);
    // See PickFeed's identical comment - Sheet returns focus to whichever
    // cell button was open when it closes.
    const triggerRef = useRef(null);

    const teamColumns = useMemo(() => buildTeamColumns(builtDraft), [builtDraft]);

    const openPick = (round, pick) => {
        triggerRef.current = document.activeElement;
        setActivePick({ round, pick });
    };
    const closeModal = () => setActivePick(null);

    const selectPlayer = (playerID) => {
        const updatedRound = applyManualPick({
            round: activePick.round,
            currentManualPick: activePick.pick,
            playerID,
        });
        onPickChange(updatedRound);
        closeModal();
    };

    const managerFor = (rosterId) => rosterData.find((roster) => roster.roster_id === rosterId);

    return (
        <div>
            {/* The only place a position hue appears outside a tag or a filter
                chip. In the grid the dot *is* the tag, so the board needs one
                row that says which hue is which. */}
            <div className="flex items-center gap-3.5 px-3.5 pb-3">
                {KEY_POSITIONS.map((position) => (
                    <span key={position} className="flex items-center gap-1.5">
                        <PositionDot position={position} />
                        <span className="text-ink-dim font-mono text-[10px] font-semibold tracking-[.1em]">
                            {position}
                        </span>
                    </span>
                ))}
                <span className="text-mine ml-auto font-mono text-[10px] font-semibold tracking-[.1em]">YOU</span>
            </div>

            {/* This scroll container is the containing block every pinned cell
                below travels within, so the board must keep its own natural
                width (`w-max`) rather than being told to fill it - otherwise
                the round rail and manager header have nowhere to travel to. */}
            <div className="max-h-[70vh] overflow-auto">
                <div
                    className="grid w-max gap-1 pr-3.5 pb-2"
                    style={{ gridTemplateColumns: `${RAIL_W}px repeat(${teamColumns.length}, ${COLUMN_W}px)` }}
                >
                    {/* The corner has to out-stack both pinned strips, since it
                        is the one cell that is in both of them. */}
                    <span className="bg-ground sticky top-0 left-0 z-30" />
                    {teamColumns.map((team) => {
                        const manager = managerFor(team.rosterId);
                        const isMine =
                            Boolean(manager?.manager_display_name) && manager.manager_display_name === myDisplayName;
                        return (
                            <span
                                key={team.boardSpot}
                                className={`bg-ground sticky top-0 z-20 truncate px-2.5 pb-1.5 font-mono text-[10px] tracking-[.1em] uppercase ${
                                    isMine ? 'text-mine font-semibold' : 'text-ink-dim font-medium'
                                }`}
                            >
                                {manager?.manager_display_name ?? `Unassigned ${team.rosterId}`}
                            </span>
                        );
                    })}

                    {builtDraft.map((round) => (
                        <Round
                            key={round.round}
                            round={round}
                            teamColumns={teamColumns}
                            playerInfo={playerInfo}
                            rosterData={rosterData}
                            myDisplayName={myDisplayName}
                            onOpenPick={openPick}
                        />
                    ))}
                </div>
            </div>
            {activePick && (
                <ManualPickModal
                    round={activePick.round}
                    currentManualPick={activePick.pick}
                    playerInfo={playerInfo}
                    rosterInfo={rosterInfo}
                    rankingPlayersIdsList={rankingPlayersIdsList}
                    onSelect={selectPlayer}
                    onClose={closeModal}
                    triggerRef={triggerRef}
                />
            )}
        </div>
    );
};

// A fragment rather than a row element: the cells are direct children of the
// CSS grid above, so wrapping each round in a box of its own would break the
// column alignment the whole board depends on.
const Round = ({ round, teamColumns, playerInfo, rosterData, myDisplayName, onOpenPick }) => (
    <>
        {/* Visibly just `R2` - the rail is 30px wide - but named in full, so a
            screen reader reaching it says "Round 2" rather than "R2". */}
        <span
            aria-label={`Round ${round.round}`}
            className="bg-ground text-ink-dim sticky left-0 z-10 flex items-center pl-3.5 font-mono text-[10px] font-semibold tracking-[.06em]"
        >
            R{round.round}
        </span>
        {teamColumns.map((team) => {
            const pick = findPick(round, team.boardSpot);
            if (!pick) {
                return <span key={team.boardSpot} />;
            }
            return (
                <GridCell
                    key={team.boardSpot}
                    round={round}
                    pick={pick}
                    playerInfo={playerInfo}
                    rosterData={rosterData}
                    myDisplayName={myDisplayName}
                    onSelect={() => onOpenPick(round, pick)}
                />
            );
        })}
    </>
);

export default DraftGrid;
