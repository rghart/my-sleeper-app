import { describe, expect, it } from 'vitest';
import { draftSlots, pricePick, projectedFinish, seasonProgress, slotInRound, tierForFinish } from './pickSlots.js';

const roster = (roster_id, { wins = 0, losses = 0, fpts = 0, owner = `u${roster_id}` } = {}) => ({
    roster_id,
    owner_id: owner,
    settings: { wins, losses, ties: 0, fpts, fpts_decimal: 0 },
});
const team = (rosterId, blend) => ({ rosterId, now: { blend } });
const LEAGUE = { settings: { playoff_week_start: 15 } };

describe('seasonProgress', () => {
    it('is games played over the weeks before the playoffs, capped at 1', () => {
        expect(seasonProgress({ rosters: [roster(1, { wins: 1, losses: 1 })], league: LEAGUE })).toBeCloseTo(2 / 14);
        expect(seasonProgress({ rosters: [roster(1, { wins: 10, losses: 6 })], league: LEAGUE })).toBe(1);
        expect(seasonProgress({ rosters: [roster(1)], league: LEAGUE })).toBe(0);
    });
});

describe('projectedFinish', () => {
    // Team 1 looks best on paper; team 3 has scored the most.
    const teams = [team(1, 1.5), team(2, 0), team(3, -1.5)];

    it('follows Now before a game is played', () => {
        const finish = projectedFinish({ teams, rosters: [roster(1), roster(2), roster(3)], league: LEAGUE });
        expect([...finish]).toEqual([
            [1, 1],
            [2, 2],
            [3, 3],
        ]);
    });

    it('follows points scored once the regular season is over', () => {
        const rosters = [
            roster(1, { wins: 7, losses: 7, fpts: 1400 }),
            roster(2, { wins: 7, losses: 7, fpts: 1500 }),
            roster(3, { wins: 7, losses: 7, fpts: 1700 }),
        ];
        const finish = projectedFinish({ teams, rosters, league: LEAGUE });
        expect(finish.get(3)).toBe(1);
        expect(finish.get(1)).toBe(3);
    });
});

describe('tierForFinish', () => {
    it.each([
        [1, 'late'],
        [4, 'late'],
        [5, 'mid'],
        [8, 'mid'],
        [9, 'early'],
        [12, 'early'],
        [null, 'mid'],
    ])('finishing %s of 12 picks %s', (finish, tier) => {
        expect(tierForFinish(finish, 12)).toBe(tier);
    });
});

describe('draftSlots and slotInRound', () => {
    it("maps Sleeper's user-keyed draft order onto rosters", () => {
        const slots = draftSlots({
            draft: { draft_order: { u1: 3, u2: 1 } },
            rosters: [roster(1), roster(2), roster(3)],
        });
        expect([...slots]).toEqual([
            [1, 3],
            [2, 1],
        ]);
        expect(draftSlots({ draft: { draft_order: null }, rosters: [roster(1)] }).size).toBe(0);
    });

    it('reverses even rounds of a snake draft only', () => {
        expect(slotInRound({ slot: 1, round: 2, teamCount: 12, snake: true })).toBe(12);
        expect(slotInRound({ slot: 1, round: 2, teamCount: 12, snake: false })).toBe(1);
        expect(slotInRound({ slot: 4, round: 3, teamCount: 12, snake: true })).toBe(4);
    });
});

describe('pricePick', () => {
    // Every tier and slot KTC might price, as a lookup a test can switch off.
    const prices = { early: 7000, mid: 5700, late: 4800, 'slot-1': 9000, 'slot-4': 7500, 'slot-12': 4200 };
    const priceOf = (tier) => prices[tier] ?? null;
    const finish = new Map([
        [1, 1],
        [2, 12],
    ]);
    const common = {
        nextSeason: 2027,
        finish,
        teamCount: 12,
        slots: new Map(),
        draft: null,
        seasonOver: false,
        priceOf,
    };

    it('prices a later season at mid, whoever it came from', () => {
        expect(pricePick({ ...common, pick: { season: 2028, round: 1, originalRosterId: 2 } })).toEqual({
            value: 5700,
            basis: 'mid',
            tier: 'mid',
        });
    });

    it("prices next season's pick by its original team's projected finish", () => {
        expect(pricePick({ ...common, pick: { season: 2027, round: 1, originalRosterId: 2 } })).toEqual({
            value: 7000,
            basis: 'projected',
            tier: 'early',
        });
        expect(pricePick({ ...common, pick: { season: 2027, round: 1, originalRosterId: 1 } }).tier).toBe('late');
    });

    it('uses the implied slot once the season is over, when KTC prices exact slots', () => {
        // Finished last of 12: picks 1st.
        expect(
            pricePick({ ...common, seasonOver: true, pick: { season: 2027, round: 1, originalRosterId: 2 } }),
        ).toEqual({ value: 9000, basis: 'standings', tier: 'slot-1' });
    });

    it('uses the real draft order over the standings once it is set', () => {
        const slots = new Map([[2, 4]]);
        expect(
            pricePick({ ...common, seasonOver: true, slots, pick: { season: 2027, round: 1, originalRosterId: 2 } }),
        ).toEqual({ value: 7500, basis: 'slot', tier: 'slot-4' });
    });

    it('falls back to early/mid/late when KTC does not price the exact slot yet', () => {
        const noSlots = (tier) => (tier.startsWith('slot-') ? null : prices[tier]);
        expect(
            pricePick({
                ...common,
                priceOf: noSlots,
                seasonOver: true,
                slots: new Map([[2, 4]]),
                pick: { season: 2027, round: 1, originalRosterId: 2 },
            }),
        ).toEqual({ value: 7000, basis: 'projected', tier: 'early' });
    });
});
