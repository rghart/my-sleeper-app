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
    name: ['player', 'name', 'players'],
    first: ['first', 'firstname', 'first name'],
    last: ['last', 'lastname', 'last name', 'surname'],
    team: ['team', 'tm', 'nfl', 'club'],
    position: ['pos', 'position', 'posn'],
    rank: ['rank', 'rk', '#', 'no', 'ovr', 'overall'],
};

const isPosition = (value) => POSITIONS.includes(value.toUpperCase());
const looksNumeric = (value) => /^\d+$/.test(value.trim());
const wordCount = (value) => value.trim().split(/\s+/).filter(Boolean).length;

function headerRole(cell) {
    const normalized = cell.trim().toLowerCase();
    for (const [role, words] of Object.entries(HEADER_WORDS)) {
        if (words.includes(normalized)) return role;
    }
    return null;
}

/**
 * Which column is which, guessed from a header row when there is one and from
 * the shape of the data when there is not.
 *
 * Every field is nullable and the guess is only a default - the user confirms
 * it before anything is matched, because a wrong guess here mislabels the
 * whole list rather than one line. `hasHeader` tells the caller whether to
 * drop the first row.
 */
export function detectColumns(rows) {
    if (!rows || rows.length === 0) return null;

    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const mapping = { name: null, first: null, last: null, team: null, position: null, rank: null };

    // A header row is one where at least two cells name a role and no cell
    // holds a player name - "Rank,Player,Team,Pos" rather than a first player.
    const roles = rows[0].map(headerRole);
    const hasHeader = roles.filter(Boolean).length >= 2;

    if (hasHeader) {
        roles.forEach((role, index) => {
            if (role && mapping[role] === null) mapping[role] = index;
        });
        return { ...mapping, hasHeader, width };
    }

    // No header: read the body. A column that is entirely positions is the
    // position column, one that is entirely digits is the rank, and the
    // widest text column is the name.
    const body = rows.slice(0, 20);
    const columnValues = (index) => body.map((row) => row[index] ?? '').filter((value) => value.trim());

    for (let index = 0; index < width; index += 1) {
        const values = columnValues(index);
        if (values.length === 0) continue;
        if (mapping.position === null && values.every(isPosition)) mapping.position = index;
        else if (mapping.rank === null && values.every(looksNumeric)) mapping.rank = index;
    }

    for (let index = 0; index < width; index += 1) {
        if (index === mapping.position || index === mapping.rank) continue;
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
            if (index !== mapping.position && index !== mapping.rank && index !== mapping.team) leftover.push(index);
        }
        if (leftover.length >= 2) {
            mapping.first = leftover[0];
            mapping.last = leftover[1];
        } else if (leftover.length === 1) {
            mapping.name = leftover[0];
        }
    }

    return { ...mapping, hasHeader, width };
}

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
