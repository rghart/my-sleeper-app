import { describe, expect, it } from 'vitest';
import { bestLineup, ownedPicks, pickSeasonsInScope, rankTeams, ranksBy, tierFor, zScores } from './powerRankings.js';

const player = (position, extra = {}) => ({ position, fantasy_positions: [position], ...extra });

const PLAYER_INFO = {
    qb1: player('QB'),
    qb2: player('QB'),
    rb1: player('RB'),
    rb2: player('RB'),
    wr1: player('WR'),
    wr2: player('WR'),
    te1: player('TE'),
    k1: player('K'),
    hurt: player('WR', { injury_status: 'IR' }),
};

const valuesFrom = (table) => (id) => table[id];

describe('tierFor', () => {
    it.each([
        [1.2, 0.3, 'contender'],
        [1.2, -0.5, 'contender'],
        [1.2, -0.6, 'all-in'],
        [0.5, 0, 'contender'],
        [0.49, 2, 'middle'],
        [-0.49, -2, 'middle'],
        [-0.5, 0, 'rebuilding'],
        [-1.4, 1.1, 'rebuilding'],
        [-1.4, -0.01, 'stuck'],
    ])('now %s, future %s is %s', (now, future, tier) => {
        expect(tierFor(now, future)).toBe(tier);
    });

    it('makes a weak team that has bought picks Rebuilding, however thin its depth', () => {
        expect(tierFor(-1.4, -1.2, 0.8)).toBe('rebuilding');
        // Only its own picks (league average) or fewer: depth decides.
        expect(tierFor(-1.4, -1.2, 0)).toBe('stuck');
        expect(tierFor(-1.4, -1.2, -0.6)).toBe('stuck');
        expect(tierFor(-1.4, 0.2, -0.6)).toBe('rebuilding');
        // Picks say nothing about a strong or middling team's tier.
        expect(tierFor(1.2, -0.9, 2)).toBe('all-in');
        expect(tierFor(0, -2, 2)).toBe('middle');
    });

    it('has no tier without both scores', () => {
        expect(tierFor(null, 1)).toBeNull();
        expect(tierFor(1, undefined)).toBeNull();
    });
});

describe('zScores', () => {
    it('centres on zero with unit spread', () => {
        expect(zScores([1, 2, 3])).toEqual([-Math.sqrt(1.5), 0, Math.sqrt(1.5)]);
    });

    it('calls everyone average when nobody differs, rather than NaN', () => {
        expect(zScores([5, 5, 5])).toEqual([0, 0, 0]);
    });
});

describe('bestLineup', () => {
    const values = valuesFrom({ qb1: 100, qb2: 90, rb1: 95, rb2: 40, wr1: 80, wr2: 30, te1: 20, hurt: 999 });

    it('fills dedicated slots before flexes, so the flex gets the best leftover', () => {
        const { starters, total } = bestLineup({
            roster: { players: ['qb1', 'qb2', 'rb1', 'rb2', 'wr1', 'wr2', 'te1'] },
            rosterPositions: ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN', 'BN'],
            playerInfo: PLAYER_INFO,
            valueOf: values,
        });

        expect(starters.map((s) => [s.slot, s.playerId])).toEqual([
            ['QB', 'qb1'],
            ['RB', 'rb1'],
            ['WR', 'wr1'],
            ['TE', 'te1'],
            ['FLEX', 'rb2'],
            ['SUPER_FLEX', 'qb2'],
        ]);
        expect(total).toBe(100 + 95 + 80 + 20 + 40 + 90);
    });

    it('leaves out injured-reserve, taxi and unavailable players', () => {
        const { starters } = bestLineup({
            roster: { players: ['wr1', 'wr2', 'hurt', 'rb1'], reserve: ['wr1'], taxi: ['rb1'] },
            rosterPositions: ['WR', 'FLEX'],
            playerInfo: PLAYER_INFO,
            valueOf: values,
        });

        expect(starters.map((s) => s.playerId)).toEqual(['wr2', null]);
    });

    it('prices a player the source does not know at zero, and still starts him', () => {
        const { starters, total } = bestLineup({
            roster: { players: ['k1'] },
            rosterPositions: ['K'],
            playerInfo: PLAYER_INFO,
            valueOf: values,
        });

        expect(starters[0].playerId).toBe('k1');
        expect(total).toBe(0);
    });

    it('lets a wide flex take a better player of any eligible position', () => {
        // With one QB slot and a superflex, the second QB should outrank a
        // weaker RB for the superflex - the whole reason superflex exists.
        const { starters } = bestLineup({
            roster: { players: ['qb1', 'qb2', 'rb2'] },
            rosterPositions: ['SUPER_FLEX', 'QB'],
            playerInfo: PLAYER_INFO,
            valueOf: values,
        });

        expect(starters.map((s) => s.playerId)).toEqual(['qb2', 'qb1']);
    });
});

describe('ownedPicks', () => {
    it('starts every roster with its own picks and moves the traded ones', () => {
        const held = ownedPicks({
            rosterIds: [1, 2],
            seasons: [2027],
            rounds: 2,
            // Sleeper sends the season as a string; roster_id is the original team.
            tradedPicks: [{ season: '2027', round: 1, roster_id: 1, owner_id: 2, previous_owner_id: 1 }],
        });

        expect(held.get(1)).toEqual([{ season: 2027, round: 2, originalRosterId: 1 }]);
        expect(held.get(2)).toEqual(
            expect.arrayContaining([
                { season: 2027, round: 1, originalRosterId: 1 },
                { season: 2027, round: 1, originalRosterId: 2 },
                { season: 2027, round: 2, originalRosterId: 2 },
            ]),
        );
        expect(held.get(2)).toHaveLength(3);
    });

    it('ignores traded picks for seasons out of scope, like a draft already run', () => {
        const held = ownedPicks({
            rosterIds: [1, 2],
            seasons: [2027],
            rounds: 1,
            tradedPicks: [{ season: '2026', round: 1, roster_id: 1, owner_id: 2 }],
        });

        expect(held.get(1)).toHaveLength(1);
        expect(held.get(2)).toHaveLength(1);
    });
});

describe('rankTeams', () => {
    const roster = (id, players) => ({ roster_id: id, owner_id: `u${id}`, manager_display_name: `m${id}`, players });

    const rosters = [roster(1, ['qb1', 'rb1']), roster(2, ['qb2', 'rb2']), roster(3, ['wr1', 'wr2'])];
    const rosterPositions = ['QB', 'RB', 'FLEX'];
    const ktc = valuesFrom({ qb1: 9000, rb1: 8000, qb2: 3000, rb2: 2500, wr1: 5000, wr2: 4000 });
    const projections = valuesFrom({ qb1: 300, rb1: 250, qb2: 280, rb2: 240, wr1: 100, wr2: 90 });

    it('scores Now per source and blends the z-scores, not the raw totals', () => {
        const teams = rankTeams({
            rosters,
            rosterPositions,
            playerInfo: PLAYER_INFO,
            sources: { ktc: { valueOf: ktc }, proj: { valueOf: projections } },
            future: { valueOf: ktc },
        });

        // Roster 3 holds two receivers but only FLEX can start one.
        const ktcTotals = [17000, 5500, 5000];
        const projTotals = [550, 520, 100];
        const ktcZ = zScores(ktcTotals);
        const projZ = zScores(projTotals);
        teams.forEach((team, i) => {
            expect(team.now.ktc).toBeCloseTo(ktcZ[i]);
            expect(team.now.proj).toBeCloseTo(projZ[i]);
            expect(team.now.blend).toBeCloseTo((ktcZ[i] + projZ[i]) / 2);
        });
    });

    it('counts the bench and picks in the Future score, not the starters, and tiers each source', () => {
        const pickValues = { 1: 5000, 2: 1500 };
        const teams = rankTeams({
            rosters,
            rosterPositions,
            playerInfo: PLAYER_INFO,
            sources: { ktc: { valueOf: ktc } },
            future: { valueOf: ktc },
            picks: {
                seasons: [2027],
                rounds: 2,
                // Roster 3 has bought everyone's firsts.
                tradedPicks: [
                    { season: '2027', round: 1, roster_id: 1, owner_id: 3 },
                    { season: '2027', round: 1, roster_id: 2, owner_id: 3 },
                ],
                valueOf: (pick) => pickValues[pick.round],
            },
        });

        expect(teams.map((t) => t.futureDetail.pickValue)).toEqual([1500, 1500, 3 * 5000 + 1500]);
        // Rosters 1 and 2 start everyone they have; roster 3 benches wr2.
        expect(teams.map((t) => t.futureDetail.playerValue)).toEqual([0, 0, 4000]);
        expect(teams.map((t) => t.futureDetail.total)).toEqual([1500, 1500, 4000 + 16500]);
        expect(teams.map((t) => t.name)).toEqual(['m1', 'm2', 'm3']);
        teams.forEach((team) => expect(team.tiers.ktc).toBe(tierFor(team.now.ktc, team.future)));
        // Roster 1 is strong now with one pick and no bench: All-in.
        expect(teams.map((t) => t.tiers.ktc)).toEqual(['all-in', 'stuck', 'rebuilding']);
    });
});

describe('rankTeams and bought picks', () => {
    it('keeps a weak team that bought a first Rebuilding even when its Future is below average', () => {
        const info = { qa: player('QB'), qb: player('QB'), qc: player('QB'), big: player('RB') };
        const values = valuesFrom({ qa: 9000, qb: 1000, qc: 1000, big: 20000 });
        const teams = rankTeams({
            rosters: [
                { roster_id: 1, manager_display_name: 'strong', players: ['qa'] },
                { roster_id: 2, manager_display_name: 'buyer', players: ['qb'] },
                // A huge bench drags everyone else's Future below average.
                { roster_id: 3, manager_display_name: 'deep', players: ['qc', 'big'] },
            ],
            rosterPositions: ['QB'],
            playerInfo: info,
            sources: { ktc: { valueOf: values } },
            future: { valueOf: values },
            picks: {
                seasons: [2027],
                rounds: 1,
                tradedPicks: [{ season: '2027', round: 1, roster_id: 1, owner_id: 2 }],
                valueOf: () => 3000,
            },
        });

        const buyer = teams[1];
        expect(buyer.future).toBeLessThan(0);
        expect(buyer.picks).toBeGreaterThan(0);
        expect(buyer.tiers.ktc).toBe('rebuilding');
    });
});

describe('pickSeasonsInScope', () => {
    it('drops this season once its draft has run, and seasons nobody prices', () => {
        expect(
            pickSeasonsInScope({ pricedSeasons: [2027, 2026, 2028], leagueSeason: '2026', currentDraftComplete: true }),
        ).toEqual([2027, 2028]);
    });

    it('keeps this season while its draft is still to come', () => {
        expect(
            pickSeasonsInScope({ pricedSeasons: [2026, 2027], leagueSeason: '2026', currentDraftComplete: false }),
        ).toEqual([2026, 2027]);
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
