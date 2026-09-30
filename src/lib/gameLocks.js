// Statuses that mean a game has not kicked off. Sleeper reports `pre_game`
// until kickoff and `complete` after; a postponed game reads `canceled`, and
// its players are no more locked than they were before it was scheduled.
const NOT_STARTED = new Set(['pre_game', 'canceled']);

/**
 * The teams whose game in the current week has kicked off, from Sleeper's
 * season schedule and `state/nfl`. Anything other than a known not-started
 * status counts as started, so an in-progress status this code has never seen
 * spelt still locks rather than letting a playing starter be swapped out.
 *
 * The schedule only covers the regular season, so outside it (preseason,
 * playoffs) nothing is reported as played.
 */
export function teamsThatHavePlayed({ games, nflState }) {
    if (nflState?.season_type !== 'regular') {
        return new Set();
    }
    return new Set(
        (games || [])
            .filter((game) => game.week === nflState.week && !NOT_STARTED.has(game.status))
            .flatMap((game) => [game.home, game.away]),
    );
}
