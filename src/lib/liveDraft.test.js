import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLivePicks, applyTradedPicks, sortSnakeRounds, syncLiveDraft, applyManualPick } from './liveDraft.js';
import fixtureInputs from './__fixtures__/live-draft-sync-2026.json';
import golden from './__fixtures__/golden-live-draft-sync.json';

// Every test gets its own structuredClone of the fixture, taken fresh in
// beforeEach. Sharing the raw JSON import across tests would let a mutation
// bug in one test silently poison the "before" snapshot of a later
// "does not mutate its inputs" test, masking the very regression it exists
// to catch.
let liveDraft;
let livePicks;
let livePicksPartial;
let tradedPicks;
let rosterData;
let playerInfo;
let playerInfoPreDraft;

beforeEach(() => {
    ({ liveDraft, livePicks, livePicksPartial, tradedPicks, rosterData, playerInfo, playerInfoPreDraft } =
        structuredClone(fixtureInputs));
});

describe('syncLiveDraft', () => {
    it('matches the golden fixture for the real (linear) draft', () => {
        const result = syncLiveDraft({
            liveDraft,
            livePicks,
            tradedPicks,
            playerInfo,
            rosterData,
            draftType: 'linear',
        });
        expect(result).toEqual(golden.linear);
    });

    it('matches the golden fixture byte-for-byte (catches key-order regressions)', () => {
        const result = syncLiveDraft({
            liveDraft,
            livePicks,
            tradedPicks,
            playerInfo,
            rosterData,
            draftType: 'linear',
        });
        expect(JSON.stringify(result)).toEqual(JSON.stringify(golden.linear));
    });

    it('matches the golden fixture for two consecutive sync passes (what the 3s poll does)', () => {
        const first = syncLiveDraft({ liveDraft, livePicks, tradedPicks, playerInfo, rosterData, draftType: 'linear' });
        const second = syncLiveDraft({
            liveDraft: first.liveDraft,
            livePicks,
            tradedPicks,
            playerInfo: first.playerInfo,
            rosterData,
            draftType: 'linear',
        });
        expect(second).toEqual(golden.linearTwice);
    });

    it('matches the golden fixture for the forced-snake variant', () => {
        const result = syncLiveDraft({ liveDraft, livePicks, tradedPicks, playerInfo, rosterData, draftType: 'snake' });
        expect(result).toEqual(golden.snake);
    });

    it('matches the golden fixture for two consecutive snake sync passes', () => {
        const first = syncLiveDraft({ liveDraft, livePicks, tradedPicks, playerInfo, rosterData, draftType: 'snake' });
        const second = syncLiveDraft({
            liveDraft: first.liveDraft,
            livePicks,
            tradedPicks,
            playerInfo: first.playerInfo,
            rosterData,
            draftType: 'snake',
        });
        expect(second).toEqual(golden.snakeTwice);
    });

    it('matches the golden fixture for a partial (in-progress) draft synced from a clean board', () => {
        const result = syncLiveDraft({
            liveDraft,
            livePicks: livePicksPartial,
            tradedPicks,
            playerInfo: playerInfoPreDraft,
            rosterData,
            draftType: 'linear',
        });
        expect(result).toEqual(golden.partialFromClean);
    });

    it('matches the golden fixture for a full draft synced from a clean board', () => {
        const result = syncLiveDraft({
            liveDraft,
            livePicks,
            tradedPicks,
            playerInfo: playerInfoPreDraft,
            rosterData,
            draftType: 'linear',
        });
        expect(result).toEqual(golden.linearFromClean);
    });

    it('matches the clean-board golden byte-for-byte', () => {
        // golden.linear's playerInfo is unchanged from its input (the league's draft
        // is complete, so markTakenPlayers had already written the same flags), which
        // makes the byte-comparison above blind to the flag-writing path. This one
        // starts from playerInfoPreDraft, where every flag the sync writes is new.
        const result = syncLiveDraft({
            liveDraft,
            livePicks,
            tradedPicks,
            playerInfo: playerInfoPreDraft,
            rosterData,
            draftType: 'linear',
        });
        expect(JSON.stringify(result)).toEqual(JSON.stringify(golden.linearFromClean));
    });

    it('does not mutate its inputs', () => {
        const clonedLiveDraft = structuredClone(liveDraft);
        const clonedLivePicks = structuredClone(livePicks);
        const clonedTradedPicks = structuredClone(tradedPicks);
        const clonedPlayerInfo = structuredClone(playerInfo);
        const clonedRosterData = structuredClone(rosterData);

        syncLiveDraft({ liveDraft, livePicks, tradedPicks, playerInfo, rosterData, draftType: 'linear' });

        expect(liveDraft).toEqual(clonedLiveDraft);
        expect(livePicks).toEqual(clonedLivePicks);
        expect(tradedPicks).toEqual(clonedTradedPicks);
        expect(playerInfo).toEqual(clonedPlayerInfo);
        expect(rosterData).toEqual(clonedRosterData);
    });

    it('does not mutate its inputs for the snake variant either', () => {
        const clonedLiveDraft = structuredClone(liveDraft);
        syncLiveDraft({ liveDraft, livePicks, tradedPicks, playerInfo, rosterData, draftType: 'snake' });
        expect(liveDraft).toEqual(clonedLiveDraft);
    });

    it('applies the snake reordering as part of the sync, and only for snake drafts', () => {
        // buildDraftRounds always emits picks in ascending pick_number order, so on
        // real data the snake branch changes nothing and golden.snake is byte-identical
        // to golden.linear. Without this test, deleting the sortSnakeRounds call from
        // syncLiveDraft entirely would leave the whole suite green.
        const outOfOrder = {
            ...liveDraft,
            built_draft: liveDraft.built_draft.map((round) => ({ ...round, picks: [...round.picks].reverse() })),
        };
        const pickNumbers = (result, isEven) =>
            result.liveDraft.built_draft
                .find((round) => (round.round % 2 === 0) === isEven)
                .picks.map((pick) => pick.pick_number);

        const asSnake = syncLiveDraft({
            liveDraft: outOfOrder,
            livePicks: [],
            tradedPicks: [],
            playerInfo,
            rosterData,
            draftType: 'snake',
        });
        const asLinear = syncLiveDraft({
            liveDraft: outOfOrder,
            livePicks: [],
            tradedPicks: [],
            playerInfo,
            rosterData,
            draftType: 'linear',
        });

        const ascending = (nums) => [...nums].sort((a, b) => a - b);
        // Snake: even rounds get reordered, odd rounds are left descending.
        expect(pickNumbers(asSnake, true)).toEqual(ascending(pickNumbers(asSnake, true)));
        expect(pickNumbers(asSnake, false)).not.toEqual(ascending(pickNumbers(asSnake, false)));
        // Linear: nothing is reordered at all.
        expect(pickNumbers(asLinear, true)).not.toEqual(ascending(pickNumbers(asLinear, true)));
    });

    it('applies traded picks as part of the sync, not just picks the input board already had baked in', () => {
        // The real fixture's traded picks are already reflected in its built_draft
        // (buildDraftRounds bakes them in), so a syncLiveDraft that silently skipped
        // applyTradedPicks would still match the golden fixture for every scenario
        // above. This synthetic board starts a pick out untraded so the composition
        // is actually exercised.
        const untradedLiveDraft = {
            ...liveDraft,
            built_draft: [
                {
                    round: 1,
                    picks: [
                        {
                            user_id: 'u1',
                            roster_id: 1,
                            is_traded: false,
                            owner_id: 1,
                            pick_round: 1,
                            pick_number: 1,
                            board_spot: 1,
                            player_id: null,
                        },
                    ],
                },
            ],
        };
        const customTradedPicks = [{ round: 1, roster_id: 1, owner_id: 99 }];

        const result = syncLiveDraft({
            liveDraft: untradedLiveDraft,
            livePicks: [],
            tradedPicks: customTradedPicks,
            playerInfo,
            rosterData,
            draftType: 'linear',
        });

        const pick = result.liveDraft.built_draft[0].picks[0];
        expect(pick.owner_id).toBe(99);
        expect(pick.is_traded).toBe(true);
    });
});

describe('applyLivePicks', () => {
    it('sets player_id and picked on the matching pick, and is_taken/rostered_by on the player', () => {
        const { builtDraft, playerInfo: newPlayerInfo } = applyLivePicks({
            builtDraft: liveDraft.built_draft,
            livePicks,
            playerInfo,
            rosterData,
        });
        const pick = builtDraft[0].picks.find((p) => p.board_spot === 1);
        expect(pick.player_id).toEqual('13287');
        expect(pick.picked).toBe(true);
        expect(newPlayerInfo['13287'].is_taken).toBe(true);
        expect(newPlayerInfo['13287'].rostered_by).toEqual(
            rosterData.find((roster) => roster.roster_id === pick.owner_id).manager_display_name,
        );
    });

    it('does not mutate its inputs', () => {
        const clonedBuiltDraft = structuredClone(liveDraft.built_draft);
        const clonedLivePicks = structuredClone(livePicks);
        const clonedPlayerInfo = structuredClone(playerInfo);
        const clonedRosterData = structuredClone(rosterData);

        applyLivePicks({ builtDraft: liveDraft.built_draft, livePicks, playerInfo, rosterData });

        expect(liveDraft.built_draft).toEqual(clonedBuiltDraft);
        expect(livePicks).toEqual(clonedLivePicks);
        expect(playerInfo).toEqual(clonedPlayerInfo);
        expect(rosterData).toEqual(clonedRosterData);
    });
});

describe('applyTradedPicks', () => {
    it('applies a traded pick to the correct round and roster', () => {
        const builtDraft = applyTradedPicks({ builtDraft: liveDraft.built_draft, tradedPicks });
        const round1Pick = builtDraft[0].picks.find((pick) => pick.roster_id === 6);
        expect(round1Pick.is_traded).toBe(true);
        expect(round1Pick.owner_id).toBe(4);
    });

    it('skips (with a warning) a traded pick whose round does not exist', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const badTradedPicks = [...tradedPicks, { round: 999, roster_id: 1, owner_id: 2 }];
        const builtDraft = applyTradedPicks({ builtDraft: liveDraft.built_draft, tradedPicks: badTradedPicks });
        expect(builtDraft).toEqual(applyTradedPicks({ builtDraft: liveDraft.built_draft, tradedPicks }));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('draft has no such round'));
        warnSpy.mockRestore();
    });

    it('skips (with a warning) a traded pick whose roster has no pick in the round', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const badTradedPicks = [...tradedPicks, { round: 1, roster_id: 999, owner_id: 2 }];
        const builtDraft = applyTradedPicks({ builtDraft: liveDraft.built_draft, tradedPicks: badTradedPicks });
        expect(builtDraft).toEqual(applyTradedPicks({ builtDraft: liveDraft.built_draft, tradedPicks }));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has no pick in this draft'));
        warnSpy.mockRestore();
    });

    it('does not mutate its inputs', () => {
        const clonedBuiltDraft = structuredClone(liveDraft.built_draft);
        const clonedTradedPicks = structuredClone(tradedPicks);

        applyTradedPicks({ builtDraft: liveDraft.built_draft, tradedPicks });

        expect(liveDraft.built_draft).toEqual(clonedBuiltDraft);
        expect(tradedPicks).toEqual(clonedTradedPicks);
    });
});

describe('sortSnakeRounds', () => {
    // On real data this function is a no-op: buildDraftRounds already emits every
    // round's picks in ascending pick_number order, so golden.snake is byte-identical
    // to golden.linear and the golden-fixture tests above pass whether or not the
    // reordering runs at all. These two tests feed it a deliberately out-of-order
    // board so the behaviour is actually pinned rather than vacuously satisfied.
    const shuffleRoundPicks = (builtDraft) =>
        builtDraft.map((round) => ({ ...round, picks: [...round.picks].reverse() }));

    it('reorders an even round whose picks arrive out of pick_number order', () => {
        const shuffled = shuffleRoundPicks(liveDraft.built_draft);
        const evenBefore = shuffled.find((round) => round.round % 2 === 0);
        expect(evenBefore.picks.map((pick) => pick.pick_number)).not.toEqual(
            [...evenBefore.picks.map((pick) => pick.pick_number)].sort((a, b) => a - b),
        );

        const result = sortSnakeRounds(shuffled);
        const evenAfter = result.find((round) => round.round % 2 === 0);
        const pickNumbers = evenAfter.picks.map((pick) => pick.pick_number);
        expect(pickNumbers).toEqual([...pickNumbers].sort((a, b) => a - b));
    });

    it('leaves an out-of-order odd round exactly as it found it', () => {
        const shuffled = shuffleRoundPicks(liveDraft.built_draft);
        const result = sortSnakeRounds(shuffled);
        const oddBefore = shuffled.find((round) => round.round % 2 !== 0);
        const oddAfter = result.find((round) => round.round % 2 !== 0);
        expect(oddAfter).toEqual(oddBefore);
    });

    it('sorts even rounds by ascending pick_number and leaves odd rounds untouched', () => {
        const result = sortSnakeRounds(liveDraft.built_draft);
        const evenRound = result.find((round) => round.round % 2 === 0);
        const pickNumbers = evenRound.picks.map((pick) => pick.pick_number);
        expect(pickNumbers).toEqual([...pickNumbers].sort((a, b) => a - b));

        const oddRound = result.find((round) => round.round % 2 !== 0);
        expect(oddRound).toEqual(liveDraft.built_draft.find((round) => round.round % 2 !== 0));
    });

    it('does not mutate its input', () => {
        const clonedBuiltDraft = structuredClone(liveDraft.built_draft);
        sortSnakeRounds(liveDraft.built_draft);
        expect(liveDraft.built_draft).toEqual(clonedBuiltDraft);
    });
});

describe('applyManualPick', () => {
    it('matches the golden fixture for assigning an undrafted pick', () => {
        const round = liveDraft.built_draft[0];
        const currentManualPick = round.picks[2];
        const result = applyManualPick({
            round,
            playerInfo: playerInfoPreDraft,
            rosterData,
            currentManualPick,
            playerID: '4984',
        });
        expect(result).toEqual({ round: golden.manualAssign.round, playerInfo: golden.manualAssign.playerInfo });
    });

    it('matches the golden fixture for removing an already-picked pick', () => {
        const { liveDraft: syncedLiveDraft, playerInfo: syncedPlayerInfo } = syncLiveDraft({
            liveDraft,
            livePicks,
            tradedPicks,
            playerInfo: playerInfoPreDraft,
            rosterData,
            draftType: 'linear',
        });
        const round = syncedLiveDraft.built_draft[0];
        const currentManualPick = round.picks[2];
        const result = applyManualPick({
            round,
            playerInfo: syncedPlayerInfo,
            rosterData,
            currentManualPick,
            playerID: null,
        });
        expect(result).toEqual({ round: golden.manualRemove.round, playerInfo: golden.manualRemove.playerInfo });
    });

    it('does not mutate its inputs', () => {
        const round = liveDraft.built_draft[0];
        const currentManualPick = round.picks[2];
        const clonedRound = structuredClone(round);
        const clonedPlayerInfo = structuredClone(playerInfoPreDraft);
        const clonedRosterData = structuredClone(rosterData);
        const clonedCurrentManualPick = structuredClone(currentManualPick);

        applyManualPick({
            round,
            playerInfo: playerInfoPreDraft,
            rosterData,
            currentManualPick,
            playerID: '4984',
        });

        expect(round).toEqual(clonedRound);
        expect(playerInfoPreDraft).toEqual(clonedPlayerInfo);
        expect(rosterData).toEqual(clonedRosterData);
        expect(currentManualPick).toEqual(clonedCurrentManualPick);
    });
});
