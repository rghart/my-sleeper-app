/**
 * Decorates each roster with its manager's display name and avatar, resolved
 * by matching `owner_id` against `managerData`'s `user_id`. A roster with no
 * matching manager (or no owner) falls back to `'Unassigned <roster_id>'` and
 * a null avatar. Never mutates its inputs; returns a brand new array.
 */
export function decorateRosters({ rosterData, managerData }) {
    return rosterData.map((roster) => {
        const manager = managerData.find((m) => m.user_id === roster.owner_id);
        return {
            ...roster,
            manager_display_name: manager ? manager.display_name : 'Unassigned' + ' ' + roster.roster_id,
            avatar: manager ? manager.avatar : null,
        };
    });
}

/**
 * Builds a `Map<playerId, { is_taken, rostered_by }>` derived from decorated
 * roster data and (optionally) a draft board. Rosters are applied first, then
 * board picks with a truthy `player_id` are applied on top - a draft pick
 * outranks the roster, matching the precedence of the pre-refactor code where
 * `applyLivePicks` ran after `markTakenPlayers`. `rosterData` must already be
 * decorated (see `decorateRosters`) so `manager_display_name` is available.
 * Never mutates its inputs.
 */
export function buildRosterInfo({ rosterData, builtDraft }) {
    const rosterInfo = new Map();

    rosterData.forEach((roster) => {
        if (!roster.players) {
            return;
        }
        roster.players.forEach((playerId) => {
            rosterInfo.set(playerId, { is_taken: true, rostered_by: roster.manager_display_name });
        });
    });

    if (builtDraft) {
        builtDraft.forEach((round) => {
            round.picks.forEach((pick) => {
                if (!pick.player_id) {
                    return;
                }
                const roster = rosterData.find((r) => r.roster_id === pick.owner_id);
                rosterInfo.set(pick.player_id, {
                    is_taken: true,
                    rostered_by: roster ? roster.manager_display_name : null,
                });
            });
        });
    }

    return rosterInfo;
}

/**
 * Whether a player is on a roster or occupies a draft pick. A player id that
 * isn't in the map - a free agent, or an id the player DB doesn't know - is
 * untaken rather than an error.
 */
export function isTaken(rosterInfo, playerId) {
    return rosterInfo.get(playerId)?.is_taken ?? false;
}

/**
 * The display name of the manager who holds a player, or null when nobody
 * does. Tolerates an unknown player id for the same reason as `isTaken`.
 */
export function rosteredBy(rosterInfo, playerId) {
    return rosterInfo.get(playerId)?.rostered_by ?? null;
}

/**
 * Builds the set of player ids currently occupying a lineup slot.
 * `rosterPositions` is a mixed array of bare position labels (e.g. 'QB',
 * 'FLX', 'SFLX') and player ids; Sleeper player ids are purely numeric
 * strings, while every position label contains at least one letter, so that
 * distinguishes the two without hardcoding a position-label table.
 */
export function buildLineupSet(rosterPositions) {
    return new Set(rosterPositions.filter((entry) => /^\d+$/.test(entry)));
}

/**
 * Whether a player currently fills one of the lineup slots built by
 * `buildLineupSet`.
 */
export function isInLineup(lineupSet, playerId) {
    return lineupSet.has(playerId);
}

/**
 * Returns a memoizing selector for `buildRosterInfo`: repeated calls with the
 * same `rosterData` and `builtDraft` references (by identity) return the
 * identical Map instance; a change to either identity triggers a rebuild.
 * Single-entry cache.
 */
export function memoizeRosterInfo() {
    let lastRosterData;
    let lastBuiltDraft;
    let lastResult;

    return ({ rosterData, builtDraft }) => {
        if (lastResult && rosterData === lastRosterData && builtDraft === lastBuiltDraft) {
            return lastResult;
        }
        lastRosterData = rosterData;
        lastBuiltDraft = builtDraft;
        lastResult = buildRosterInfo({ rosterData, builtDraft });
        return lastResult;
    };
}
