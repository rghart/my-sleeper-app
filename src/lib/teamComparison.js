// What sets one team apart from yours: the facts behind the team-vs-you
// screen in Power rankings.
//
// Pure. Everything here reads the teams `rankTeams` already produced -
// their lineups per source, their Future detail - plus the player database
// for ages, so the screen shows the working of the same numbers the list
// and the chart are drawn from rather than a second calculation.

import { zScores } from './powerRankings.js';

// Lineup slots collapse into the groups a person compares by. Every flex
// variant is "FLEX": what matters there is how good the extra starter is,
// not which positions the slot would have allowed.
const GROUP_OF = {
    QB: 'QB',
    RB: 'RB',
    WR: 'WR',
    TE: 'TE',
    FLEX: 'FLEX',
    FLX: 'FLEX',
    SUPER_FLEX: 'FLEX',
    SFLX: 'FLEX',
    WRRB_FLEX: 'FLEX',
    REC_FLEX: 'FLEX',
};

export const POSITION_GROUPS = ['QB', 'RB', 'WR', 'TE', 'FLEX'];

/**
 * Each team's strength per position group, as a league z-score: how its
 * starters at that group compare with everyone else's. Under the blend, the
 * mean of the per-source z-scores, same as Now itself.
 *
 * Returns a Map from roster id to `{ QB, RB, ... }`. A group the league has
 * no slot for is left out rather than reported as average.
 */
export function groupStrength(teams, source) {
    const sourceIds = Object.keys(teams[0]?.lineups ?? {});
    const used = source === 'blend' ? sourceIds : sourceIds.filter((id) => id === source);

    const totals = (sourceId, group) =>
        teams.map((team) =>
            (team.lineups[sourceId]?.starters ?? [])
                .filter((starter) => GROUP_OF[starter.slot] === group)
                .reduce((sum, starter) => sum + starter.value, 0),
        );

    const groups = POSITION_GROUPS.filter((group) =>
        (teams[0]?.lineups[used[0]]?.starters ?? []).some((starter) => GROUP_OF[starter.slot] === group),
    );

    const result = new Map(teams.map((team) => [team.rosterId, {}]));
    for (const group of groups) {
        const perSource = used.map((sourceId) => zScores(totals(sourceId, group)));
        teams.forEach((team, i) => {
            result.get(team.rosterId)[group] = perSource.reduce((sum, z) => sum + z[i], 0) / perSource.length;
        });
    }
    return result;
}

/**
 * How many of the Now sources put a team in the same tier as the blend - the
 * "4 of 4 agree" on the screen. A tier every source agrees on is a
 * measurement; one they split on is a judgement call, and saying which is
 * the point.
 */
export function tierAgreement(team) {
    const sourceIds = Object.keys(team.lineups ?? {});
    const agree = sourceIds.filter((id) => team.tiers[id] === team.tiers.blend).length;
    return { agree, of: sourceIds.length };
}

// Starters are read off the dynasty-value lineup when there is one, since
// that is the lineup Future is measured against; any source's will do
// otherwise.
const startersOf = (team) => (team.lineups.ktc ?? Object.values(team.lineups)[0])?.starters ?? [];

/**
 * The Future-side facts for one team: picks held and what they are worth,
 * how many rostered players are 24 or younger, and the average age of the
 * starting lineup. Ages come from Sleeper's player database; a player with
 * none is left out of the average rather than counted as 0.
 */
export function futureFacts({ team, roster, playerInfo }) {
    const ages = startersOf(team)
        .map((starter) => playerInfo?.[starter.playerId]?.age)
        .filter((age) => typeof age === 'number');

    return {
        picks: team.futureDetail.picks.length,
        pickValue: team.futureDetail.pickValue,
        young: (roster?.players ?? []).filter((id) => {
            const age = playerInfo?.[id]?.age;
            return typeof age === 'number' && age <= 24;
        }).length,
        starterAge: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null,
    };
}

const ORDINAL_ROUND = { 1: '1st', 2: '2nd', 3: '3rd' };
const roundLabel = (round) => ORDINAL_ROUND[round] ?? `${round}th`;

/**
 * One pick as a person would say it, with how it was priced:
 * "2027 1st · early (projected)", "2027 1st · 1.04", "2028 2nd · mid".
 */
export function pickLabel(pick) {
    const name = `${pick.season} ${roundLabel(pick.round)}`;
    const tier = pick.tier ?? 'mid';
    if (tier.startsWith('slot-')) {
        const slot = String(tier.slice(5)).padStart(2, '0');
        const how = pick.basis === 'standings' ? ' (from standings)' : '';
        return `${name} · ${pick.round}.${slot}${how}`;
    }
    return `${name} · ${tier}${pick.basis === 'projected' ? ' (projected)' : ''}`;
}
