/**
 * Applies live pick data onto a draft board. For each entry in `livePicks`,
 * finds the matching pick by round/board_spot and fills in its `player_id`
 * and `picked` flag, and marks the drafted player `is_taken` with the
 * `rostered_by` manager who owns that pick. Never mutates any of its inputs.
 */
export function applyLivePicks({ builtDraft, livePicks, playerInfo, rosterData }) {
    const newBuiltDraft = builtDraft.map((round) => ({ ...round, picks: [...round.picks] }));
    let newPlayerInfo = playerInfo;

    livePicks.forEach((livePick) => {
        const { draft_slot: draftSlot, round: pickRound, player_id: playerId } = livePick;
        const roundEntry = newBuiltDraft[pickRound - 1];
        const pickIndex = roundEntry.picks.findIndex((pick) => pick.board_spot === draftSlot);
        const pick = roundEntry.picks[pickIndex];
        const newPick = { ...pick, player_id: playerId, picked: true };
        roundEntry.picks[pickIndex] = newPick;

        const roster = rosterData.find((r) => r.roster_id === newPick.owner_id);
        newPlayerInfo = {
            ...newPlayerInfo,
            [playerId]: {
                ...newPlayerInfo[playerId],
                is_taken: true,
                rostered_by: roster.manager_display_name,
            },
        };
    });

    return { builtDraft: newBuiltDraft, playerInfo: newPlayerInfo };
}

/**
 * Applies traded-pick records onto a draft board, updating `owner_id` and
 * `is_traded` on the matching picks. Follows the precedent set in
 * `buildDraftRounds`: a traded pick whose round or roster doesn't exist on
 * this board is skipped with a `console.warn` rather than throwing. Never
 * mutates its inputs.
 */
export function applyTradedPicks({ builtDraft, tradedPicks }) {
    const newBuiltDraft = builtDraft.map((round) => ({ ...round, picks: [...round.picks] }));

    tradedPicks.forEach((tradedPick) => {
        const roundEntry = newBuiltDraft[tradedPick.round - 1];
        if (!roundEntry) {
            console.warn(`Ignoring traded pick for round ${tradedPick.round}: draft has no such round`);
            return;
        }
        const pickIndex = roundEntry.picks.findIndex((pick) => pick.roster_id === tradedPick.roster_id);
        if (pickIndex === -1) {
            console.warn(
                `Ignoring traded pick in round ${tradedPick.round}: roster ${tradedPick.roster_id} has no pick in this draft`,
            );
            return;
        }
        roundEntry.picks[pickIndex] = {
            ...roundEntry.picks[pickIndex],
            owner_id: tradedPick.owner_id,
            is_traded: true,
        };
    });

    return newBuiltDraft;
}

/**
 * Renumbers each even (reversed-order) snake round so its picks are ordered
 * by ascending `pick_number`. The original mutating implementation guarded
 * this with `if (round.picks[0].board_spot === 1) round.picks.reverse()`
 * before sorting - that guard only mattered because the same array was being
 * reversed in place on every poll tick. Sorting by `pick_number` is
 * order-independent, so a pure implementation doesn't need the reverse at
 * all; it produces the same result whether or not the picks were already
 * reversed. Never mutates its input.
 */
export function sortSnakeRounds(builtDraft) {
    return builtDraft.map((round) => {
        if (round.round % 2 !== 0) {
            return round;
        }
        return { ...round, picks: [...round.picks].sort((a, b) => a.pick_number - b.pick_number) };
    });
}

/**
 * Pure version of `DraftPanel.getLiveDraft`. Composes `applyLivePicks`,
 * `applyTradedPicks`, and (for snake drafts) `sortSnakeRounds`, in the same
 * order the original mutating sync did. Returns a brand new
 * `{ liveDraft, playerInfo }`; never mutates any of its inputs.
 */
export function syncLiveDraft({ liveDraft, livePicks, tradedPicks, playerInfo, rosterData, draftType }) {
    const { builtDraft: builtDraftWithLivePicks, playerInfo: newPlayerInfo } = applyLivePicks({
        builtDraft: liveDraft.built_draft,
        livePicks,
        playerInfo,
        rosterData,
    });

    let newBuiltDraft = applyTradedPicks({ builtDraft: builtDraftWithLivePicks, tradedPicks });

    if (draftType === 'snake') {
        newBuiltDraft = sortSnakeRounds(newBuiltDraft);
    }

    return {
        liveDraft: { ...liveDraft, built_draft: newBuiltDraft },
        playerInfo: newPlayerInfo,
    };
}

/**
 * Pure version of `DraftRound.updatePickSelection`. Assigns (or clears, when
 * `playerID` is falsy) the player on the pick matching
 * `currentManualPick.pick_number` within `round`, and updates the affected
 * player's `is_taken`/`rostered_by` flags to match. Never mutates any of its
 * inputs.
 */
export function applyManualPick({ round, playerInfo, rosterData, currentManualPick, playerID }) {
    const pickIndex = round.picks.findIndex((pick) => pick.pick_number === currentManualPick.pick_number);
    const newPicks = [...round.picks];
    newPicks[pickIndex] = { ...newPicks[pickIndex], player_id: playerID };
    const newRound = { ...round, picks: newPicks };

    let newPlayerInfo;
    if (playerID) {
        const roster = rosterData.find((r) => r.roster_id === currentManualPick.owner_id);
        newPlayerInfo = {
            ...playerInfo,
            [playerID]: {
                ...playerInfo[playerID],
                is_taken: true,
                rostered_by: roster.manager_display_name,
            },
        };
    } else {
        newPlayerInfo = {
            ...playerInfo,
            [currentManualPick.player_id]: {
                ...playerInfo[currentManualPick.player_id],
                is_taken: false,
                rostered_by: null,
            },
        };
    }

    return { round: newRound, playerInfo: newPlayerInfo };
}
