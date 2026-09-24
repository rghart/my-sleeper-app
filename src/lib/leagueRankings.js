// Loading everything a league's power rankings need, and ranking it.
//
// Split out of PowerRankingsPanel because a second caller needs the same
// thing: the menu shows your tier in every one of your leagues, which means
// ranking leagues that are not on screen. The value lists are shared across
// leagues - every superflex league reads the same KTC list, every 2026 league
// the same projections - so they are cached here, per session, by what they
// depend on. Only rosters and traded picks are truly per league.

import { pickValue, usesSuperflexValues, valuesByPlayerId } from './dynastyValues.js';
import { leagueMarketSettings } from './marketValues.js';
import { pickSeasonsInScope, rankTeams } from './powerRankings.js';
import { adpValues, projectionValues } from './projections.js';
import {
    fetchDynastyValues,
    fetchLeagueRosters,
    fetchLeagueTradedPicks,
    fetchMarketValues,
    fetchSeasonProjections,
} from './sleeperApi.js';

const cache = new Map();

// Caches the promise rather than the result, so two leagues asking for the
// same list at once share one request. A failure (`undefined`) is evicted
// once it settles, so the next caller retries instead of inheriting it.
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
 * The four inputs a league's rankings rest on. Any of them may come back
 * `undefined` - each has its own consequence, decided by `rankLeague` and
 * said out loud by the screen.
 */
export async function fetchRankingInputs(league) {
    const settings = leagueMarketSettings(league);
    const superflex = usesSuperflexValues(settings);
    const [ktc, fc, tradedPicks, projections] = await Promise.all([
        cached(`ktc:${superflex}`, () => fetchDynastyValues({ superflex })),
        cached(`fc:${JSON.stringify(settings)}`, () => fetchMarketValues(settings)),
        fetchLeagueTradedPicks(league.league_id),
        league.season
            ? cached(`proj:${league.season}`, () => fetchSeasonProjections(league.season))
            : Promise.resolve(undefined),
    ]);
    // An empty projections list is a failure in all but name - a season with
    // no projections cannot rank anyone - so it is treated as one.
    return {
        ktc,
        fc,
        // Anything but a list is not a list of traded picks - an error body
        // that parsed as JSON, say - and iterating it would crash the ranking.
        tradedPicks: Array.isArray(tradedPicks) ? tradedPicks : undefined,
        projections: projections?.length ? projections : undefined,
    };
}

/**
 * Rank one league from its rosters and inputs. `null` without KTC, which the
 * Future score cannot do without; every other input only removes a source
 * (or, for traded picks, the picks) when missing.
 */
export function rankLeague({ league, rosters, playerInfo, inputs, currentDraftComplete }) {
    if (!inputs?.ktc || !rosters?.length || !league) return null;

    // The caller may know the draft's own status; failing that, Sleeper's
    // league status says the same thing a step removed - a dynasty league is
    // `pre_draft` or `drafting` until this season's rookie draft is done.
    const draftDone = currentDraftComplete ?? !['pre_draft', 'drafting'].includes(league.status);

    const superflex = usesSuperflexValues(leagueMarketSettings(league));
    const ktcById = valuesByPlayerId(inputs.ktc);
    const fcById = valuesByPlayerId(inputs.fc);
    const ktcValue = (id) => ktcById[id]?.value;

    const sources = {};
    if (inputs.projections) {
        const points = projectionValues(inputs.projections, league.scoring_settings);
        const adp = adpValues(inputs.projections, { superflex, ppr: league.scoring_settings?.rec });
        sources.proj = { valueOf: (id) => points[id] };
        sources.adp = { valueOf: (id) => adp[id] };
    }
    sources.ktc = { valueOf: ktcValue };
    if (inputs.fc) sources.fc = { valueOf: (id) => fcById[id]?.value };

    return rankTeams({
        rosters,
        rosterPositions: league.roster_positions,
        playerInfo,
        sources,
        future: { valueOf: ktcValue },
        // Without the traded-picks list every team would be credited with its
        // own picks - a claim nothing here can back - so picks are left out
        // entirely instead.
        picks: inputs.tradedPicks
            ? {
                  seasons: pickSeasonsInScope({
                      pricedSeasons: (inputs.ktc.picks ?? []).map((pick) => pick.season),
                      leagueSeason: league.season,
                      currentDraftComplete: draftDone,
                  }),
                  rounds: league.settings?.draft_rounds ?? 0,
                  tradedPicks: inputs.tradedPicks,
                  valueOf: (pick) => pickValue(inputs.ktc, pick)?.value,
              }
            : null,
    });
}

/**
 * Whether a roster is this user's, including as a co-owner.
 */
export const isMyRoster = (roster, userId) =>
    userId != null && (roster.owner_id === userId || (roster.co_owners ?? []).includes(userId));

/**
 * This user's tier in one league, under the blend - what the menu shows
 * beside the league's name. `null` whenever there is nothing honest to show:
 * no roster of theirs, no KTC, or a league that has not drafted yet (every
 * roster empty, so every team would tie at "Middle" and mean nothing).
 */
//
// Cached per league and user for the session, like the value lists: the menu
// asks again whenever it re-renders, and a tier does not move between two
// renders.
export function myTierIn(league, { userId, playerInfo, rosters }) {
    if (!league || league.status === 'pre_draft') return Promise.resolve(null);
    return cached(`tier:${league.league_id}:${userId}`, () => loadMyTier(league, { userId, playerInfo, rosters }));
}

async function loadMyTier(league, { userId, playerInfo, rosters }) {
    const [roster, inputs] = await Promise.all([
        rosters ? Promise.resolve(rosters) : fetchLeagueRosters(league.league_id),
        fetchRankingInputs(league),
    ]);
    // `undefined` for "could not work it out" (rosters or KTC failed) so the
    // cache drops it and the next ask retries; `null` for "worked it out, and
    // you have no team here", which is worth remembering.
    if (!roster) return undefined;
    const mine = roster.find((candidate) => isMyRoster(candidate, userId));
    if (!mine) return null;
    const teams = rankLeague({ league, rosters: roster, playerInfo, inputs });
    if (!teams) return undefined;
    return teams.find((candidate) => candidate.rosterId === mine.roster_id)?.tiers.blend ?? null;
}
