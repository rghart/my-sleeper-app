import { describe, expect, it } from 'vitest';
import { asOfMillis, leagueMarketSettings, settingsLabel, toRankList } from './marketValues.js';

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
            'Dynasty · 2QB · 12-team · PPR',
        );
    });

    // Superflex and two-QB are different leagues that price alike, so the
    // response carries a count of 2 for both. Calling every 2 "superflex" told
    // anyone in a two-QB league their list was priced for a format they are
    // not in.
    it('names superflex only when the league actually has a superflex slot', () => {
        const response = { format: 'dynasty', numQbs: 2, numTeams: 12, ppr: 1 };

        expect(settingsLabel(response, { superflex: true })).toBe('Dynasty · superflex · 12-team · PPR');
        expect(settingsLabel(response, { superflex: false })).toBe('Dynasty · 2QB · 12-team · PPR');
    });

    // With only the response to hand, the count is a claim about what the
    // values are priced on rather than about a league nobody has described.
    it('falls back to the count when the league is unknown', () => {
        expect(settingsLabel({ format: 'dynasty', numQbs: 2, numTeams: 12, ppr: 1 }, null)).toContain('2QB');
    });

    it('names a single-QB format rather than calling it superflex', () => {
        expect(settingsLabel({ format: 'dynasty', numQbs: 1, numTeams: 10, ppr: 0.5 })).toBe(
            'Dynasty · 1QB · 10-team · half-PPR',
        );
    });

    it('names a redraft league redraft', () => {
        expect(settingsLabel({ format: 'redraft', numQbs: 1, numTeams: 12, ppr: 1 })).toContain('redraft');
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

// Reading the league shape off Sleeper's own league object. Getting this wrong
// is not a rounding error - asking the market about superflex when the league
// is single-QB returns a list whose best player plays a different position.
describe('leagueMarketSettings', () => {
    const league = (overrides = {}) => ({
        total_rosters: 12,
        settings: { type: 2 },
        roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN'],
        scoring_settings: { rec: 1 },
        ...overrides,
    });

    it('reads a superflex dynasty league', () => {
        expect(leagueMarketSettings(league())).toEqual({
            dynasty: true,
            numTeams: 12,
            numQbs: 2,
            superflex: true,
            ppr: 1,
        });
    });

    // A SUPER_FLEX slot is what makes a league two-QB, and it is by far the
    // common way to build one.
    it('counts a SUPER_FLEX slot as a second quarterback', () => {
        expect(leagueMarketSettings(league()).numQbs).toBe(2);
    });

    it('reads a single-QB league as one', () => {
        const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN'];
        expect(leagueMarketSettings(league({ roster_positions: positions })).numQbs).toBe(1);
    });

    // A different league, not the same one built differently: two QB slots
    // force a second starter, a superflex slot only permits one. They price
    // alike, which is why the provider takes one number for both.
    it('counts two literal QB slots as two quarterbacks', () => {
        const positions = ['QB', 'QB', 'RB', 'WR', 'TE', 'BN'];
        const settings = leagueMarketSettings(league({ roster_positions: positions }));

        expect(settings.numQbs).toBe(2);
        expect(settings.superflex).toBe(false);
    });

    // The count is how many quarterbacks a lineup can hold, so the two slot
    // kinds add. The previous reading stopped at the superflex and said two.
    it('adds a superflex on top of the QB slots', () => {
        const positions = ['QB', 'QB', 'SUPER_FLEX', 'RB', 'WR', 'BN'];
        expect(leagueMarketSettings(league({ roster_positions: positions })).numQbs).toBe(3);
    });

    it('reports a single-QB league as neither superflex nor two-QB', () => {
        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'BN'];
        const settings = leagueMarketSettings(league({ roster_positions: positions }));

        expect(settings.numQbs).toBe(1);
        expect(settings.superflex).toBe(false);
    });

    // Sleeper's own encoding: 0 redraft, 1 keeper, 2 dynasty. A keeper league
    // prices closer to redraft than to dynasty.
    it.each([
        [0, false],
        [1, false],
        [2, true],
    ])('reads settings.type %i as dynasty=%s', (type, dynasty) => {
        expect(leagueMarketSettings(league({ settings: { type } })).dynasty).toBe(dynasty);
    });

    // Standard scoring is a real answer, not a missing one.
    it('keeps a zero PPR rather than treating it as absent', () => {
        expect(leagueMarketSettings(league({ scoring_settings: { rec: 0 } })).ppr).toBe(0);
    });

    it('reads half PPR', () => {
        expect(leagueMarketSettings(league({ scoring_settings: { rec: 0.5 } })).ppr).toBe(0.5);
    });

    // The API falls back field by field, so a league missing one field should
    // cost that field and nothing else.
    it('omits only the field the league cannot answer', () => {
        const settings = leagueMarketSettings(league({ scoring_settings: undefined }));
        expect(settings).not.toHaveProperty('ppr');
        expect(settings).toMatchObject({ dynasty: true, numTeams: 12, numQbs: 2 });
    });

    it.each([
        ['no league', undefined],
        ['a null league', null],
        ['a league with nothing readable', {}],
    ])('has nothing to say for %s', (_label, value) => {
        expect(leagueMarketSettings(value)).toBeNull();
    });
});
