import { describe, expect, it } from 'vitest';
import { describeParsed, parseRankLine, readTierMarker } from './rankParse.js';

describe('parseRankLine', () => {
    it('reads a bare first and last name', () => {
        expect(parseRankLine('Bijan Robinson')).toEqual({
            first: 'Bijan',
            last: 'Robinson',
            team: null,
            position: null,
        });
    });

    it('strips a leading rank number and its period', () => {
        expect(parseRankLine('1. Bijan Robinson')).toMatchObject({ first: 'Bijan', last: 'Robinson' });
        expect(parseRankLine('12 Bijan Robinson')).toMatchObject({ first: 'Bijan', last: 'Robinson' });
    });

    it('picks up a team and a position', () => {
        expect(parseRankLine('1. Bijan Robinson ATL RB')).toEqual({
            first: 'Bijan',
            last: 'Robinson',
            team: 'ATL',
            position: 'RB',
        });
    });

    // The bug the positional `searchArray` hid: a line with a position and no
    // recognisable team put the position where the team belonged, and left the
    // position undefined. Named fields cannot express that.
    it('keeps a position in the position field when there is no team', () => {
        expect(parseRankLine('Bijan Robinson RB')).toEqual({
            first: 'Bijan',
            last: 'Robinson',
            team: null,
            position: 'RB',
        });
    });

    it('keeps a team in the team field when there is no position', () => {
        expect(parseRankLine('Bijan Robinson ATL')).toEqual({
            first: 'Bijan',
            last: 'Robinson',
            team: 'ATL',
            position: null,
        });
    });

    it('expands an initial-and-surname pair written with a period', () => {
        expect(parseRankLine('T.Brady')).toMatchObject({ first: 'T', last: 'Brady' });
    });

    // Both initials rules read fixed offsets, so a rank number's leftover
    // punctuation used to shift the name out from under them: `20. T.Brady`
    // parsed as the single token `TBrady`, which then crashed the whole paste
    // (see the no-surname test below).
    it.each([
        ['20. T.Brady', 'a period and a space'],
        ['20) T.Brady', 'a bracket'],
        ['20 - T.Brady', 'a dash'],
        ['20\tT.Brady', 'a tab'],
    ])('expands initials in %s, written after %s', (line) => {
        expect(parseRankLine(line)).toMatchObject({ first: 'T', last: 'Brady' });
    });

    it('still finds the team and position on a line with expanded initials', () => {
        expect(parseRankLine('20. T.Brady TB QB')).toEqual({
            first: 'T',
            last: 'Brady',
            team: 'TB',
            position: 'QB',
        });
    });

    // The old code hunted for the team across every token including the name,
    // so a line whose *surname* had been mangled into a team code lost it -
    // `TBrady TB QB` came back with one token and no last name at all.
    it('never strips a team code out of the first two tokens', () => {
        expect(parseRankLine('Josh Allen BUF')).toMatchObject({ first: 'Josh', last: 'Allen', team: 'BUF' });
        expect(parseRankLine('TBrady TB QB')).toMatchObject({ first: 'TBrady', last: 'TB' });
    });

    it('returns a first name but no surname for a single-token line', () => {
        // Not null - the line named something. The matcher turns a missing
        // surname into a miss; the old code fed `undefined` to Fuse, which
        // threw and took the entire paste down with it.
        expect(parseRankLine('Nacua')).toMatchObject({ first: 'Nacua', last: undefined });
    });

    // The counterpart case: a first name that genuinely is two initials must
    // survive as one token rather than being split at the first period.
    it('keeps a two-initial first name together', () => {
        expect(parseRankLine('J.K. Dobbins')).toMatchObject({ first: 'JK', last: 'Dobbins' });
    });

    it('separates two-initial names written without a space', () => {
        expect(parseRankLine('J.K.Dobbins')).toMatchObject({ first: 'JK', last: 'Dobbins' });
    });

    it('drops the apostrophe in a name that has one', () => {
        expect(parseRankLine("Ja'Marr Chase")).toMatchObject({ first: 'JaMarr', last: 'Chase' });
    });

    // Both spellings are in circulation for these two clubs, and a list uses
    // whichever its source used.
    it.each([
        ['LA', 'LA'],
        ['LAR', 'LAR'],
        ['JAX', 'JAX'],
        ['JAC', 'JAC'],
    ])('recognises %s as a team', (abbreviation, expected) => {
        expect(parseRankLine(`Puka Nacua ${abbreviation}`)).toMatchObject({ team: expected });
    });

    it('recognises the non-club markers a ranking export uses', () => {
        expect(parseRankLine('Some Guy FA')).toMatchObject({ team: 'FA' });
        expect(parseRankLine('Some Guy ROOKIE')).toMatchObject({ team: 'ROOKIE' });
    });

    // Team detection is exact despite going through a fuzzy index. `Bell` is
    // one edit from `BAL`, and a surname eaten as a team is unrecoverable.
    it('does not mistake a surname for the team it nearly spells', () => {
        expect(parseRankLine('Kenneth Bell WR')).toMatchObject({ last: 'Bell', team: null });
    });

    it('never reads the first two tokens as a team or position', () => {
        // `Ken` and `Metcalf` are the name, however much they look like codes.
        expect(parseRankLine('DK Metcalf')).toEqual({ first: 'DK', last: 'Metcalf', team: null, position: null });
    });

    it.each([
        ['an empty line', ''],
        ['whitespace', '   '],
        ['a bare rank number', '17'],
        ['a rank number and punctuation', '17.'],
    ])('returns null for %s', (_label, line) => {
        expect(parseRankLine(line)).toBeNull();
    });

    it('tolerates a tab-separated line, as a spreadsheet paste produces', () => {
        expect(parseRankLine('1\tBijan Robinson\tATL\tRB')).toEqual({
            first: 'Bijan',
            last: 'Robinson',
            team: 'ATL',
            position: 'RB',
        });
    });
});

describe('describeParsed', () => {
    it('reads back every field the line supplied', () => {
        expect(describeParsed({ first: 'Bijan', last: 'Robinson', team: 'ATL', position: 'RB' })).toBe(
            'Bijan Robinson ATL RB',
        );
    });

    // The miss list is built from this, and it used to interpolate the missing
    // pieces raw - so a two-word name that matched nothing was reported to the
    // user as "Couldn't find Bijan Robinson undefined  undefined Rank: 1".
    it('omits the fields the line did not carry, rather than printing undefined', () => {
        expect(describeParsed({ first: 'Bijan', last: 'Robinson', team: null, position: null })).toBe('Bijan Robinson');
    });
});

describe('readTierMarker', () => {
    it.each([
        ['Tier 1', 1, 'Tier 1'],
        ['TIER 3:', 3, 'Tier 3'],
        ['tier 2', 2, 'Tier 2'],
        ['--- Tier 4 ---', 4, 'Tier 4'],
        ['** Tier 5 **', 5, 'Tier 5'],
        ['Tier #6', 6, 'Tier 6'],
    ])('reads %s', (line, number, label) => {
        expect(readTierMarker(line)).toEqual({ number, label });
    });

    it.each([
        ['Tier 2 - Elite', 'Tier 2 \u00b7 Elite'],
        ['Tier 1: Studs', 'Tier 1 \u00b7 Studs'],
        ['Tier 7 Dart throws', 'Tier 7 \u00b7 Dart throws'],
    ])('keeps the descriptor in %s', (line, label) => {
        expect(readTierMarker(line).label).toBe(label);
    });

    // The word and the number are both required. Ranking lists are full of
    // `RB1`-shaped labels, and reading one of those as a heading would cost a
    // real player rather than a heading.
    it.each([
        ['a bare abbreviation', 'T3'],
        ['a positional label', 'RB1'],
        ['the word with no number', 'Tier'],
        ['a name that starts with the word', 'Tiernan Smith'],
        ['a player line', "1. Ja'Marr Chase CIN WR"],
        ['an empty line', ''],
    ])('does not read %s as a tier', (_label, line) => {
        expect(readTierMarker(line)).toBeNull();
    });
});
