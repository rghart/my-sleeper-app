import { useState } from 'react';
import Button from './Button';
import { positionClass } from '../Panels/pickLabels.js';
import { playerAccessibleName, playerAvailabilityText } from './playerInfoLabels.js';
import { isInLineup, isTaken, rosteredBy } from '../lib/rosterInfo.js';

const PlayerInfoItem = ({
    player,
    playerInfo,
    rosterInfo,
    lineupSet,
    addToRoster,
    searchData,
    updatePlayerId,
    isNewRankList,
    adpData,
    myDisplayName,
}) => {
    const [editingPlayer, setEditingPlayer] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const taken = isTaken(rosterInfo, player.player_id);
    const rosteredByName = rosteredBy(rosterInfo, player.player_id);
    const inLineup = isInLineup(lineupSet, player.player_id);
    const isMine = taken && rosteredByName === myDisplayName;
    // A low search-confidence match used to fill the whole row with a red
    // background (`.search-alert`); the `--color-warn` border below is the
    // replacement, and it is independent of taken/mine.
    const lowConfidenceMatch = Number(searchData.match_results[0][1]) > 0;
    const accessibleName = playerAccessibleName({ player, taken, rosteredByName, isMine, lowConfidenceMatch });

    const updatePlayerInfo = (newPlayerId) => {
        const newSearchData = { ...searchData };
        let newPlayerIdResult;
        const newPlayerIdIndex = newSearchData.match_results.findIndex((result) => result[0] === newPlayerId);

        if (newPlayerIdIndex > 0) {
            newPlayerIdResult = newSearchData.match_results.splice(newPlayerIdIndex, 1)[0];
            newSearchData.match_results.unshift(newPlayerIdResult);
        } else {
            newPlayerIdResult = [newPlayerId, '0.000'];
            if (newPlayerIdIndex === 0) {
                newSearchData.match_results.shift();
            }
            newSearchData.match_results.unshift(newPlayerIdResult);
        }

        updatePlayerId(newSearchData);
        setEditingPlayer(false);
    };

    const rankedDiff = Math.round(Number(searchData.ranking) - adpData);
    const adpLabel =
        rankedDiff < 0
            ? `Ranked ${Math.round(adpData - Number(searchData.ranking))} picks before ADP`
            : rankedDiff === 0
              ? 'Rank matches ADP'
              : `Ranked ${rankedDiff} picks after ADP`;

    return (
        // Uniform row geometry copied from PickRow/SlotRow: transparent
        // background, `border-line` by default, `rounded-[5px]`.
        //
        // Border precedence: `isMine` (violet, "yours") outranks a
        // low-confidence match (warn) outranks the default line colour - a
        // player can be both mine and a weak match, and violet is reserved
        // for "yours" so it wins the one available border colour.
        // `role="group"` is what makes the aria-label real. On a bare div -
        // role `generic` - an aria-label is ignored by most screen readers, so
        // the name would exist for the tests and for nobody else. The row is a
        // composite of controls, which is what group is for.
        <div
            role="group"
            aria-label={accessibleName}
            className={`m-0 flex w-full items-start gap-3 rounded-[5px] border bg-transparent px-3 py-2 ${
                isMine ? 'border-mine!' : lowConfidenceMatch ? 'border-warn!' : 'border-line'
            }`}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                {editingPlayer ? (
                    <div className="flex flex-col gap-2">
                        <select
                            value={player.player_id}
                            onChange={(e) => updatePlayerInfo(e.target.value)}
                            className="border-line text-ink w-full appearance-none rounded-[5px] border bg-transparent px-2 py-1 text-sm"
                        >
                            {searchData.match_results.map((result) => (
                                <option key={result[0]} value={result[0]}>{`${playerInfo[result[0]].full_name} - ${
                                    playerInfo[result[0]].team ? playerInfo[result[0]].team : 'FA'
                                } (${playerInfo[result[0]].position})`}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <Button text="Close" btnStyle="primary" onClick={() => setEditingPlayer(false)} />
                            <Button text="Delete" btnStyle="alert" onClick={() => updatePlayerId(searchData, true)} />
                        </div>
                        {(isNewRankList || lowConfidenceMatch || editingPlayer) && (
                            <div className="flex flex-col gap-1">
                                <p className="text-ink-muted text-xs">
                                    <i>&quot;{searchData.search_string}&quot; </i> - Search score:{' '}
                                    {searchData.match_results[0][1]}
                                </p>
                                <input
                                    type="text"
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    placeholder="Manually update player"
                                    className="border-line text-ink w-full rounded-[5px] border bg-transparent px-2 py-1 text-sm"
                                />
                                {searchValue.length > 2 && (
                                    <div className="flex max-h-[100px] flex-col gap-1 overflow-y-scroll">
                                        {Object.values(playerInfo)
                                            .filter((candidate) =>
                                                candidate.full_name
                                                    ? candidate.full_name
                                                          .toLowerCase()
                                                          .includes(searchValue.toLowerCase()) &&
                                                      ['QB', 'RB', 'WR', 'TE'].includes(candidate.position)
                                                    : null,
                                            )
                                            .sort((a, b) => a.search_rank - b.search_rank)
                                            .map((candidate) => (
                                                <button
                                                    type="button"
                                                    key={candidate.player_id}
                                                    onClick={() => updatePlayerInfo(candidate.player_id)}
                                                    className="border-line text-ink hover:border-ink-muted flex w-full items-center gap-2 rounded-[4px] border px-2 py-1 text-left text-sm"
                                                >
                                                    <span className="min-w-0 flex-1 truncate">
                                                        {candidate.full_name}
                                                    </span>
                                                    <span
                                                        className={`text-ground shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold ${positionClass(candidate.position)}`}
                                                    >
                                                        {candidate.position}
                                                    </span>
                                                    {candidate.team && (
                                                        <span className="text-ink-muted shrink-0 text-xs">
                                                            {candidate.team}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setEditingPlayer(true)}
                        // A single always-visible name replaces the old
                        // full-text/abbr-text pair, a width-hiding mechanism
                        // whose hidden fallback shipped a real defect once
                        // (PR #116).
                        className="text-ink w-full truncate text-left text-sm font-semibold hover:underline"
                    >
                        {player.full_name}
                    </button>
                )}
                <div className="text-ink-muted flex flex-wrap items-center gap-x-2 text-xs">
                    <span>Rank: {searchData.ranking}</span>
                    <span>{player.team ? player.team : 'FA'}</span>
                    <span>{playerAvailabilityText({ taken, rosteredByName })}</span>
                </div>
                {adpData && (
                    <div className="text-ink-muted flex items-center gap-2 text-xs">
                        <span>ADP: {adpData}</span>
                        <span>{adpLabel}</span>
                    </div>
                )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                    className={`text-ground shrink-0 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold ${positionClass(player.position)}`}
                >
                    {player.position}
                </span>
                {/* Neutral, not a colour fill: saturation is reserved for
                    position data and violet for "yours", so availability -
                    the thing this row most needs to say - is carried by this
                    chip's text plus the manager-name/"free agent" line above,
                    not by tinting the row. */}
                {taken && (
                    <span className="border-line text-ink-muted shrink-0 rounded-[4px] border px-1.5 py-0.5 text-xs font-semibold">
                        Taken
                    </span>
                )}
                {(!taken || isMine) && (
                    <Button
                        text={`${inLineup ? 'Added' : 'Add'}`}
                        isDisabled={inLineup}
                        btnStyle="player-add-button"
                        onClick={() => addToRoster(player)}
                    />
                )}
            </div>
        </div>
    );
};

export default PlayerInfoItem;
