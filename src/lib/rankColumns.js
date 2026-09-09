import { POSITIONS } from './rankParse.js';

// Reading a ranking list that arrived with its columns intact - a CSV file, or
// a paste straight out of a spreadsheet, which is tab-separated.
//
// This exists because the flat-line parser in rankParse.js spends all of its
// effort *guessing* which token is the team and which is the name, and a table
// already answers that. Nothing here is fuzzy: given a column map, a row is
// read, not inferred.

const DELIMITERS = ['\t', ','];

/**
 * One delimited line as cells, honouring the quoting rule every spreadsheet
 * export follows: a quoted field may contain the delimiter, and `""` inside
 * one is a literal quote.
 *
 * Without this a CSV written surname-first - `"Chase, Ja'Marr",CIN,WR` - reads
 * as four columns, and the column map silently points at the wrong ones.
 */
function splitLine(line, delimiter) {
    const cells = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (quoted) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                cell += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === delimiter) {
            cells.push(cell.trim());
            cell = '';
        } else {
            cell += char;
        }
    }
    cells.push(cell.trim());
    return cells;
}

/**
 * The delimiter this text is laid out with, or null if it is one column of
 * free text and the flat-line parser should handle it.
 *
 * Chosen by consistency rather than by count: a delimiter that yields the same
 * number of cells on most lines is a real table, whereas commas scattered
 * through `Smith Jr., WR` are not. Tabs win ties because a spreadsheet paste
 * is tab-separated and may legitimately contain commas inside a cell.
 */
export function detectDelimiter(text) {
    const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim());
    if (lines.length === 0) return null;

    for (const delimiter of DELIMITERS) {
        const counts = lines.map((line) => splitLine(line, delimiter).length);
        const table = counts.filter((count) => count > 1);
        if (table.length < Math.max(2, lines.length * 0.6)) continue;

        // Every row agreeing on a width is what separates a table from text
        // that happens to contain the character.
        const widest = counts.reduce((a, b) => (a > b ? a : b));
        const agreeing = counts.filter((count) => count === widest).length;
        if (agreeing >= lines.length * 0.6) return delimiter;
    }
    return null;
}

/** The text as a grid, or null where it is not delimited at all. */
export function toRows(text, delimiter = detectDelimiter(text)) {
    if (!delimiter) return null;
    return text
        .split(/\r\n|\r|\n/)
        .filter((line) => line.trim())
        .map((line) => splitLine(line, delimiter));
}

const HEADER_WORDS = {
    name: ['player', 'name', 'players', 'player name', 'players name', 'full name', 'player full name'],
    first: ['first', 'firstname', 'first name', 'first names'],
    last: ['last', 'lastname', 'last name', 'surname'],
    team: ['team', 'tm', 'nfl', 'club'],
    position: ['pos', 'position', 'posn'],
    rank: ['rank', 'rk', '#', 'no', 'ovr', 'overall'],
};

const ROLES = ['name', 'first', 'last', 'team', 'position', 'rank'];

const emptyMapping = () => ({ name: null, first: null, last: null, team: null, position: null, rank: null });

const isPosition = (value) => POSITIONS.includes(value.toUpperCase());
const looksNumeric = (value) => /^\d+$/.test(value.trim());
const wordCount = (value) => value.trim().split(/\s+/).filter(Boolean).length;

/**
 * The role a heading names, matched on the whole heading rather than a word
 * inside it - `Last` is a surname and `Last Season` is not.
 *
 * Separators are flattened first so the three ways a real export writes the
 * same heading (`PLAYER NAME`, `Player_Name`, `player-name`) are one string.
 * An unrecognised heading is not a problem to solve here: `detectColumns`
 * falls back to the shape of the column beneath it.
 */
function headerRole(cell) {
    const normalized = cell.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    for (const [role, words] of Object.entries(HEADER_WORDS)) {
        if (words.includes(normalized)) return role;
    }
    return null;
}

/**
 * The roles a header row names, or null when the first row is not headings.
 *
 * A header row is one where at least two cells name a role and no cell holds a
 * player name - "Rank,Player,Team,Pos" rather than a first player.
 */
function fromHeader(row) {
    const roles = row.map(headerRole);
    if (roles.filter(Boolean).length < 2) return null;

    const mapping = emptyMapping();
    roles.forEach((role, index) => {
        if (role && mapping[role] === null) mapping[role] = index;
    });
    return mapping;
}

/**
 * Fills the roles still unknown from the shape of the data: a column that is
 * entirely positions is the position column, one that is entirely digits is
 * the rank, and the widest text column is the name.
 *
 * This runs for a headed table too, not just an unheaded one, and that is the
 * point of it. A heading this module has never seen - `PLAYER NAME` was the
 * one that shipped broken - used to leave `name` null, and a null name means
 * `rowToParsed` reads every row as "not a player": the whole file matched
 * nothing *and* reported no misses, because a row with no name never spends a
 * rank. A guess that can be corrected in the mapper beats no guess at all.
 */
function inferFromBody(mapping, body, width) {
    const rows = body.slice(0, 20);
    const taken = (index) => ROLES.some((role) => mapping[role] === index);
    const columnValues = (index) => rows.map((row) => row[index] ?? '').filter((value) => value.trim());

    for (let index = 0; index < width; index += 1) {
        if (taken(index)) continue;
        const values = columnValues(index);
        if (values.length === 0) continue;
        if (mapping.position === null && values.every(isPosition)) mapping.position = index;
        else if (mapping.rank === null && values.every(looksNumeric)) mapping.rank = index;
    }

    // The name is the only role worth guessing at once a header has spoken: a
    // heading that named the team named it correctly, whereas a column picked
    // by shape is picked from whatever the header left over, and `Bye` or
    // `Notes` are the wrong answer more often than they are the right one.
    if (mapping.name !== null || mapping.first !== null) return mapping;

    for (let index = 0; index < width; index += 1) {
        if (taken(index)) continue;
        const values = columnValues(index);
        if (values.length === 0) continue;
        // Two words on average is a full name; one short token is a team code.
        const multiWord = values.filter((value) => wordCount(value) > 1).length;
        if (mapping.name === null && multiWord >= values.length * 0.6) mapping.name = index;
        else if (mapping.team === null && values.every((value) => value.trim().length <= 4)) mapping.team = index;
    }

    // A list written as separate first and last name columns has no multi-word
    // column to find, so the two leftover text columns are the name, in order.
    if (mapping.name === null) {
        const leftover = [];
        for (let index = 0; index < width; index += 1) {
            if (!taken(index)) leftover.push(index);
        }
        if (leftover.length >= 2) {
            mapping.first = leftover[0];
            mapping.last = leftover[1];
        } else if (leftover.length === 1) {
            mapping.name = leftover[0];
        }
    }

    return mapping;
}

/**
 * Which column is which: read from a header row where the headings are ones
 * this module knows, and from the shape of the data for everything they leave
 * unanswered.
 *
 * Both, rather than one or the other. A header row used to end the guessing
 * outright, so a single unfamiliar heading in an otherwise obvious file left
 * that role null - and a null name column matches nothing at all.
 *
 * Every field is nullable and the guess is only a default - the user confirms
 * it before anything is matched, because a wrong guess here mislabels the
 * whole list rather than one line. `hasHeader` tells the caller whether to
 * drop the first row.
 */
export function detectColumns(rows) {
    if (!rows || rows.length === 0) return null;

    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const headed = fromHeader(rows[0]);
    const mapping = inferFromBody(headed ?? emptyMapping(), headed ? rows.slice(1) : rows, width);

    return { ...mapping, hasHeader: headed !== null, width };
}

/**
 * Whether a mapping names the one column without which nothing can be matched.
 *
 * Exported because two callers need the same answer: the mapper shows the name
 * select as unset rather than pointing at column one, and the paste sheet
 * refuses to run. Before this, a mapping with no name column ran happily and
 * produced an empty list with an empty miss list - the failure the user sees
 * as "it found none of my players".
 */
export const hasNameColumn = (mapping) =>
    Boolean(mapping) && ((mapping.name ?? null) !== null || (mapping.first ?? null) !== null);

// Generational suffixes are part of how a list writes a name and never part of
// how the player pool stores it, so they are dropped rather than matched on.
// `Marvin Harrison Jr.` otherwise takes `Jr` as the surname, which only found
// the right player by falling through to a first-name-and-fuzz match.
const SUFFIXES = ['JR', 'SR', 'II', 'III', 'IV', 'V'];

const nameTokens = (value) =>
    value
        .replace(/[^a-zA-Z\s.]/g, '')
        .split(/[\s.]+/)
        .map((token) => token.trim())
        .filter(Boolean);

const withoutSuffix = (tokens) => {
    const trimmed = [...tokens];
    while (trimmed.length > 1 && SUFFIXES.includes(trimmed[trimmed.length - 1].toUpperCase())) {
        trimmed.pop();
    }
    return trimmed;
};

/**
 * A full name as first and last.
 *
 * The last token rather than the second, which is what the flat-line parser is
 * stuck with: `Amon-Ra St. Brown` is `Amon-Ra` + `Brown`, not `Amon-Ra` + `St`.
 * Knowing the cell is nothing but a name is exactly what a column buys.
 *
 * A comma means the list is written surname-first - `Nacua, Puka` - which is
 * common enough in exports to be worth reading rather than guessing at. Taken
 * the other way round it matched an unrelated player rather than missing,
 * which is the worse failure: a wrong name in a rank list looks deliberate.
 */
export function splitName(value) {
    const [beforeComma, afterComma] = value.split(',');
    if (afterComma !== undefined && afterComma.trim()) {
        const last = withoutSuffix(nameTokens(beforeComma));
        const first = nameTokens(afterComma);
        if (last.length === 0 || first.length === 0) return null;
        return { first: first[0], last: last[last.length - 1] };
    }

    const tokens = withoutSuffix(nameTokens(value));
    if (tokens.length === 0) return null;
    if (tokens.length === 1) return { first: tokens[0], last: undefined };
    return { first: tokens[0], last: tokens[tokens.length - 1] };
}

/**
 * One mapped row as the fields the matcher wants, or null where the row
 * carries no name and is therefore not a player at all.
 *
 * Team and position are only accepted when they look like one, so a mapping
 * pointed at the wrong column degrades to a name-only match instead of
 * searching for a player on team `Notes`.
 */
export function rowToParsed(cells, mapping) {
    const cell = (index) => (index === null || index === undefined ? '' : (cells[index] ?? '').trim());

    let name = null;
    if (mapping.name !== null && mapping.name !== undefined) {
        name = splitName(cell(mapping.name));
    } else if (mapping.first !== null && mapping.first !== undefined) {
        const first = splitName(cell(mapping.first));
        const last = splitName(cell(mapping.last));
        // `splitName` reports a one-token cell as a first name, which is right
        // for a full-name column and wrong here - in a dedicated surname
        // column that lone token *is* the surname.
        name = first && { first: first.first, last: last ? (last.last ?? last.first) : undefined };
    }
    if (!name) return null;

    const rawTeam = cell(mapping.team)
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    const rawPosition = cell(mapping.position)
        .toUpperCase()
        .replace(/[^A-Z]/g, '');

    return {
        first: name.first,
        last: name.last,
        team: rawTeam.length >= 2 && rawTeam.length <= 6 ? rawTeam : null,
        position: isPosition(rawPosition) ? rawPosition : null,
    };
}
