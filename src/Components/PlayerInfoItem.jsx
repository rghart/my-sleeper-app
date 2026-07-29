import { useState } from 'react';
import ListRow from './ListRow';
import PositionTag from './PositionTag';
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

    // Editing branch is left exactly as it was before this redesign pass -
    // only its two position badges swap to the shared PositionTag. The
    // display (non-editing) branch below is the one this step converts onto
    // ListRow; the Ranks controls stack that surrounds both is a later step.
    if (editingPlayer) {
        return (
            <div
                role="group"
                aria-label={accessibleName}
                className={`bg-raised-2 rounded-row m-0 flex w-full items-start gap-3 border px-3 py-2 ${
                    isMine ? 'border-mine!' : lowConfidenceMatch ? 'border-warn!' : 'border-line'
                }`}
            >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-col gap-2">
                        <select
                            value={player.player_id}
                            onChange={(e) => updatePlayerInfo(e.target.value)}
                            className="border-line text-ink bg-raised-2 rounded-row w-full appearance-none border px-2 py-1 text-sm"
                        >
                            {searchData.match_results.map((result) => (
                                <option key={result[0]} value={result[0]}>{`${playerInfo[result[0]].full_name} - ${
                                    playerInfo[result[0]].team ? playerInfo[result[0]].team : 'FA'
                                } (${playerInfo[result[0]].position})`}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setEditingPlayer(false)}
                                className="border-line text-ink-muted rounded-full border px-3.5 py-2 text-[13px] font-semibold"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => updatePlayerId(searchData, true)}
                                className="border-line text-danger rounded-full border px-3.5 py-2 text-[13px] font-semibold"
                            >
                                Delete
                            </button>
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
                                    className="border-line text-ink bg-raised-2 rounded-row w-full border px-2 py-1 text-sm"
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
                                                    className="border-line text-ink hover:border-ink-muted rounded-row flex w-full items-center gap-2 border px-2 py-1 text-left text-sm"
                                                >
                                                    <span className="min-w-0 flex-1 truncate">
                                                        {candidate.full_name}
                                                    </span>
                                                    <PositionTag position={candidate.position} />
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
                    <PositionTag position={player.position} />
                    {/* Neutral, not a colour fill: saturation is reserved for
                        position data and violet for "yours", so availability -
                        the thing this row most needs to say - is carried by this
                        chip's text plus the manager-name/"free agent" line above,
                        not by tinting the row. */}
                    {taken && (
                        <span className="border-line text-ink-muted rounded-tag shrink-0 border px-1.5 py-0.5 text-xs font-semibold">
                            Taken
                        </span>
                    )}
                    {(!taken || isMine) && (
                        <button
                            type="button"
                            disabled={inLineup}
                            onClick={() => addToRoster(player)}
                            className="bg-mine-chip text-mine shrink-0 rounded-full px-[11px] py-1.5 text-[11px] font-semibold disabled:opacity-50"
                        >
                            {inLineup ? 'Added' : 'Add'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // The ADP delta replaces the old two-line "ADP: 3.1" / "Ranked N picks
    // before ADP" prose. Sign convention: negative (ranked ahead of ADP) is
    // `text-live`, positive (ranked behind ADP) is `text-warn`, zero is
    // `text-ink-dim`. Omitted entirely when there is no ADP data.
    const adpDeltaTone = rankedDiff < 0 ? 'text-live' : rankedDiff > 0 ? 'text-warn' : 'text-ink-dim';
    const adpDeltaText = rankedDiff > 0 ? `+${rankedDiff}` : `${rankedDiff}`;

    return (
        <ListRow
            as="div"
            label={accessibleName}
            ordinal={searchData.ranking}
            ordinalWidth="22px"
            ordinalClassName="text-right text-[12px] font-medium text-ink-muted"
            // A single always-visible name replaces the old full-text/abbr-text
            // pair, a width-hiding mechanism whose hidden fallback shipped a
            // real defect once (PR #116). It stays a nested button so clicking
            // the name opens the edit form, same as before.
            name={
                <button
                    type="button"
                    onClick={() => setEditingPlayer(true)}
                    className="min-w-0 truncate text-left hover:underline"
                >
                    {player.full_name}
                </button>
            }
            nameTone={taken ? 'muted' : 'default'}
            flag={isMine ? { text: 'YOU', tone: 'mine' } : undefined}
            leadingDot={lowConfidenceMatch ? 'warn' : undefined}
            meta={
                <>
                    <span>{player.team ? player.team : 'FA'}</span>
                    <span> · </span>
                    <span>{playerAvailabilityText({ taken, rosteredByName })}</span>
                </>
            }
            trailing={
                <>
                    {adpData && (
                        <span
                            data-testid="adp-delta"
                            className={`w-[34px] shrink-0 text-right font-mono text-[11px] ${adpDeltaTone}`}
                        >
                            {adpDeltaText}
                        </span>
                    )}
                    <PositionTag position={player.position} />
                    {/* Neutral, not a colour fill: saturation is reserved for
                        position data and violet for "yours", so availability -
                        the thing this row most needs to say - is carried by the
                        meta line above, not by tinting the row. */}
                    {taken && !isMine && (
                        <span className="text-ink-quiet shrink-0 text-[11px] font-semibold">Taken</span>
                    )}
                    {(!taken || isMine) && (
                        <button
                            type="button"
                            disabled={inLineup}
                            onClick={() => addToRoster(player)}
                            className="bg-mine-chip text-mine shrink-0 rounded-full px-[11px] py-1.5 text-[11px] font-semibold disabled:opacity-50"
                        >
                            {inLineup ? 'Added' : 'Add'}
                        </button>
                    )}
                </>
            }
        />
    );
};

export default PlayerInfoItem;
