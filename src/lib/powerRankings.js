// Dynasty power rankings: where every team in a league stands now, where it
// stands for the future, and the tier those two put it in.
//
// Pure, like the other lib modules - the panel fetches, this decides. Nothing
// here knows where a value came from; a "source" is just a map from Sleeper
// player id to a number, so projections and ADP can join KTC and FantasyCalc
// later without this file changing shape.
//
// The idea is Dynasty Daddy's - contender tiers from the best legal starting
// lineup - but they publish no thresholds, so the numbers below are ours.
// Both scores are league-relative z-scores: a "strong" lineup means strong
// against these eleven other rosters, not against some absolute bar, which
// is the same lesson the trade finder learned about depth.

/**
 * The five tiers, in the order the legend lists them. `id` is stable for
 * code and tests; `label` is what the screen says.
 */
export const TIERS = [
    { id: 'contender', label: 'Contender', description: 'Strong now, future intact' },
    { id: 'all-in', label: 'All-in', description: 'Strong now, future spent to get there' },
    { id: 'middle', label: 'Middle', description: 'Close to the league average for now' },
    { id: 'rebuilding', label: 'Rebuilding', description: 'Weak now, future above average' },
    { id: 'stuck', label: 'Stuck', description: 'Weak now, and below average for the future too' },
];

/**
 * Where the tier lines sit, in standard deviations from the league average.
 * Provisional: chosen so a 12-team league puts roughly a third of its teams
 * on each side of "Middle", and meant to be revisited against real leagues.
 */
export const THRESHOLDS = {
    strongNow: 0.5,
    weakNow: -0.5,
    // A strong team is only All-in once its future is clearly below average -
    // a merely average future on a strong team is what a normal contender has.
    allInFuture: -0.5,
    // A weak team is Rebuilding when its future is at least average; below
    // that it is weak on both counts.
    rebuildingFuture: 0,
};

export function tierFor(now, future) {
    if (now == null || future == null) return null;
    if (now >= THRESHOLDS.strongNow) return future >= THRESHOLDS.allInFuture ? 'contender' : 'all-in';
    if (now <= THRESHOLDS.weakNow) return future >= THRESHOLDS.rebuildingFuture ? 'rebuilding' : 'stuck';
    return 'middle';
}

// Which real positions may fill each lineup slot. Covers Sleeper's flex
// variants as well as the two the lineup screen shortens (FLX/SFLX), because
// here an unrecognised slot would silently start nobody and understate every
// team in the league by the same slot - quietly, and for no reason.
const SLOT_ELIGIBILITY = {
    FLEX: ['RB', 'WR', 'TE'],
    FLX: ['RB', 'WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
    SFLX: ['QB', 'RB', 'WR', 'TE'],
    WRRB_FLEX: ['RB', 'WR'],
    REC_FLEX: ['WR', 'TE'],
};

const eligibleFor = (slot) => SLOT_ELIGIBILITY[slot] ?? [slot];

// Sleeper statuses that mean a player cannot start this week however good he
// is. Dynasty Daddy skips the same set.
const UNAVAILABLE = new Set(['IR', 'PUP', 'Sus']);

/**
 * The best legal starting lineup a roster can field, under one source's
 * values.
 *
 * Slots are filled most-restrictive first - dedicated positions, then the
 * narrow flexes, then superflex - each taking the most valuable eligible
 * player left. Because every flex here is a superset of the dedicated slots
 * beneath it, filling in that order is optimal: a player only ever moves to a
 * wider slot when every narrower one that wanted him is already full of
 * someone better.
 *
 * Injured-reserve and taxi players, and anyone Sleeper lists as unavailable,
 * are left out. A player the source does not price is worth 0 to it - a
 * kicker under KTC, say - which costs every team the same slot.
 */
export function bestLineup({ roster, rosterPositions, playerInfo, valueOf }) {
    const benched = new Set([...(roster?.reserve ?? []), ...(roster?.taxi ?? [])]);
    const candidates = (roster?.players ?? [])
        .filter((id) => !benched.has(id))
        .filter((id) => !UNAVAILABLE.has(playerInfo?.[id]?.injury_status))
        .map((id) => ({
            id,
            positions: playerInfo?.[id]?.fantasy_positions ?? [playerInfo?.[id]?.position].filter(Boolean),
            value: valueOf(id) ?? 0,
        }))
        .sort((a, b) => b.value - a.value);

    const slots = (rosterPositions ?? [])
        .filter((slot) => slot !== 'BN' && slot !== 'IR' && slot !== 'TAXI')
        .map((slot, index) => ({ slot, index, eligible: eligibleFor(slot) }))
        // Stable, so equally-narrow slots keep league order.
        .sort((a, b) => a.eligible.length - b.eligible.length || a.index - b.index);

    const used = new Set();
    const starters = slots.map(({ slot, index, eligible }) => {
        const pick = candidates.find(
            (player) => !used.has(player.id) && player.positions.some((pos) => eligible.includes(pos)),
        );
        if (pick) used.add(pick.id);
        return { slot, index, playerId: pick?.id ?? null, value: pick?.value ?? 0 };
    });

    starters.sort((a, b) => a.index - b.index);
    return { starters, total: starters.reduce((sum, starter) => sum + starter.value, 0) };
}

/**
 * Population z-scores. A league where every team scores the same has no
 * spread to measure, so everyone is average (0) rather than NaN.
 */
export function zScores(values) {
    if (values.length === 0) return [];
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
    return values.map((v) => (sd === 0 ? 0 : (v - mean) / sd));
}

/**
 * Which rookie picks each roster holds, by roster id.
 *
 * Every roster starts owning its own pick in every round of every season;
 * Sleeper's league-level `traded_picks` then lists only the ones that moved.
 * `roster_id` on a traded pick is the ORIGINAL team and `owner_id` the
 * current one - both roster ids, not user ids, despite the name.
 */
export function ownedPicks({ rosterIds, tradedPicks, seasons, rounds }) {
    const owner = new Map();
    for (const season of seasons) {
        for (let round = 1; round <= rounds; round++) {
            for (const rosterId of rosterIds) owner.set(`${season}:${round}:${rosterId}`, rosterId);
        }
    }
    for (const traded of tradedPicks ?? []) {
        const key = `${traded.season}:${traded.round}:${traded.roster_id}`;
        if (owner.has(key)) owner.set(key, traded.owner_id);
    }

    const byRoster = new Map(rosterIds.map((id) => [id, []]));
    for (const [key, rosterId] of owner) {
        const [season, round, original] = key.split(':').map(Number);
        byRoster.get(rosterId)?.push({ season, round, originalRosterId: original });
    }
    return byRoster;
}

/**
 * Rank every roster in a league.
 *
 * `sources` maps a source id to `{ valueOf }` - the Now scores. `future` is
 * the dynasty value source for the Future score, which counts everything a
 * roster owns OUTSIDE its best lineup under that source: bench, taxi and
 * injured-reserve players, plus owned picks priced by `picks.valueOf`.
 *
 * Starters are left out on purpose, and it was measured rather than assumed:
 * counting the whole roster made Future track Now so closely (correlation
 * 0.5-0.8 across five real leagues) that almost every weak team read as
 * Stuck and almost no strong one as All-in. Without them the two scores are
 * close to independent (-0.4 to 0.0) and all five tiers occur. The cost is
 * that a young star already in the lineup counts toward Now, not Future.
 *
 * Returns one entry per roster, in roster order. Each carries raw totals as
 * well as z-scores, so a screen can show its working.
 */
export function rankTeams({ rosters, rosterPositions, playerInfo, sources, future, picks }) {
    const sourceIds = Object.keys(sources);

    const lineups = rosters.map((roster) =>
        Object.fromEntries(
            sourceIds.map((sourceId) => [
                sourceId,
                bestLineup({ roster, rosterPositions, playerInfo, valueOf: sources[sourceId].valueOf }),
            ]),
        ),
    );

    const pickHoldings = picks
        ? ownedPicks({
              rosterIds: rosters.map((roster) => roster.roster_id),
              tradedPicks: picks.tradedPicks,
              seasons: picks.seasons,
              rounds: picks.rounds,
          })
        : new Map();

    const futureTotals = rosters.map((roster) => {
        const starters = new Set(
            bestLineup({ roster, rosterPositions, playerInfo, valueOf: future.valueOf }).starters.map(
                (starter) => starter.playerId,
            ),
        );
        const playerValue = (roster.players ?? [])
            .filter((id) => !starters.has(id))
            .reduce((sum, id) => sum + (future.valueOf(id) ?? 0), 0);
        const held = pickHoldings.get(roster.roster_id) ?? [];
        const pickValue = held.reduce((sum, pick) => sum + (picks.valueOf(pick) ?? 0), 0);
        return { total: playerValue + pickValue, playerValue, pickValue, picks: held };
    });

    const nowZ = Object.fromEntries(
        sourceIds.map((sourceId) => [sourceId, zScores(lineups.map((lineup) => lineup[sourceId].total))]),
    );
    const futureZ = zScores(futureTotals.map((f) => f.total));

    return rosters.map((roster, i) => {
        const now = Object.fromEntries(sourceIds.map((sourceId) => [sourceId, nowZ[sourceId][i]]));
        // The blend is the mean of the sources' z-scores, not a z-score of
        // summed raw totals: the sources live on different scales (points,
        // KTC's 0-10k, FantasyCalc's 0-11k), and summing them first would let
        // the biggest scale decide.
        now.blend = sourceIds.length ? sourceIds.reduce((sum, id) => sum + now[id], 0) / sourceIds.length : null;

        const tiers = Object.fromEntries(Object.entries(now).map(([id, z]) => [id, tierFor(z, futureZ[i])]));

        return {
            rosterId: roster.roster_id,
            ownerId: roster.owner_id,
            name: roster.manager_display_name,
            now,
            future: futureZ[i],
            tiers,
            lineups: lineups[i],
            futureDetail: futureTotals[i],
        };
    });
}

/**
 * The rookie-draft seasons whose picks still count as future assets.
 *
 * A season's picks stop being picks once its draft has run - they are
 * players on a roster by then. So this season counts only while its draft is
 * still to come, and only seasons the value source prices are kept: an
 * unpriced 2029 pick would count as 0 for every team, and a guessed price
 * would be a number made up for the screen.
 */
export function pickSeasonsInScope({ pricedSeasons, leagueSeason, currentDraftComplete }) {
    const season = Number(leagueSeason);
    return [...new Set((pricedSeasons ?? []).map(Number))]
        .filter((priced) => priced > season || (priced === season && !currentDraftComplete))
        .sort((a, b) => a - b);
}

/**
 * 1-based rank of each team by a score, best first, keyed by roster id.
 */
export function ranksBy(teams, score) {
    const ordered = [...teams].sort((a, b) => (score(b) ?? -Infinity) - (score(a) ?? -Infinity));
    return new Map(ordered.map((team, i) => [team.rosterId, i + 1]));
}
