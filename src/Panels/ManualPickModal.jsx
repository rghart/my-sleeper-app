import { useState } from 'react';
import Button from '../Components/Button';
import ListRow from '../Components/ListRow';
import PositionTag from '../Components/PositionTag';
import Sheet from '../Components/Sheet';
import { isTaken } from '../lib/rosterInfo.js';

const ManualPickModal = ({
    round,
    currentManualPick,
    playerInfo,
    rosterInfo,
    rankingPlayersIdsList,
    onSelect,
    onClose,
    triggerRef,
}) => {
    const [searchValue, setSearchValue] = useState('');

    const selectPlayer = (playerID) => {
        onSelect(playerID);
        setSearchValue('');
    };

    // Candidate rows now go through ListRow/PositionTag, same as every other
    // player row in the app, rather than the one-off button markup this used
    // to hand-roll.
    const candidateRow = (player, keySuffix = '') => (
        <li key={`${player.player_id}${keySuffix}`}>
            <ListRow
                label={`${player.full_name}${player.team ? `, ${player.team}` : ''}`}
                onClick={() => selectPlayer(player.player_id)}
                name={player.full_name}
                meta={player.team}
                trailing={<PositionTag position={player.position} />}
            />
        </li>
    );

    return (
        // role="dialog" plus an accessible name, not previously present at
        // all - PickFeed.test.jsx and DraftPanel.test.jsx used to find this
        // element with `closest('div').parentElement`, a structural selector
        // that only worked because of how many wrapper divs happened to
        // exist. Sheet is what gives this a real `role="dialog"` and name -
        // see its own comment for why the focus/Escape/scrim handling lives
        // there rather than being reimplemented here a second time.
        //
        // Centred at `md` and up (`centerOnDesktop`) - the one caller of
        // Sheet that ever renders there, since BestAvailable's sheet is
        // replaced by the desktop rail instead of going centred.
        <Sheet
            title={`Manually select pick ${round.round}.${currentManualPick.pick_number}`}
            onClose={onClose}
            triggerRef={triggerRef}
            centerOnDesktop
        >
            {/* Sticky, not part of Sheet's own fixed header: the header
                contract is title/subtitle/close only, and the search input
                plus remove/exit controls are this caller's own content - but
                they still shouldn't scroll out of view behind a long
                candidate list. */}
            <div className="bg-raised sticky top-0 z-10 flex flex-col gap-2 px-4 pt-3 pb-2">
                <input
                    type="text"
                    className="border-line text-ink caret-ink-muted m-0 w-full rounded-[5px] border bg-transparent px-2 py-1 text-sm"
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Start typing player name to search"
                />
                {currentManualPick.player_id && (
                    // Destructive action, so it borrows Button's `alert`
                    // variant - the same QB-fill-plus-text-ground treatment
                    // already used for every other "delete" affordance in
                    // the app, rather than the one-off hardcoded `QB` class
                    // this row used to reach for.
                    <Button text="Remove pick?" btnStyle="alert" onClick={() => selectPlayer(null)} />
                )}
                <Button text="Exit" btnStyle="primary" onClick={onClose} />
            </div>
            <ul className="flex flex-col gap-0.5 px-2 pb-3">
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
            </ul>
        </Sheet>
    );
};

export default ManualPickModal;
