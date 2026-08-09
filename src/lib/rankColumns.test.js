import { describe, expect, it } from 'vitest';
import { detectColumns, detectDelimiter, rowToParsed, splitName, toRows } from './rankColumns.js';

const csv = `Rank,Player,Team,Pos
1,Ja'Marr Chase,CIN,WR
2,Bijan Robinson,ATL,RB
3,Puka Nacua,LAR,WR`;

const tsv = `1\tJa'Marr Chase\tCIN\tWR
2\tBijan Robinson\tATL\tRB
3\tPuka Nacua\tLAR\tWR`;

describe('detectDelimiter', () => {
    it('finds the comma in a CSV', () => {
        expect(detectDelimiter(csv)).toBe(',');
    });

    it('finds the tab in a spreadsheet paste', () => {
        expect(detectDelimiter(tsv)).toBe('\t');
    });

    // The existing paste box gets this text today, and the flat-line parser
    // has to guess at every field in it.
    it('prefers the tab when a spreadsheet paste also contains commas', () => {
        expect(detectDelimiter("1\tChase, Ja'Marr\tCIN\n2\tRobinson, Bijan\tATL")).toBe('\t');
    });

    it('returns null for a plain one-per-line list', () => {
        expect(detectDelimiter("Ja'Marr Chase\nBijan Robinson\nPuka Nacua")).toBeNull();
    });

    // Commas that are punctuation rather than structure. Treating this as a
    // table would split every name in half.
    it('returns null when only some lines contain a comma', () => {
        expect(detectDelimiter("Ja'Marr Chase\nSmith Jr., WR\nPuka Nacua\nBijan Robinson")).toBeNull();
    });

    it('returns null for empty text', () => {
        expect(detectDelimiter('')).toBeNull();
    });
});

describe('toRows', () => {
    it('returns a grid for delimited text', () => {
        expect(toRows(csv)[1]).toEqual(['1', "Ja'Marr Chase", 'CIN', 'WR']);
    });

    it('returns null for undelimited text', () => {
        expect(toRows("Ja'Marr Chase\nBijan Robinson")).toBeNull();
    });

    it('skips blank lines', () => {
        expect(toRows('1,Chase,CIN\n\n\n2,Nacua,LAR')).toHaveLength(2);
    });

    // A surname-first export is the case that makes quoting non-optional: read
    // naively this is four columns and the map points at the wrong ones.
    it('keeps a quoted field containing the delimiter in one cell', () => {
        expect(toRows('1,"Chase, Ja\'Marr",CIN,WR', ',')[0]).toEqual(['1', "Chase, Ja'Marr", 'CIN', 'WR']);
    });

    it('reads a doubled quote inside a quoted field as one quote', () => {
        expect(toRows('1,"He said ""hi""",CIN', ',')[0][1]).toBe('He said "hi"');
    });
});

describe('detectColumns', () => {
    it('reads a header row', () => {
        expect(detectColumns(toRows(csv))).toMatchObject({
            hasHeader: true,
            rank: 0,
            name: 1,
            team: 2,
            position: 3,
        });
    });

    it('recognises the abbreviations a header actually uses', () => {
        const rows = toRows("Rk,Name,Tm,Posn\n1,Ja'Marr Chase,CIN,WR");
        expect(detectColumns(rows)).toMatchObject({ hasHeader: true, rank: 0, name: 1, team: 2, position: 3 });
    });

    it('guesses from the data when there is no header', () => {
        expect(detectColumns(toRows(tsv))).toMatchObject({
            hasHeader: false,
            rank: 0,
            name: 1,
            team: 2,
            position: 3,
        });
    });

    it('finds separate first and last name columns', () => {
        const rows = toRows("First,Last,Team,Pos\nJa'Marr,Chase,CIN,WR");
        expect(detectColumns(rows)).toMatchObject({ hasHeader: true, first: 0, last: 1 });
    });

    // A single player row must not be mistaken for headings.
    it('does not read a data row as a header', () => {
        expect(detectColumns(toRows("1,Ja'Marr Chase,CIN,WR\n2,Bijan Robinson,ATL,RB")).hasHeader).toBe(false);
    });

    it('returns null for no rows', () => {
        expect(detectColumns([])).toBeNull();
    });
});

describe('splitName', () => {
    it('splits a two-part name', () => {
        expect(splitName("Ja'Marr Chase")).toEqual({ first: 'JaMarr', last: 'Chase' });
    });

    // The payoff for knowing the cell is only a name: the flat-line parser
    // takes the *second* token as the surname and gets `St` here.
    it('takes the last token of a three-part name as the surname', () => {
        expect(splitName('Amon-Ra St. Brown')).toEqual({ first: 'AmonRa', last: 'Brown' });
    });

    it('leaves a single token without a surname', () => {
        expect(splitName('Nacua')).toEqual({ first: 'Nacua', last: undefined });
    });

    // Read the other way round this matched a different player outright, which
    // is worse than missing - a wrong name in a rank list looks deliberate.
    it('reads a surname-first cell', () => {
        expect(splitName('Nacua, Puka')).toEqual({ first: 'Puka', last: 'Nacua' });
    });

    it('reads a surname-first cell with a middle name', () => {
        expect(splitName('St. Brown, Amon-Ra')).toEqual({ first: 'AmonRa', last: 'Brown' });
    });

    // The pool stores him as `Marvin Harrison`. Kept as the surname, `Jr` found
    // the right player only by falling through to a fuzzy first-name match.
    it.each([
        ['Marvin Harrison Jr.', 'Harrison'],
        ['Odell Beckham Jr', 'Beckham'],
        ['Michael Pittman Sr.', 'Pittman'],
        ['Patrick Mahomes II', 'Mahomes'],
    ])('drops the generational suffix in %s', (value, expected) => {
        expect(splitName(value).last).toBe(expected);
    });

    it('drops a suffix in a surname-first cell too', () => {
        expect(splitName('Harrison Jr., Marvin')).toEqual({ first: 'Marvin', last: 'Harrison' });
    });

    // A one-word name that is itself a suffix must survive - dropping it would
    // leave nothing to match on.
    it('keeps a lone token even when it looks like a suffix', () => {
        expect(splitName('V')).toEqual({ first: 'V', last: undefined });
    });

    it('returns null for an empty cell', () => {
        expect(splitName('   ')).toBeNull();
    });
});

describe('rowToParsed', () => {
    const mapping = { rank: 0, name: 1, team: 2, position: 3, first: null, last: null };

    it('reads a mapped row without guessing', () => {
        expect(rowToParsed(['1', "Ja'Marr Chase", 'CIN', 'WR'], mapping)).toEqual({
            first: 'JaMarr',
            last: 'Chase',
            team: 'CIN',
            position: 'WR',
        });
    });

    it('joins separate first and last columns', () => {
        const split = { rank: null, name: null, first: 0, last: 1, team: 2, position: 3 };
        expect(rowToParsed(["Ja'Marr", 'Chase', 'CIN', 'WR'], split)).toMatchObject({
            first: 'JaMarr',
            last: 'Chase',
        });
    });

    it('returns null for a row with no name', () => {
        expect(rowToParsed(['1', '', 'CIN', 'WR'], mapping)).toBeNull();
    });

    // A mapping aimed at the wrong column should cost the row its team, not
    // send the matcher looking for a player on team "Notes".
    it('ignores a position column that does not hold a position', () => {
        expect(rowToParsed(['1', "Ja'Marr Chase", 'CIN', 'sleeper pick'], mapping).position).toBeNull();
    });

    it('ignores a team column that cannot be a team code', () => {
        expect(rowToParsed(['1', "Ja'Marr Chase", 'high upside guy', 'WR'], mapping).team).toBeNull();
    });

    it('tolerates a row shorter than the mapping', () => {
        expect(rowToParsed(['1', "Ja'Marr Chase"], mapping)).toMatchObject({ team: null, position: null });
    });

    it('normalises a lowercase team and position', () => {
        expect(rowToParsed(['1', "Ja'Marr Chase", 'cin', 'wr'], mapping)).toMatchObject({
            team: 'CIN',
            position: 'WR',
        });
    });
});
