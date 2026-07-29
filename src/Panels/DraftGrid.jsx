import { useState, useMemo, useRef } from 'react';
import ManualPickModal from './ManualPickModal';
import SegmentedControl from '../Components/SegmentedControl';
import { applyManualPick } from '../lib/liveDraft.js';
import { managerLabel, pickAccessibleName, pickNumberLabel, positionFillClass } from './pickLabels.js';

const ZOOM_OPTIONS = [
    { value: 'overview', label: 'Overview' },
    { value: 'readable', label: 'Readable' },
];

// First-initial + surname, e.g. "Jordan Love" -> "J.Love". A multi-word
// surname (a suffix, "St. Brown") keeps everything after the first token as
// one piece - this only has to fit a 75px cell, not read as a full name.
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

// One cell of the board: a button carrying the same accessible name PickRow
// builds for the feed, so the same pick reads identically in either view.
const GridCell = ({ round, pick, playerInfo, rosterData, myDisplayName, zoom, onSelect }) => {
    const player = pick.player_id ? playerInfo[pick.player_id] : null;
    const owner = pick.owner_id ? rosterData.find((roster) => roster.roster_id === pick.owner_id) : null;
    const isMine = Boolean(owner?.manager_display_name) && owner.manager_display_name === myDisplayName;
    const manager = managerLabel({ pick, rosterData, myDisplayName });
    const accessibleName = pickAccessibleName({ round, pick, player, manager });
    const isMade = Boolean(pick.player_id);

    // A made pick fills with the position colour. Near-black text (`text-ground`)
    // reads on all four skill-position fills - measured 5.55:1 (QB), 7.92:1
    // (RB), 6.07:1 (WR), 6.93:1 (TE) against the design's raw hex values, all
    // clearing AA and all but QB/WR clearing AAA. K/DEF (and any pick missing
    // a position) fall back to `positionFillClass`'s neutral `bg-line`, which
    // `text-ground` measured at only 1.36:1 on - so that one case takes
    // `text-ink` instead, measured at 12.6:1.
    //
    // An unmade cell used to be a dashed, unfilled box; that reads as an
    // "empty slot" everywhere else in the app via a quiet tint instead
    // (`--raw-empty`, literally "a hint of a row, not a dashed box" in
    // theme.css), so this cell uses the same token rather than its own
    // one-off dashed treatment. Either way it stays visibly distinct from a
    // made cell's saturated fill, even at a glance in overview mode.
    const hasHueFill = ['QB', 'RB', 'WR', 'TE'].includes(player?.position);
    const stateClasses = isMade
        ? `${hasHueFill ? 'text-ground' : 'text-ink'} ${positionFillClass(player?.position)}`
        : 'bg-empty border border-line-quiet text-ink-muted';

    // Violet marks "yours" as an outline, not a fill, so the position colour
    // underneath a made pick still shows through. `!` because outline and
    // border/background utilities can otherwise be reordered by Tailwind's
    // group-based stylesheet output rather than by where they read here.
    const mineClasses = isMine ? 'outline! outline-2! outline-mine! outline-offset-[-2px]!' : '';

    return (
        <td className="p-0">
            <button
                type="button"
                aria-label={accessibleName}
                onClick={onSelect}
                className={`flex h-[var(--cell-h)] w-[var(--cell-w)] flex-col items-center justify-center overflow-hidden p-0.5 text-[10px] leading-tight ${stateClasses} ${mineClasses}`}
            >
                {/* Overview is position colour only, no text at all - that is
                    the whole point of the zoom level, so nothing renders here
                    when zoom !== 'readable'. */}
                {zoom === 'readable' && (
                    <>
                        <span className="w-full truncate text-center font-semibold">
                            {isMade ? (player ? shortPlayerName(player.full_name) : `#${pick.player_id}`) : ''}
                        </span>
                        <span className="w-full truncate text-center text-[9px] opacity-80">
                            {isMade
                                ? `${player?.team ?? '—'} · ${pickNumberLabel(round, pick)}`
                                : pickNumberLabel(round, pick)}
                        </span>
                    </>
                )}
            </button>
        </td>
    );
};

// The grid view of the draft board: teams across the top, rounds down the
// side, both frozen so a cell scrolled into the middle of the board is still
// identifiable. See the PR description for why this layout (not the
// transposed one) and why two zoom stops (not four).
const DraftGrid = ({
    builtDraft,
    playerInfo,
    rosterInfo,
    rosterData,
    rankingPlayersIdsList,
    myDisplayName,
    onPickChange,
}) => {
    const [zoom, setZoom] = useState('overview');
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

    const teamLabel = (rosterId) => {
        const roster = rosterData.find((r) => r.roster_id === rosterId);
        return roster?.manager_display_name ?? `Unassigned ${rosterId}`;
    };

    const headerCellClasses =
        'border-line-quiet bg-ground text-ink-muted sticky top-0 z-10 border p-1 font-mono text-[11px] font-semibold tracking-[.08em] uppercase truncate';
    const gutterCellClasses =
        'border-line-quiet bg-ground text-ink-muted sticky left-0 z-10 w-10 border p-1 font-mono text-[11px] font-semibold tracking-[.08em] uppercase';

    return (
        <div>
            <SegmentedControl label="Zoom level" options={ZOOM_OPTIONS} value={zoom} onChange={setZoom} />
            {/* This scroll container is the containing block every sticky cell
                below travels within. The table must NOT be told to fill it
                (no w-full, no flex-1) - it needs its own natural, wider-than-
                the-container width for the sticky round gutter and team
                header to have anywhere to travel to as the container scrolls. */}
            <div className="max-h-[70vh] overflow-auto">
                {/* table-layout: fixed only truly ignores cell content - a long
                    manager name, in particular - when the table ALSO has an
                    explicit width rather than 'auto'. Verified directly: with
                    `width: auto`, Chrome still expands columns to fit content
                    even though computed tableLayout reads 'fixed' and a
                    <colgroup> sets 23px columns; only pinning the table's own
                    width (here, gutter + one `--cell-w` per team, via calc())
                    made columns actually hold their specified width. That is
                    also what keeps overview's "never scrolls horizontally"
                    guarantee true regardless of how long a manager's display
                    name is. calc() re-reads `--cell-w` live, so the table
                    width updates by itself on a zoom switch. */}
                <table
                    data-zoom={zoom}
                    className="draft-grid table-fixed border-collapse"
                    style={{ width: `calc(2.5rem + ${teamColumns.length} * var(--cell-w))` }}
                >
                    <colgroup>
                        <col className="w-10" />
                        {teamColumns.map((team) => (
                            <col key={team.boardSpot} className="w-[var(--cell-w)]" />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col" className={`${gutterCellClasses} left-0 z-20`}>
                                Rd
                            </th>
                            {teamColumns.map((team) => (
                                <th key={team.boardSpot} scope="col" className={headerCellClasses}>
                                    {teamLabel(team.rosterId)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {builtDraft.map((round) => (
                            <tr key={round.round}>
                                {/* Visibly just the number - the column is 40px
                                    wide - but named in full, so a screen reader
                                    announcing the row says "Round 2" rather than
                                    "2". */}
                                <th scope="row" aria-label={`Round ${round.round}`} className={gutterCellClasses}>
                                    {round.round}
                                </th>
                                {teamColumns.map((team) => {
                                    const pick = findPick(round, team.boardSpot);
                                    if (!pick) {
                                        return (
                                            <td
                                                key={team.boardSpot}
                                                className="border-line-quiet h-[var(--cell-h)] w-[var(--cell-w)] border"
                                            />
                                        );
                                    }
                                    return (
                                        <GridCell
                                            key={team.boardSpot}
                                            round={round}
                                            pick={pick}
                                            playerInfo={playerInfo}
                                            rosterData={rosterData}
                                            myDisplayName={myDisplayName}
                                            zoom={zoom}
                                            onSelect={() => openPick(round, pick)}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
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

export default DraftGrid;
