import { useState } from 'react';
import { isTaken } from '../lib/rosterInfo.js';
import PositionTag from '../Components/PositionTag';

// Mobile-only companion to the Ranks column that already sits beside the
// board at md+ (see AppShell's SECTIONS_WITH_ASIDE). Below that width there is
// nowhere to put Ranks beside the board, so this collapses the same "who's
// left that I wanted" answer into a bottom sheet instead. `md:hidden` is the
// whole story for why this never renders on wide screens - the aside already
// covers it there.
//
// The app's tab bar (AppShell's <nav>) is fixed at the viewport bottom, so
// this sheet has to clear it rather than sit underneath. Both read the same
// --tab-bar-h custom property (theme.css) so the two cannot drift apart.

const playerId = (entry) => entry.match_results[0][0];

const sheetClasses =
    'border-line bg-raised fixed inset-x-0 bottom-[var(--tab-bar-h)] z-10 flex flex-col border-t md:hidden';

const BestAvailableSheet = ({ rankingPlayersIdsList, playerInfo, rosterInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // No rank list at all is the normal state for a signed-out user (or one
    // who hasn't pasted anything yet), not an edge case of an otherwise-full
    // sheet - so it gets its own plain message rather than a collapse/expand
    // control guarding an empty list underneath it.
    if (rankingPlayersIdsList.length === 0) {
        return (
            <div aria-label="Best available" className={sheetClasses}>
                <p className="text-ink-muted m-0 flex min-h-11 items-center px-4 text-sm">
                    No rank list yet - paste one in the Ranks section to see who is still left.
                </p>
            </div>
        );
    }

    const available = rankingPlayersIdsList.filter((entry) => !isTaken(rosterInfo, playerId(entry)));

    return (
        <div aria-label="Best available" className={sheetClasses}>
            <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setIsExpanded((expanded) => !expanded)}
                className="flex min-h-11 w-full items-center justify-between px-4 py-2"
            >
                <span className="text-ink text-sm font-semibold">Best available</span>
                <span className="text-ink-muted text-sm">{available.length} left</span>
            </button>
            {isExpanded && (
                <div className="max-h-[45vh] overflow-y-auto px-4 pb-4">
                    <ul className="flex flex-col gap-1">
                        {available.map((entry) => {
                            const id = playerId(entry);
                            const player = playerInfo[id];
                            // Same tolerance RanksPanel's filterPlayers already has for a
                            // pasted id the player DB doesn't know (a retired player) -
                            // skip the row rather than render a name-shaped hole.
                            if (!player) {
                                return null;
                            }
                            return (
                                <li key={id} className="flex items-center gap-2 py-1">
                                    <span className="text-ink-muted w-8 shrink-0 text-right text-xs">
                                        {entry.ranking}
                                    </span>
                                    <span className="text-ink min-w-0 flex-1 truncate text-sm">{player.full_name}</span>
                                    <span className="text-ink-muted shrink-0 text-xs">{player.team}</span>
                                    <PositionTag position={player.position} />
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default BestAvailableSheet;
