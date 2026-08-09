import { describeParsed, parseRankLine } from './lib/rankParse.js';
import { matchPlayer, playerIndex } from './lib/rankMatch.js';

/**
 * A pasted ranking list as ranked match candidates, plus the lines that
 * matched nothing.
 *
 * The two hard parts each live in their own module now - reading a line
 * (lib/rankParse.js) and finding the player it names (lib/rankMatch.js) - and
 * what is left here is the part that was never in doubt: walk the lines, keep
 * a rank counter, sort the outcomes into the two buckets the panel renders.
 *
 * A rank is spent on every line that named something, whether or not it was
 * found: the miss list is numbered against the list the user pasted, so a
 * player who could not be matched still occupies their place in it. Lines that
 * parse to nothing at all - blanks, and rows that were only a rank number -
 * are skipped without consuming one.
 */
const createRankings = (searchText, playerInfo) => {
    const index = playerIndex(playerInfo);
    const searchResultsArray = [];
    const notFoundPlayers = [];
    let ranking = 1;

    searchText.split(/\r\n|\r|\n/).forEach((line) => {
        const parsed = parseRankLine(line);
        if (!parsed) return;

        const matches = matchPlayer(parsed, index);
        if (matches.length > 0) {
            searchResultsArray.push({
                match_results: matches,
                ranking,
                search_string: describeParsed(parsed),
            });
        } else {
            notFoundPlayers.push(`Couldn't find ${describeParsed(parsed)} Rank: ${ranking}`);
        }
        ranking += 1;
    });

    return [searchResultsArray, notFoundPlayers];
};

export default createRankings;
