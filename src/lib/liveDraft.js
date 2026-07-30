/**
 * Applies live pick data onto a draft board. For each entry in `livePicks`,
 * finds the matching pick by round/board_spot and fills in its `player_id`
 * and `picked` flag. Never mutates any of its inputs.
 *
 * A pick the board has no slot for is skipped with a `console.warn` rather
 * than thrown on, which is what `applyTradedPicks` below has always done. The
 * two cases are real: the draft-source sheet points sync at any draft id, so a
 * six-round mock can be read onto a four-round league board, and a board that
 * failed to build past a certain round is exactly the state where this must
 * not take the panel down with it.
 */
export function applyLivePicks({ builtDraft, livePicks }) {
    const newBuiltDraft = builtDraft.map((round) => ({ ...round, picks: [...round.picks] }));

    livePicks.forEach((livePick) => {
        const { draft_slot: draftSlot, round: pickRound, player_id: playerId } = livePick;
        const roundEntry = newBuiltDraft[pickRound - 1];
        if (!roundEntry) {
            console.warn(`Ignoring live pick in round ${pickRound}: draft has no such round`);
            return;
        }
        const pickIndex = roundEntry.picks.findIndex((pick) => pick.board_spot === draftSlot);
        if (pickIndex === -1) {
            console.warn(`Ignoring live pick in round ${pickRound}: board has no slot ${draftSlot}`);
            return;
        }
        const pick = roundEntry.picks[pickIndex];
        roundEntry.picks[pickIndex] = { ...pick, player_id: playerId, picked: true };
    });

    return newBuiltDraft;
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
 * Pure version of `DraftPanel.getLiveDraft`. Composes `applyLivePicks` and
 * `applyTradedPicks`, in the same order the original mutating sync did.
 * Returns a brand new `liveDraft`; never mutates any of its inputs.
 */
export function syncLiveDraft({ liveDraft, livePicks, tradedPicks }) {
    const builtDraftWithLivePicks = applyLivePicks({
        builtDraft: liveDraft.built_draft,
        livePicks,
    });

    const newBuiltDraft = applyTradedPicks({ builtDraft: builtDraftWithLivePicks, tradedPicks });

    return { ...liveDraft, built_draft: newBuiltDraft };
}

/**
 * Pure version of `DraftRound.updatePickSelection`. Assigns (or clears, when
 * `playerID` is falsy) the player on the pick matching
 * `currentManualPick.pick_number` within `round`. Never mutates any of its
 * inputs.
 */
export function applyManualPick({ round, currentManualPick, playerID }) {
    const pickIndex = round.picks.findIndex((pick) => pick.pick_number === currentManualPick.pick_number);
    const newPicks = [...round.picks];
    newPicks[pickIndex] = { ...newPicks[pickIndex], player_id: playerID };
    return { ...round, picks: newPicks };
}
