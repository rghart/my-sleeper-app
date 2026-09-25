// Where a rookie pick will land, as well as can honestly be said.
//
// A pick's value depends on its slot, and its slot depends on where its
// ORIGINAL team finishes - a Stuck team's 1st is probably early, a
// Contender's probably late. Pure, like the rest of lib/: rankLeague hands in
// the teams it has already scored for Now, and this says what each pick is.
//
// The most precise answer available wins:
//   1. The draft order is set: the exact slot.
//   2. The regular season is over: the slot the final standings imply.
//   3. Otherwise: early / mid / late, from a projected finish.
// ...and only for the next draft. A pick two drafts out is a guess about a
// season nobody has played; those stay "mid".

import { zScores } from './powerRankings.js';

const gamesPlayed = (roster) =>
    (roster?.settings?.wins ?? 0) + (roster?.settings?.losses ?? 0) + (roster?.settings?.ties ?? 0);

const pointsFor = (roster) => (roster?.settings?.fpts ?? 0) + (roster?.settings?.fpts_decimal ?? 0) / 100;

/**
 * How far through the regular season the league is, 0 to 1. Games played
 * by the team that has played most, over the weeks before the playoffs.
 */
export function seasonProgress({ rosters, league }) {
    const regularWeeks = Math.max(1, (league?.settings?.playoff_week_start ?? 15) - 1);
    const played = Math.max(0, ...(rosters ?? []).map(gamesPlayed));
    return Math.min(1, played / regularWeeks);
}

/**
 * Each roster's projected finish, 1 = best, as a Map from roster id.
 *
 * Early on it is the Now score; as the season goes, results take over in
 * proportion to how much of it has been played - at a fifth of the way in,
 * a fifth results. Results means points scored per game rather than wins:
 * points predict the final table better than a record does, and do not
 * swing on one close week.
 */
export function projectedFinish({ teams, rosters, league }) {
    const weight = seasonProgress({ rosters, league });
    const byId = new Map((rosters ?? []).map((roster) => [roster.roster_id, roster]));

    const rate = teams.map((team) => {
        const roster = byId.get(team.rosterId);
        const games = gamesPlayed(roster);
        return games > 0 ? pointsFor(roster) / games : 0;
    });
    const rateZ = zScores(rate);

    const scored = teams.map((team, i) => ({
        rosterId: team.rosterId,
        score: (1 - weight) * (team.now.blend ?? 0) + weight * rateZ[i],
    }));
    scored.sort((a, b) => b.score - a.score);
    return new Map(scored.map((entry, i) => [entry.rosterId, i + 1]));
}

/**
 * Early / mid / late from a finish: the bottom third of the table picks
 * early, the top third late.
 */
export function tierForFinish(finish, teamCount) {
    if (finish == null || !teamCount) return 'mid';
    const third = teamCount / 3;
    if (finish > teamCount - third) return 'early';
    if (finish <= third) return 'late';
    return 'mid';
}

/**
 * The slot each roster holds in a draft whose order is set, as a Map from
 * roster id. Sleeper keys `draft_order` by USER id, so it goes through the
 * rosters' owners. Empty when the order is not set yet.
 */
export function draftSlots({ draft, rosters }) {
    const order = draft?.draft_order;
    if (!order) return new Map();
    const slots = new Map();
    for (const roster of rosters ?? []) {
        const slot = order[roster.owner_id];
        if (slot != null) slots.set(roster.roster_id, slot);
    }
    return slots;
}

/**
 * A slot within a given round. In a snake draft the even rounds run
 * backwards, so the team picking 1st in round 1 picks last in round 2.
 */
export function slotInRound({ slot, round, teamCount, snake }) {
    return snake && round % 2 === 0 ? teamCount + 1 - slot : slot;
}

/**
 * Prices one pick and says how: `{ value, basis, tier }`. `basis` is
 * `'slot'` (the draft order), `'standings'` (the season is over),
 * `'projected'` (early/mid/late from a projected finish) or `'mid'` (a pick
 * too far out to place). `tier` is what was priced - `'early'`, `'slot-4'`.
 *
 * `priceOf(tier)` looks a tier up for the pick's season and round -
 * `'early'`, `'mid'`, `'late'` or `'slot-N'` - and returns null when the
 * source does not price it, in which case this falls back a step: an exact
 * slot KTC has not listed yet is still worth its early/mid/late estimate.
 */
export function pricePick({ pick, nextSeason, finish, teamCount, slots, draft, seasonOver, priceOf }) {
    const mid = () => ({ value: priceOf('mid'), basis: 'mid', tier: 'mid' });
    if (pick.season !== nextSeason) return mid();

    const snake = draft?.type === 'snake';
    const exactSlot = slots?.get(pick.originalRosterId);
    const standingsSlot =
        seasonOver && finish.has(pick.originalRosterId) ? teamCount + 1 - finish.get(pick.originalRosterId) : null;

    for (const [slot, basis] of [
        [exactSlot, 'slot'],
        [standingsSlot, 'standings'],
    ]) {
        if (slot == null) continue;
        const tier = `slot-${slotInRound({ slot, round: pick.round, teamCount, snake })}`;
        const value = priceOf(tier);
        if (value != null) return { value, basis, tier };
    }

    const tier = tierForFinish(finish.get(pick.originalRosterId), teamCount);
    const value = priceOf(tier);
    return value != null ? { value, basis: 'projected', tier } : mid();
}
