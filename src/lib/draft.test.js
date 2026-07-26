import { describe, expect, it } from 'vitest';
import { buildDraftRounds } from './draft.js';
import fixtureInputs from './__fixtures__/real-draft-2026.json';
import golden from './__fixtures__/golden-draft-output.json';

describe('buildDraftRounds', () => {
    it('matches the golden fixture for the real (linear) draft', () => {
        const result = buildDraftRounds(fixtureInputs);
        expect(result).toEqual(golden.linear);
    });

    it('matches the golden fixture byte-for-byte (catches key-order regressions)', () => {
        const result = buildDraftRounds(fixtureInputs);
        expect(JSON.stringify(result)).toEqual(JSON.stringify(golden.linear));
    });

    it('matches the golden fixture for the forced-snake variant', () => {
        const snakeInputs = {
            ...fixtureInputs,
            currentDraft: { ...fixtureInputs.currentDraft, type: 'snake' },
        };
        const result = buildDraftRounds(snakeInputs);
        expect(result).toEqual(golden.snake);
    });

    it('reverses board_spot but renumbers pick_number ascending on even snake rounds', () => {
        const snakeInputs = {
            ...fixtureInputs,
            currentDraft: { ...fixtureInputs.currentDraft, type: 'snake' },
        };
        const result = buildDraftRounds(snakeInputs);
        const evenRounds = result.built_draft.filter((round) => round.round % 2 === 0);
        expect(evenRounds.length).toBeGreaterThan(0);
        evenRounds.forEach((round) => {
            const boardSpots = round.picks.map((pick) => pick.board_spot);
            const pickNumbers = round.picks.map((pick) => pick.pick_number);
            for (let i = 1; i < boardSpots.length; i++) {
                expect(boardSpots[i]).toBeLessThan(boardSpots[i - 1]);
            }
            expect(pickNumbers).toEqual(Array.from({ length: pickNumbers.length }, (_, i) => i + 1));
        });
    });

    it('maps player_type to the correct player pool label', () => {
        const base = fixtureInputs.currentDraft;
        const rookie = buildDraftRounds({
            ...fixtureInputs,
            currentDraft: { ...base, settings: { ...base.settings, player_type: 1 } },
        });
        const veteran = buildDraftRounds({
            ...fixtureInputs,
            currentDraft: { ...base, settings: { ...base.settings, player_type: 2 } },
        });
        const unknown = buildDraftRounds({
            ...fixtureInputs,
            currentDraft: { ...base, settings: { ...base.settings, player_type: 99 } },
        });
        expect(rookie.player_pool).toEqual('Rookie');
        expect(veteran.player_pool).toEqual(golden.playerPool.veteran);
        expect(unknown.player_pool).toEqual(golden.playerPool.allPlayers);
    });

    it('does not mutate currentDraft, rosterData, or tradedDraftPicks', () => {
        const clonedBefore = structuredClone(fixtureInputs);
        buildDraftRounds(fixtureInputs);
        expect(fixtureInputs.currentDraft).toEqual(clonedBefore.currentDraft);
        expect(fixtureInputs.rosterData).toEqual(clonedBefore.rosterData);
        expect(fixtureInputs.tradedDraftPicks).toEqual(clonedBefore.tradedDraftPicks);
    });

    it('does not mutate inputs for the snake variant either', () => {
        const snakeInputs = {
            ...fixtureInputs,
            currentDraft: { ...fixtureInputs.currentDraft, type: 'snake' },
        };
        const clonedBefore = structuredClone(snakeInputs);
        buildDraftRounds(snakeInputs);
        expect(snakeInputs).toEqual(clonedBefore);
    });

    it('applies traded picks to the correct round and roster', () => {
        const result = buildDraftRounds(fixtureInputs);

        // { round: 1, roster_id: 6, owner_id: 4, previous_owner_id: 6 }
        const round1Pick = result.built_draft[0].picks.find((pick) => pick.roster_id === 6);
        expect(round1Pick.is_traded).toBe(true);
        expect(round1Pick.owner_id).toBe(4);

        // { round: 4, roster_id: 9, owner_id: 5, previous_owner_id: 7 }
        const round4Pick = result.built_draft[3].picks.find((pick) => pick.roster_id === 9);
        expect(round4Pick.is_traded).toBe(true);
        expect(round4Pick.owner_id).toBe(5);

        // roster_id 1 is never traded in round 1
        const untradedPick = result.built_draft[0].picks.find((pick) => pick.roster_id === 1);
        expect(untradedPick.is_traded).toBe(false);
        expect(untradedPick.owner_id).toBe(1);
    });
});
