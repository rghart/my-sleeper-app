import { useState } from 'react';
import PositionTag from './PositionTag';

// Finding a player by typing their name. Pulled out of PlayerInfoItem's
// editing branch, which had the only copy of it: the miss list needs exactly
// the same control, and the alternative was a second copy that would drift.
//
// This is the affordance that actually covers a wrong surname. The candidate
// list on a matched row only ever holds players the matcher already found, so
// when it found the wrong person entirely - or nobody - a free search over the
// whole pool is the way out.

// Ranking lists are about players you can start. The pool also carries
// kickers, defences, coaches and retired players, and none of them have ever
// been what someone is reaching for here.
const SEARCHABLE_POSITIONS = ['QB', 'RB', 'WR', 'TE'];

/** How many characters before searching - below this every list is noise. */
const MIN_QUERY = 3;

export const findPlayers = (playerInfo, query) => {
    const needle = query.trim().toLowerCase();
    if (needle.length < MIN_QUERY) return [];
    return Object.values(playerInfo)
        .filter(
            (candidate) =>
                candidate.full_name &&
                SEARCHABLE_POSITIONS.includes(candidate.position) &&
                candidate.full_name.toLowerCase().includes(needle),
        )
        .sort((a, b) => a.search_rank - b.search_rank);
};

const PlayerSearch = ({ playerInfo, onPick, placeholder = 'Search for a player', label }) => {
    const [query, setQuery] = useState('');
    const results = findPlayers(playerInfo, query);

    return (
        <div className="flex flex-col gap-1">
            <input
                type="text"
                value={query}
                aria-label={label ?? placeholder}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                className="border-line text-ink bg-raised-2 rounded-row w-full border px-2 py-1 text-sm"
            />
            {results.length > 0 && (
                <div className="flex max-h-[100px] flex-col gap-1 overflow-y-auto">
                    {results.map((candidate) => (
                        <button
                            type="button"
                            key={candidate.player_id}
                            onClick={() => {
                                onPick(candidate.player_id);
                                setQuery('');
                            }}
                            className="border-line text-ink hover:border-ink-muted rounded-row flex w-full items-center gap-2 border px-2 py-1 text-left text-sm"
                        >
                            <span className="min-w-0 flex-1 truncate">{candidate.full_name}</span>
                            <PositionTag position={candidate.position} />
                            {candidate.team && (
                                <span className="text-ink-muted shrink-0 text-xs">{candidate.team}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PlayerSearch;
