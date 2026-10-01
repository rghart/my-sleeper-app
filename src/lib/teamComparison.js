// What sets one team apart from yours: the facts behind the team-vs-you
// screen in Power rankings.
//
// Pure. Everything here reads the teams the backend's rankings produced -
// their lineups per source, their Future detail - plus the player database
// for ages, so the screen shows the working of the same numbers the list
// and the chart are drawn from rather than a second calculation.

/**
 * 1-based rank of each team by a score, best first, keyed by roster id. A
 * missing score ranks last.
 */
export function ranksBy(teams, score) {
    const ordered = [...teams].sort((a, b) => (score(b) ?? -Infinity) - (score(a) ?? -Infinity));
    return new Map(ordered.map((team, i) => [team.rosterId, i + 1]));
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
