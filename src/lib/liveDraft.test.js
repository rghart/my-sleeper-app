import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLivePicks, applyTradedPicks, syncLiveDraft, applyManualPick } from './liveDraft.js';
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

beforeEach(() => {
    ({ liveDraft, livePicks, livePicksPartial, tradedPicks } = structuredClone(fixtureInputs));
});

describe('syncLiveDraft', () => {
    it('matches the golden fixture for the real (linear) draft', () => {
        const result = syncLiveDraft({ liveDraft, livePicks, tradedPicks });
        expect(result).toEqual(golden.linear.liveDraft);
    });

    it('matches the golden fixture byte-for-byte (catches key-order regressions)', () => {
        const result = syncLiveDraft({ liveDraft, livePicks, tradedPicks });
        expect(JSON.stringify(result)).toEqual(JSON.stringify(golden.linear.liveDraft));
    });

    it('matches the golden fixture for two consecutive sync passes (what the 3s poll does)', () => {
        const first = syncLiveDraft({ liveDraft, livePicks, tradedPicks });
        const second = syncLiveDraft({ liveDraft: first, livePicks, tradedPicks });
        expect(second).toEqual(golden.linearTwice.liveDraft);
    });

    it('matches the golden fixture for a partial (in-progress) draft synced from a clean board', () => {
        const result = syncLiveDraft({ liveDraft, livePicks: livePicksPartial, tradedPicks });
        expect(result).toEqual(golden.partialFromClean.liveDraft);
    });

    it('matches the golden fixture for a full draft synced from a clean board', () => {
        const result = syncLiveDraft({ liveDraft, livePicks, tradedPicks });
        expect(result).toEqual(golden.linearFromClean.liveDraft);
    });

    it('does not mutate its inputs', () => {
        const clonedLiveDraft = structuredClone(liveDraft);
        const clonedLivePicks = structuredClone(livePicks);
        const clonedTradedPicks = structuredClone(tradedPicks);

        syncLiveDraft({ liveDraft, livePicks, tradedPicks });

        expect(liveDraft).toEqual(clonedLiveDraft);
        expect(livePicks).toEqual(clonedLivePicks);
        expect(tradedPicks).toEqual(clonedTradedPicks);
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
        });

        const pick = result.built_draft[0].picks[0];
        expect(pick.owner_id).toBe(99);
        expect(pick.is_traded).toBe(true);
    });
});

describe('applyLivePicks', () => {
    it('sets player_id and picked on the matching pick', () => {
        const builtDraft = applyLivePicks({ builtDraft: liveDraft.built_draft, livePicks });
        const pick = builtDraft[0].picks.find((p) => p.board_spot === 1);
        expect(pick.player_id).toEqual('13287');
        expect(pick.picked).toBe(true);
    });

    // Same treatment applyTradedPicks has always given an unplaceable record.
    // The draft-source sheet points sync at any draft id, so a six-round mock
    // read onto a four-round league board is a thing a user can do in two taps
    // - and the panel syncs once by itself now, so it would happen without one.
    it('skips (with a warning) a live pick whose round does not exist', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const badLivePicks = [...livePicks, { round: 999, draft_slot: 1, player_id: '1' }];
        const builtDraft = applyLivePicks({ builtDraft: liveDraft.built_draft, livePicks: badLivePicks });
        expect(builtDraft).toEqual(applyLivePicks({ builtDraft: liveDraft.built_draft, livePicks }));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('draft has no such round'));
        warnSpy.mockRestore();
    });

    it('skips (with a warning) a live pick whose slot is not on the board', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const badLivePicks = [...livePicks, { round: 1, draft_slot: 999, player_id: '1' }];
        const builtDraft = applyLivePicks({ builtDraft: liveDraft.built_draft, livePicks: badLivePicks });
        expect(builtDraft).toEqual(applyLivePicks({ builtDraft: liveDraft.built_draft, livePicks }));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has no slot 999'));
        warnSpy.mockRestore();
    });

    it('does not mutate its inputs', () => {
        const clonedBuiltDraft = structuredClone(liveDraft.built_draft);
        const clonedLivePicks = structuredClone(livePicks);

        applyLivePicks({ builtDraft: liveDraft.built_draft, livePicks });

        expect(liveDraft.built_draft).toEqual(clonedBuiltDraft);
        expect(livePicks).toEqual(clonedLivePicks);
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

describe('applyManualPick', () => {
    it('matches the golden fixture for assigning an undrafted pick', () => {
        const round = liveDraft.built_draft[0];
        const currentManualPick = round.picks[2];
        const result = applyManualPick({ round, currentManualPick, playerID: '4984' });
        expect(result).toEqual(golden.manualAssign.round);
    });

    it('matches the golden fixture for removing an already-picked pick', () => {
        const syncedLiveDraft = syncLiveDraft({ liveDraft, livePicks, tradedPicks });
        const round = syncedLiveDraft.built_draft[0];
        const currentManualPick = round.picks[2];
        const result = applyManualPick({ round, currentManualPick, playerID: null });
        expect(result).toEqual(golden.manualRemove.round);
    });

    it('does not mutate its inputs', () => {
        const round = liveDraft.built_draft[0];
        const currentManualPick = round.picks[2];
        const clonedRound = structuredClone(round);
        const clonedCurrentManualPick = structuredClone(currentManualPick);

        applyManualPick({ round, currentManualPick, playerID: '4984' });

        expect(round).toEqual(clonedRound);
        expect(currentManualPick).toEqual(clonedCurrentManualPick);
    });
});
