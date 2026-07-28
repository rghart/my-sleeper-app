import { useState } from 'react';
import Button from '../Components/Button';
import { positionClass } from './pickLabels.js';
import { isTaken } from '../lib/rosterInfo.js';

const HEADING_ID = 'manual-pick-modal-heading';

const ManualPickModal = ({
    round,
    currentManualPick,
    playerInfo,
    rosterInfo,
    rankingPlayersIdsList,
    onSelect,
    onClose,
}) => {
    const [searchValue, setSearchValue] = useState('');

    const selectPlayer = (playerID) => {
        onSelect(playerID);
        setSearchValue('');
    };

    // Candidate-row geometry copied from PlayerInfoItem's "manually update
    // player" search results, not reinvented: both are the same shape, a
    // scrollable list of players to pick one of, ending in a position chip.
    const candidateRowClasses =
        'border-line text-ink hover:border-ink-muted flex w-full items-center gap-2 rounded-[4px] border px-2 py-1 text-left text-sm';

    // `keySuffix` mirrors the old per-item key here (`player_id + i`): the
    // ranked-list branch below has no guarantee a pasted rank list doesn't
    // repeat a player_id, and player_id alone would collide if it did.
    const candidateRow = (player, keySuffix = '') => (
        <button
            type="button"
            key={`${player.player_id}${keySuffix}`}
            onClick={() => selectPlayer(player.player_id)}
            className={`${candidateRowClasses} mb-[3px]`}
        >
            <span className="min-w-0 flex-1 truncate">
                {player.full_name} {player.team ? player.team : null}
            </span>
            <span
                className={`shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold ${positionClass(player.position)}`}
            >
                {player.position}
            </span>
        </button>
    );

    return (
        // role="dialog" plus aria-labelledby, not previously present at all -
        // PickFeed.test.jsx and DraftPanel.test.jsx used to find this element
        // with `closest('div').parentElement`, a structural selector that
        // only worked because of how many wrapper divs happened to exist.
        // Giving the modal a real accessible name is what let those tests
        // move to `getByRole('dialog', ...)` instead.
        <div
            role="dialog"
            aria-labelledby={HEADING_ID}
            // The old rule positioned this as a panel pinned to the right half
            // of the screen (`left: 51.1%`), which is a desktop-only shape: at
            // 375px it rendered half off-screen and clipped. It is a bottom
            // sheet on phones now - the pattern BestAvailableSheet already
            // established, sitting clear of the tab bar via `--tab-bar-h` -
            // and a centred panel from `md` up.
            className="border-line bg-raised fixed inset-x-0 bottom-[var(--tab-bar-h)] z-[999] flex max-h-[70vh] flex-col gap-2 rounded-t-[10px] border-t p-3 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[420px] md:max-w-[calc(100vw-2rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[10px] md:border"
        >
            <div className="flex flex-col gap-2">
                <h4 id={HEADING_ID} className="text-ink text-sm font-semibold">
                    Manually select pick {`${round.round}.${currentManualPick.pick_number}`}
                </h4>
                <input
                    type="text"
                    className="border-line text-ink caret-ink-muted m-0 w-full rounded-[5px] border bg-transparent px-2 py-1 text-sm"
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Start typing player name to search"
                />
                <Button
                    text="Exit"
                    btnStyle="primary"
                    onClick={() => {
                        setSearchValue('');
                        onClose();
                    }}
                />
            </div>
            {/* The last inline style in this file was `height: 75%` on a
                percentage of a fixed-position parent - it collapsed to nothing
                once the parent stopped having a fixed height. A flex child
                that scrolls needs `min-h-0`, or it refuses to shrink below its
                content and pushes the sheet past its own max height. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {currentManualPick.player_id && (
                    // Destructive action, so it borrows Button's `alert` variant -
                    // the same QB-fill-plus-text-ground treatment already used for
                    // every other "delete" affordance in the app, rather than the
                    // one-off hardcoded `QB` class this row used to reach for.
                    <Button text="Remove pick?" btnStyle="alert" onClick={() => selectPlayer(null)} />
                )}
                {searchValue.length < 2 &&
                    rankingPlayersIdsList
                        .filter((result) => !isTaken(rosterInfo, result.match_results[0][0]))
                        .map((data, i) => candidateRow(playerInfo[data.match_results[0][0]], i))}
                {searchValue.length > 2 &&
                    Object.values(playerInfo)
                        .filter((player) =>
                            player.full_name
                                ? player.full_name.toLowerCase().includes(searchValue.toLowerCase()) &&
                                  ['QB', 'RB', 'WR', 'TE'].includes(player.position)
                                : null,
                        )
                        .sort((a, b) => a.years_exp - b.years_exp)
                        .sort((a, b) => a.search_rank - b.search_rank)
                        .map((player) => candidateRow(player))}
            </div>
        </div>
    );
};

export default ManualPickModal;
