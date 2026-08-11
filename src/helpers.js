import { describeParsed, parseRankLine } from './lib/rankParse.js';
import { matchPlayer, playerIndex } from './lib/rankMatch.js';
import { rowToParsed, toRows } from './lib/rankColumns.js';

/**
 * The list as parsed fields, one entry per line, `null` where a line named
 * nothing.
 *
 * Two ways in. Without a column map every line is guessed at by the flat-line
 * parser; with one the fields are read straight out of their columns and
 * nothing is inferred. A ranking list that arrives as a table already knows
 * which token is the team, and the guessing is only there because a paste
 * usually throws that away.
 */
function parseAll(searchText, columnMap) {
    if (!columnMap) {
        return searchText.split(/\r\n|\r|\n/).map(parseRankLine);
    }
    const rows = toRows(searchText, columnMap.delimiter) ?? [];
    const body = columnMap.hasHeader ? rows.slice(1) : rows;
    return body.map((cells) => rowToParsed(cells, columnMap));
}

/**
 * A pasted ranking list as ranked match candidates, plus the lines that
 * matched nothing.
 *
 * The two hard parts each live in their own module now - reading a line
 * (lib/rankParse.js or lib/rankColumns.js) and finding the player it names
 * (lib/rankMatch.js) - and what is left here is the part that was never in
 * doubt: walk the lines, keep a rank counter, sort the outcomes into the two
 * buckets the panel renders.
 *
 * A rank is spent on every line that named something, whether or not it was
 * found: the miss list is numbered against the list the user pasted, so a
 * player who could not be matched still occupies their place in it. Lines that
 * parse to nothing at all - blanks, and rows that were only a rank number -
 * are skipped without consuming one.
 *
 * `columnMap` is the mapping the user confirmed in the paste sheet, or null
 * for a plain one-per-line list. The rank column is deliberately not read from
 * it: rank is the row's position in the list the user is looking at, and a
 * file whose own numbering skips or repeats must not renumber their list.
 */
const createRankings = (searchText, playerInfo, columnMap = null) => {
    const index = playerIndex(playerInfo);
    const searchResultsArray = [];
    const notFoundPlayers = [];
    let ranking = 1;

    parseAll(searchText, columnMap).forEach((parsed) => {
        if (!parsed) return;

        const matches = matchPlayer(parsed, index);
        if (matches.length > 0) {
            searchResultsArray.push({
                match_results: matches,
                ranking,
                search_string: describeParsed(parsed),
            });
        } else {
            // An object rather than the sentence it used to be. A miss is
            // something the user can now resolve by hand, and resolving it
            // needs the rank it was going to occupy - which a formatted
            // string had thrown away.
            notFoundPlayers.push({ ranking, search_string: describeParsed(parsed) });
        }
        ranking += 1;
    });

    return [searchResultsArray, notFoundPlayers];
};

export default createRankings;
