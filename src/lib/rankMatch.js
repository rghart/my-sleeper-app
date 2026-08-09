import Fuse from 'fuse.js';
import { POSITIONS } from './rankParse.js';

// Turning parsed fields into candidate players. This half owns the player
// database and knows nothing about pasted text - see rankParse.js for the
// other side of the seam.

const FUSE_KEYS = ['search_last_name', 'search_first_name', 'team', 'position'];

// Keyed on the `playerInfo` object itself, so a new payload gets a new index
// and a stale one is collected with it.
//
// Worth doing, but not the win it looks like: building the index over an 11k
// player pool measures at 11ms, against 2.5-10s for the searches that follow
// it in a 200-line paste. The old code rebuilt it per call and that was never
// what made pasting slow - see `queryFor` for what actually costs.
const indexCache = new WeakMap();

/**
 * The searchable index over `playerInfo`, built at most once per payload.
 *
 * Sorted by `search_rank` because the order survives into the results: Fuse
 * returns equal-scoring matches in index order, so two players who match a
 * line equally well come back best-known-first.
 */
export function playerIndex(playerInfo) {
    const cached = indexCache.get(playerInfo);
    if (cached) return cached;

    const players = Object.values(playerInfo);
    players.sort((a, b) => a.search_rank - b.search_rank);
    const fuse = new Fuse(
        players,
        { useExtendedSearch: true, includeScore: true, keys: FUSE_KEYS },
        Fuse.createIndex(FUSE_KEYS, players),
    );

    indexCache.set(playerInfo, fuse);
    return fuse;
}

/**
 * The query for one parsed line: the surname and first name always, then the
 * fields the line actually supplied, most specific first.
 *
 * Built from what is present rather than from fixed slots. The old code always
 * emitted all four branches, filling the missing pieces with `undefined` - so
 * a line carrying a position and no team searched `team: '=RB'` and
 * `position: '=undefined'`, and three of its four branches could not match
 * anything. Only the name-only fallback ever fired, which is why the bug
 * looked like nothing more than mediocre matching.
 *
 * The search cost is close to linear in the branch count (measured: 15.9ms for
 * one branch, 62.5ms for four, per line over an 11k pool), so dropping the
 * branches a line cannot use is also the only real speed-up here: a 200-line
 * paste of bare names went 9.55s -> 2.56s, and one with names and teams
 * 9.67s -> 5.10s, with identical winners. A line carrying both fields still
 * emits all four and is unchanged.
 *
 * That leaves the honest number bad: seconds, for a paste. The cost is the
 * fuzzy surname match scanning every player, and an exact-surname prefilter
 * measures at 1.7ms/line against 62.5. It is not done here because it would
 * stop tolerating a misspelt surname, which is a matching-quality decision
 * rather than a refactor.
 */
function queryFor({ first, last, team, position }) {
    const name = [
        { search_last_name: last },
        { $or: [{ search_first_name: first }, { search_first_name: `^${first}` }] },
    ];
    const branches = [];

    if (position && team) branches.push({ $and: [...name, { position: `=${position}` }, { team: `=${team}` }] });
    if (position) branches.push({ $and: [...name, { position: `=${position}` }] });
    if (team) branches.push({ $and: [...name, { team: `=${team}` }] });
    branches.push({ $and: name });

    return { $or: branches };
}

/** How many candidates a single line is allowed to offer for correction. */
const MAX_CANDIDATES = 5;

/**
 * The players a parsed line could mean, best first, as `[player_id, score]`.
 *
 * Empty means the line matched nothing. Non-playing entries are filtered out
 * by position rather than trusted from the payload, because the player pool
 * carries coaches and retired players that no ranking list ever refers to.
 */
export function matchPlayer(parsed, index) {
    if (!parsed?.last) return [];

    return index
        .search(queryFor(parsed))
        .filter((result) => POSITIONS.includes(result.item.position))
        .slice(0, MAX_CANDIDATES)
        .map((result) => [result.item.player_id, result.score.toFixed(3)]);
}
