import { describeParsed, parseRankLine, readTierMarker } from './lib/rankParse.js';
import { matchPlayer, playerIndex } from './lib/rankMatch.js';
import { rowToParsed, toRows } from './lib/rankColumns.js';
import { TierRun } from './lib/rankTiers.js';

/**
 * The list as a stream of what each line turned out to be: a player, a tier
 * heading, a blank, or nothing worth a rank.
 *
 * Two ways in. Without a column map every line is guessed at by the flat-line
 * parser; with one the fields are read straight out of their columns and
 * nothing is inferred. A ranking list that arrives as a table already knows
 * which token is the team, and the guessing is only there because a paste
 * usually throws that away.
 *
 * Blanks are told apart from junk here, where they used to be lumped together
 * as "skip": a blank line is how an untitled list separates its tiers, and it
 * cannot mean that if it has already been discarded. The mapped path has no
 * equivalent - `toRows` drops empty rows, and no column is offered for tiers -
 * so a table is always one tier.
 */
function readAll(searchText, columnMap) {
    if (columnMap) {
        const rows = toRows(searchText, columnMap.delimiter) ?? [];
        const body = columnMap.hasHeader ? rows.slice(1) : rows;
        return body.map((cells) => {
            const parsed = rowToParsed(cells, columnMap);
            return parsed ? { kind: 'player', parsed } : { kind: 'skip' };
        });
    }

    return searchText.split(/\r\n|\r|\n/).map((line) => {
        if (!line.trim()) return { kind: 'blank' };

        const tier = readTierMarker(line);
        if (tier) return { kind: 'tier', tier };

        const parsed = parseRankLine(line);
        return parsed ? { kind: 'player', parsed } : { kind: 'skip' };
    });
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
 * parse to nothing at all - blanks, tier headings, and rows that were only a
 * rank number - are skipped without consuming one.
 *
 * `columnMap` is the mapping the user confirmed in the paste sheet, or null
 * for a plain one-per-line list. The rank column is deliberately not read from
 * it: rank is the row's position in the list the user is looking at, and a
 * file whose own numbering skips or repeats must not renumber their list.
 */
const createRankings = (searchText, playerInfo, columnMap = null) => {
    const index = playerIndex(playerInfo);
    const items = readAll(searchText, columnMap);
    const tiers = new TierRun(items);
    const searchResultsArray = [];
    const notFoundPlayers = [];
    let ranking = 1;

    items.forEach((item) => {
        if (item.kind === 'tier') {
            tiers.heading(item.tier);
            return;
        }
        if (item.kind === 'blank') {
            tiers.blank();
            return;
        }
        if (item.kind !== 'player') return;

        const tier = tiers.forNextPlayer();
        const matches = matchPlayer(item.parsed, index);
        if (matches.length > 0) {
            searchResultsArray.push({
                match_results: matches,
                ranking,
                search_string: describeParsed(item.parsed),
                ...tier,
            });
        } else {
            // An object rather than the sentence it used to be. A miss is
            // something the user can now resolve by hand, and resolving it
            // needs the rank it was going to occupy - which a formatted
            // string had thrown away. It carries its tier for the same
            // reason: the player picked joins the tier the line was in.
            notFoundPlayers.push({ ranking, search_string: describeParsed(item.parsed), ...tier });
        }
        ranking += 1;
    });

    return [tiers.settle(searchResultsArray), tiers.settle(notFoundPlayers)];
};

export default createRankings;
