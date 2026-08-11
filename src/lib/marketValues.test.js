import { describe, expect, it } from 'vitest';
import { asOfMillis, settingsLabel, toRankList } from './marketValues.js';

const playerInfo = {
    1: { player_id: '1', full_name: 'Josh Allen', position: 'QB', team: 'BUF' },
    2: { player_id: '2', full_name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
    3: { player_id: '3', full_name: "Ja'Marr Chase", position: 'WR', team: 'CIN' },
};

const value = (playerId, overallRank) => ({ playerId, overallRank, positionRank: 1, value: 1000 - overallRank });

describe('toRankList', () => {
    it('keeps the order the market ranks them in', () => {
        const list = toRankList([value('2', 1), value('3', 2), value('1', 3)], playerInfo);
        expect(list.map((entry) => entry.match_results[0][0])).toEqual(['2', '3', '1']);
    });

    it('numbers from one', () => {
        const list = toRankList([value('1', 1), value('2', 2)], playerInfo);
        expect(list.map((entry) => entry.ranking)).toEqual([1, 2]);
    });

    // Nothing here was matched, so nothing can be a low-confidence match -
    // above 0 outlines the row in warning colour.
    it('scores every entry as certain', () => {
        expect(toRankList([value('1', 1)], playerInfo)[0].match_results[0][1]).toBe('0.000');
    });

    it('labels each entry with the player it means', () => {
        expect(toRankList([value('1', 1)], playerInfo)[0].search_string).toBe('Josh Allen');
    });

    // The pool and the values are refreshed by different nightly jobs, so one
    // can carry a player the other does not yet.
    it('drops a player the pool has never heard of', () => {
        const list = toRankList([value('1', 1), value('999', 2), value('2', 3)], playerInfo);
        expect(list.map((entry) => entry.match_results[0][0])).toEqual(['1', '2']);
    });

    // The rank is the position in the list, not the market's own number. A
    // list numbered 1, 2, 4 shows a gap the user cannot act on and did not
    // create.
    it('closes the gap a dropped player would leave in the numbering', () => {
        const list = toRankList([value('1', 1), value('999', 2), value('2', 3)], playerInfo);
        expect(list.map((entry) => entry.ranking)).toEqual([1, 2]);
    });

    it.each([
        ['an empty list', []],
        ['no list at all', undefined],
        ['a null list', null],
    ])('returns nothing for %s', (_label, values) => {
        expect(toRankList(values, playerInfo)).toEqual([]);
    });

    it('returns nothing when the player pool has not loaded', () => {
        expect(toRankList([value('1', 1)], undefined)).toEqual([]);
    });
});

describe('settingsLabel', () => {
    it('reads the settings back as a sentence', () => {
        expect(settingsLabel({ format: 'dynasty', numQbs: 2, numTeams: 12, ppr: 1 })).toBe(
            'Dynasty · superflex · 12-team · PPR',
        );
    });

    it('names a single-QB format rather than calling it superflex', () => {
        expect(settingsLabel({ format: 'dynasty', numQbs: 1, numTeams: 10, ppr: 0.5 })).toBe(
            'Dynasty · 1QB · 10-team · half-PPR',
        );
    });

    it('has nothing to say without settings', () => {
        expect(settingsLabel(null)).toBeNull();
    });
});

describe('asOfMillis', () => {
    // `agoLabel` subtracts from Date.now(), so an ISO string handed over raw
    // renders "NaNd ago" - which it did, and which only showed up in a browser.
    it('converts the API timestamp to epoch milliseconds', () => {
        expect(asOfMillis('2026-08-11T08:30:02Z')).toBe(Date.parse('2026-08-11T08:30:02Z'));
    });

    it.each([
        ['nothing', null],
        ['an empty string', ''],
        ['a value that is not a date', 'whenever'],
    ])('has nothing to report for %s', (_label, asOf) => {
        expect(asOfMillis(asOf)).toBeNull();
    });
});
