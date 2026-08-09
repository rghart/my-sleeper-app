import Fuse from 'fuse.js';

// Turning one pasted line into named fields. Text in, `{ first, last, team,
// position }` out - and nothing about the player database in here at all.
//
// This is half of what used to be `createRankings`. The two halves were fused
// into a single loop, and the seam is where the bugs lived: the old code
// carried the parsed pieces in a positional `searchArray` whose slots meant
// "first, last, team, position" only when every piece had been found. A line
// with a position and no recognisable team put the position in the team slot
// and `undefined` in the position slot (see `parseRankLine` below). Named
// fields make that unrepresentable.

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'];

// Both spellings of the two clubs Sleeper has been inconsistent about (LA/LAR,
// JAX/JAC), plus the two non-clubs that appear in ranking exports: FA for an
// unsigned player and ROOKIE for a pre-draft one. They are here because a
// pasted line uses them exactly like a team abbreviation, so the parser has to
// recognise them to strip them off the name.
const TEAMS = [
    'CAR',
    'MIN',
    'TEN',
    'GB',
    'NO',
    'NYG',
    'KC',
    'IND',
    'LAC',
    'DAL',
    'BUF',
    'CLE',
    'SEA',
    'ARI',
    'LV',
    'ATL',
    'LAR',
    'LA',
    'FA',
    'CIN',
    'SF',
    'JAX',
    'JAC',
    'WAS',
    'CHI',
    'PHI',
    'BAL',
    'TB',
    'DEN',
    'HOU',
    'PIT',
    'MIA',
    'DET',
    'NE',
    'NYJ',
    'ROOKIE',
];

// Built once at module load rather than per paste. The list is static, so the
// old code's rebuild-per-call was pure waste - though small waste, like the
// player index in rankMatch.js. Neither is what makes a paste slow.
const teamsFuse = new Fuse(TEAMS, { includeScore: true });

/**
 * The one token in `tokens` that is exactly a team abbreviation, or null.
 *
 * Exact only, despite going through Fuse: the `score === 0` test is what makes
 * it exact. Fuzzy team matching would eat surnames - `Bell` is one edit from
 * `BAL` - so the fuzziness here buys nothing and the strictness is the point.
 */
function findTeam(tokens) {
    const best = tokens
        .map((token) => teamsFuse.search(token.replace(/[^a-zA-Z]/g, '')))
        .filter((results) => results.length > 0)
        .sort((a, b) => a[0]?.score - b[0]?.score);
    return best[0] && best[0][0].score === 0 ? best[0][0].item : null;
}

/**
 * Strip the punctuation a ranking export puts between initials, without
 * flattening a player who genuinely goes by them.
 *
 * `T.Brady` is one name with a separator; `J.K. Dobbins` is a first name that
 * is two initials. Position 3 tells them apart: a second period there means
 * initials, so the separator to fix is the space after them instead.
 *
 * Both rules read fixed offsets, so they only work if the name starts at
 * offset 0. `20. T.Brady` does not: stripping the digits leaves `. T.Brady`,
 * and the old code blanked the period in place instead of removing it, so
 * every offset after it was one out and the initials rule silently missed. The
 * caller trims the leading punctuation off first - see `parseRankLine`.
 */
function spaceOutInitials(chars) {
    if (chars[1] === '.' && chars[3] !== '.') {
        chars.splice(1, 1, ' ');
    } else if (chars[1] === '.' && chars[3] === '.' && chars[4] !== ' ') {
        chars.splice(3, 1, '. ');
    }
    return chars;
}

/**
 * One pasted line as named fields, or `null` where the line carries no name at
 * all (a blank, or a row that was nothing but its rank number).
 *
 * A null return is not a miss - it is a line that was never a player, and the
 * caller must not spend a rank on it.
 *
 * `team` and `position` are null when the line did not carry them, which is
 * the fix for the positional-slot bug described at the top of this file: the
 * old code only looked for either when a line had more than two tokens, then
 * unshifted whatever it found onto a shared array, so "Bijan Robinson RB"
 * searched for a player on team `RB` at position `undefined`. It still matched
 * him, but only via the last-resort name-only branch - every field the line
 * actually supplied was being spent on a query that could not hit.
 */
export function parseRankLine(line) {
    // Digits go first: a leading "1." rank, a trailing bye week and an ADP
    // column are all noise, and none of them survive as letters.
    const withoutDigits = line.replace(/[0-9]/g, '');
    if (!withoutDigits.trim()) return null;

    // The name has to start at offset 0 for the initials rules to line up, so
    // whatever the rank number left behind - `. `, `) `, a tab - goes first.
    const chars = spaceOutInitials(withoutDigits.replace(/^[^a-zA-Z]+/, '').split(''));
    const lettersOnly = chars.map((char) => char.replace(/[^a-zA-Z\s]/g, '')).join('');
    if (!lettersOnly.trim()) return null;

    const tokens = lettersOnly
        .trim()
        .split(/\s/)
        .map((token) => token.trim())
        .filter(Boolean);

    let team = null;
    let position = null;

    // Only past the second token: the first two are the name, and a surname
    // like `Metcalf` or a first name like `Ken` must never be read as a
    // position or a club.
    if (tokens.length > 2) {
        const positionIndex = tokens.findIndex((token, index) => POSITIONS.includes(token) && index > 1);
        if (positionIndex >= 0) {
            position = tokens.splice(positionIndex, 1)[0];
        }
        team = findTeam(tokens.slice(2));
        if (team) {
            tokens.splice(tokens.indexOf(team), 1);
        }
    }

    return { first: tokens[0], last: tokens[1], team, position };
}

/** How a parsed line reads back to a user - the miss list is built from this. */
export function describeParsed({ first, last, team, position }) {
    return [first, last, team, position].filter(Boolean).join(' ');
}
