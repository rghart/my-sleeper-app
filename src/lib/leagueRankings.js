// A league's power rankings, from the backend.
//
// The ranking itself - best lineups, z-scores, tiers, pick pricing - used to
// be computed here from KTC, FantasyCalc, Sleeper's projections and the
// league's traded picks. It moved to sleeper-player-be
// (`GET /api/v1/leagues/:id/rankings`, `Intel.LeagueRankings`) so the app and
// an agent read one implementation, and it was checked there against this
// app's own results on real leagues before this file stopped computing them.
//
// What is left is fetching, sharing a fetch between the panel and the menu,
// and reading the response into the team shape the screens were built on.

import { fetchLeagueRankings, fetchLeagueRosters } from './sleeperApi.js';

const cache = new Map();

// Caches the promise rather than the result, so the menu and the panel asking
// for one league at once share one request. A failure (`undefined`) is
// evicted once it settles, so the next caller retries instead of inheriting it.
function cached(key, load) {
    if (!cache.has(key)) {
        const promise = load().then((result) => {
            if (result === undefined) cache.delete(key);
            return result;
        });
        cache.set(key, promise);
    }
    return cache.get(key);
}

// For tests: each one starts with nothing cached.
export function clearRankingCache() {
    cache.clear();
}

/**
 * The rankings response for a league, or `undefined` when it could not be
 * had. `fresh` skips the session cache and replaces it: the panel asks fresh
 * each time it opens, since rosters move, and the menu reuses what it got.
 */
export function loadLeagueRankings(leagueId, { fresh = false } = {}) {
    const key = `rankings:${leagueId}`;
    if (fresh) cache.delete(key);
    return cached(key, () => fetchLeagueRankings(leagueId));
}

/**
 * The response's teams in the shape the screens read: `now`, `future`,
 * `tiers` and `lineups` keyed by source id, `picks` for net pick value, and
 * `futureDetail` with each held pick's price and how it was priced.
 */
export function teamsFromRankings(response) {
    return (response?.teams ?? []).map((team) => ({
        rosterId: team.rosterId,
        ownerId: team.ownerId,
        name: team.name,
        now: team.now,
        future: team.future,
        picks: team.netPickValue,
        tiers: team.tiers,
        lineups: team.lineups,
        futureDetail: team.futureDetail,
    }));
}

/**
 * Whether a roster is this user's, including as a co-owner.
 */
export const isMyRoster = (roster, userId) =>
    userId != null && (roster.owner_id === userId || (roster.co_owners ?? []).includes(userId));

/**
 * This user's tier in one league, under the blend - what the menu shows
 * beside the league's name. `null` whenever there is nothing honest to show:
 * no roster of theirs, or a league that has not drafted yet (every roster
 * empty, so every team would tie at "Middle" and mean nothing).
 *
 * Rosters are fetched rather than read off the response because a co-owner
 * is an owner too, and only Sleeper's roster lists co-owners.
 */
//
// Cached per league and user for the session: the menu asks again whenever
// it re-renders, and a tier does not move between two renders.
export function myTierIn(league, { userId, rosters }) {
    if (!league || league.status === 'pre_draft') return Promise.resolve(null);
    return cached(`tier:${league.league_id}:${userId}`, () => loadMyTier(league, { userId, rosters }));
}

async function loadMyTier(league, { userId, rosters }) {
    const [roster, rankings] = await Promise.all([
        rosters ? Promise.resolve(rosters) : fetchLeagueRosters(league.league_id),
        loadLeagueRankings(league.league_id),
    ]);
    // `undefined` for "could not work it out" (rosters or rankings failed) so
    // the cache drops it and the next ask retries; `null` for "worked it out,
    // and you have no team here", which is worth remembering.
    if (!roster || !rankings) return undefined;
    const mine = roster.find((candidate) => isMyRoster(candidate, userId));
    if (!mine) return null;
    return rankings.teams.find((team) => team.rosterId === mine.roster_id)?.tiers.blend ?? null;
}
