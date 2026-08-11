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
 * line equally well come back best-known-first. The per-surname indexes in
 * `buckets` are built from this same array, so they inherit that order.
 */
const fuseOver = (players) =>
    new Fuse(
        players,
        { useExtendedSearch: true, includeScore: true, keys: FUSE_KEYS },
        Fuse.createIndex(FUSE_KEYS, players),
    );

export function playerIndex(playerInfo) {
    const cached = indexCache.get(playerInfo);
    if (cached) return cached;

    const players = Object.values(playerInfo);
    players.sort((a, b) => a.search_rank - b.search_rank);

    // `players` is kept beside the index so `matchPlayer` can narrow to a
    // surname before searching, and `buckets` memoises the small index built
    // for each surname - a list with several Browns in it pays for one.
    const index = { fuse: fuseOver(players), players, buckets: new Map() };

    indexCache.set(playerInfo, index);
    return index;
}

/**
 * A small index over just the players whose surname contains `last`.
 *
 * Containment rather than equality, which matters more than it looks: the
 * surname clause is Fuse's fuzzy-match operator, so `brown` already matches
 * `Brownlee` at score 0 in the full search. Narrowing to an exact `brown`
 * would drop those, and a dropped score-0 candidate can change the winner.
 * Containment keeps every candidate the full search would have scored at or
 * near 0 and only gives up the genuinely fuzzy ones - a misspelt surname,
 * which is what the fallback in `matchPlayer` is for.
 */
function bucketFor(index, last) {
    const key = last.toLowerCase();
    const cached = index.buckets.get(key);
    if (cached) return cached;

    const players = index.players.filter((player) => player.search_last_name?.includes(key));
    // Null rather than an empty index: "no surname like this" is the signal
    // the caller needs to fall back, and building a Fuse over nothing to
    // discover that is waste.
    const bucket = players.length > 0 ? fuseOver(players) : null;
    index.buckets.set(key, bucket);
    return bucket;
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
 * The remaining cost is that every branch is scanned against every player,
 * which is what `bucketFor` addresses - see `matchPlayer`.
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

    const query = queryFor(parsed);
    const take = (results) =>
        results
            .filter((result) => POSITIONS.includes(result.item.position))
            .slice(0, MAX_CANDIDATES)
            .map((result) => [result.item.player_id, result.score.toFixed(3)]);

    // Almost every line names a surname that exists, so almost every line is
    // answered by an index a few dozen players wide instead of nine thousand.
    // A Fuse score is computed per record and does not depend on the size of
    // the corpus, so the narrow search returns the same players with the same
    // scores - it just does not have to look at everyone to say so.
    const bucket = bucketFor(index, parsed.last);
    if (bucket) {
        const narrow = take(bucket.search(query));
        if (narrow.length > 0) return narrow;
    }

    // Nothing contained that surname, or nothing in the bucket survived the
    // position filter. Either way the full fuzzy search is the only thing that
    // can still match a misspelt name, and it is rare enough to be worth its
    // cost when it happens.
    return take(index.fuse.search(query));
}
