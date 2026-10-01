import { describe, expect, it } from 'vitest';
import { futureFacts, pickLabel, ranksBy, tierAgreement } from './teamComparison.js';

// Two sources, three teams, a QB / RB / FLEX lineup.
const lineup = (qb, rb, flex) => ({
    starters: [
        { slot: 'QB', playerId: 'q', value: qb },
        { slot: 'RB', playerId: 'r', value: rb },
        { slot: 'SUPER_FLEX', playerId: 'f', value: flex },
    ],
});
const team = (rosterId, ktc, proj, extra = {}) => ({
    rosterId,
    lineups: { ktc: lineup(...ktc), proj: lineup(...proj) },
    tiers: { blend: 'contender', ktc: 'contender', proj: 'contender' },
    futureDetail: { picks: [], pickValue: 0 },
    ...extra,
});

describe('tierAgreement', () => {
    it('counts the sources that put the team where the blend does', () => {
        expect(
            tierAgreement(
                team(1, [1, 1, 1], [1, 1, 1], { tiers: { blend: 'all-in', ktc: 'all-in', proj: 'contender' } }),
            ),
        ).toEqual({ agree: 1, of: 2 });
    });
});

describe('futureFacts', () => {
    it('counts young players on the whole roster and averages starter ages, skipping unknowns', () => {
        const t = team(1, [1, 1, 1], [1, 1, 1], { futureDetail: { picks: [{}, {}], pickValue: 9000 } });
        const facts = futureFacts({
            team: t,
            roster: { players: ['q', 'r', 'f', 'kid'] },
            playerInfo: { q: { age: 30 }, r: { age: 24 }, f: {}, kid: { age: 21 } },
        });
        expect(facts).toEqual({ picks: 2, pickValue: 9000, young: 2, starterAge: 27 });
    });
});

describe('pickLabel', () => {
    it.each([
        [{ season: 2027, round: 1, tier: 'early', basis: 'projected' }, '2027 1st · early (projected)'],
        [{ season: 2028, round: 2, tier: 'mid', basis: 'mid' }, '2028 2nd · mid'],
        [{ season: 2027, round: 1, tier: 'slot-4', basis: 'slot' }, '2027 1st · 1.04'],
        [{ season: 2027, round: 3, tier: 'slot-12', basis: 'standings' }, '2027 3rd · 3.12 (from standings)'],
        [{ season: 2027, round: 4, value: 900 }, '2027 4th · mid'],
    ])('%o reads %s', (pick, label) => {
        expect(pickLabel(pick)).toBe(label);
    });
});

describe('ranksBy', () => {
    it('ranks best first and puts a missing score last', () => {
        const teams = [
            { rosterId: 1, s: 0.2 },
            { rosterId: 2, s: null },
            { rosterId: 3, s: 1.4 },
        ];
        expect([...ranksBy(teams, (t) => t.s)]).toEqual([
            [3, 1],
            [1, 2],
            [2, 3],
        ]);
    });
});
