import { describe, expect, it } from 'vitest';
import { futureFacts, groupStrength, pickLabel, tierAgreement } from './teamComparison.js';
import { zScores } from './powerRankings.js';

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

describe('groupStrength', () => {
    const teams = [
        team(1, [9000, 1000, 500], [300, 100, 50]),
        team(2, [5000, 6000, 500], [250, 200, 60]),
        team(3, [1000, 3000, 4000], [100, 150, 200]),
    ];

    it('z-scores each group across the league, one source at a time', () => {
        const byTeam = groupStrength(teams, 'ktc');
        const qbZ = zScores([9000, 5000, 1000]);
        expect(byTeam.get(1).QB).toBeCloseTo(qbZ[0]);
        expect(byTeam.get(3).QB).toBeCloseTo(qbZ[2]);
        // Superflex reads as FLEX; no WR or TE slot means no WR or TE group.
        expect(Object.keys(byTeam.get(1))).toEqual(['QB', 'RB', 'FLEX']);
    });

    it('averages the per-source z-scores under the blend', () => {
        const blend = groupStrength(teams, 'blend').get(2).RB;
        const expected = (zScores([1000, 6000, 3000])[1] + zScores([100, 200, 150])[1]) / 2;
        expect(blend).toBeCloseTo(expected);
    });
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
