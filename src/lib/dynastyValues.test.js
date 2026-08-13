import { describe, expect, it } from 'vitest';
import { asOfMillis, pickValue, usesSuperflexValues, valuesByPlayerId } from './dynastyValues.js';

describe('usesSuperflexValues', () => {
    it('is superflex for any league that can start a second quarterback', () => {
        expect(usesSuperflexValues({ numQbs: 2 })).toBe(true);
        expect(usesSuperflexValues({ numQbs: 3 })).toBe(true);
    });

    it('is 1QB only for a genuine single-quarterback league', () => {
        expect(usesSuperflexValues({ numQbs: 1 })).toBe(false);
    });

    it('reads a true two-QB league as superflex despite having no superflex slot', () => {
        // The distinction that matters: `leagueMarketSettings` sums slot kinds,
        // so a 2-QB league arrives as numQbs 2 with superflex false. Keying off
        // a SUPER_FLEX slot instead would price it off the 1QB list, which is a
        // list about a different game.
        expect(usesSuperflexValues({ numQbs: 2, superflex: false })).toBe(true);
    });

    it('defaults to superflex when the league shape is unknown', () => {
        expect(usesSuperflexValues(null)).toBe(true);
        expect(usesSuperflexValues({})).toBe(true);
    });
});

describe('valuesByPlayerId', () => {
    const response = {
        values: [
            { playerId: '4984', value: 6000, changePct: 5.2 },
            { playerId: '9509', value: 9999, changePct: null },
        ],
    };

    it('keys by the string id playerInfo uses', () => {
        const byId = valuesByPlayerId(response);
        expect(byId['4984'].value).toBe(6000);
        expect(byId['9509'].changePct).toBeNull();
    });

    it('coerces a numeric id to a string rather than keying by number', () => {
        // A map keyed by number and read by string misses every row silently.
        const byId = valuesByPlayerId({ values: [{ playerId: 4984, value: 1 }] });
        expect(byId['4984']).toBeDefined();
    });

    it('is an empty object, not null, on a failed or empty fetch', () => {
        // Callers look up unconditionally; values are additive decoration.
        expect(valuesByPlayerId(undefined)).toEqual({});
        expect(valuesByPlayerId({})).toEqual({});
        expect(valuesByPlayerId({ values: null })).toEqual({});
    });
});

describe('asOfMillis', () => {
    it('converts the ISO string the API sends into epoch millis', () => {
        // Handing agoLabel the raw string renders "NaNd ago" — that shipped
        // once and only a browser caught it.
        expect(asOfMillis({ asOf: '2026-08-13T00:33:00Z' })).toBe(Date.parse('2026-08-13T00:33:00Z'));
    });

    it('is null when absent or unparseable', () => {
        expect(asOfMillis({})).toBeNull();
        expect(asOfMillis({ asOf: 'soon' })).toBeNull();
        expect(asOfMillis(undefined)).toBeNull();
    });
});

describe('pickValue', () => {
    const response = {
        picks: [
            { season: 2027, round: 1, tier: 'mid', value: 5507 },
            { season: 2027, round: 1, tier: 'early', value: 7071 },
            { season: 2026, round: 2, tier: 'mid', value: 3000 },
        ],
    };

    it('defaults to the mid tier, since a Sleeper pick carries none', () => {
        expect(pickValue(response, { season: 2027, round: 1 }).value).toBe(5507);
    });

    it('takes an explicit tier when the caller knows better', () => {
        expect(pickValue(response, { season: 2027, round: 1, tier: 'early' }).value).toBe(7071);
    });

    it('accepts season and round as strings, which is how Sleeper sends them', () => {
        expect(pickValue(response, { season: '2027', round: '1' }).value).toBe(5507);
    });

    it('is null for a pick nobody prices, rather than falling back to a nearby one', () => {
        // A 2029 pick must read as unpriced, not as a 2028 one.
        expect(pickValue(response, { season: 2029, round: 1 })).toBeNull();
        expect(pickValue(response, { season: 2027, round: 9 })).toBeNull();
    });

    it('is null when the response carries no picks at all', () => {
        expect(pickValue({}, { season: 2027, round: 1 })).toBeNull();
        expect(pickValue(response, {})).toBeNull();
    });
});
