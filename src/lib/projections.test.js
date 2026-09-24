import { describe, expect, it } from 'vitest';
import { ADP_CEILING, adpKey, adpValues, projectedPoints, projectionValues } from './projections.js';

describe('projectedPoints', () => {
    it("scores raw stats with the league's own settings, bonuses included", () => {
        const stats = { rec: 100, rec_yd: 1200, rec_td: 10, bonus_rec_te: 100, adp_ppr: 12 };
        // A TE-premium league: half a point more per tight-end catch.
        const settings = { rec: 1, rec_yd: 0.1, rec_td: 6, bonus_rec_te: 0.5, pass_td: 4 };

        expect(projectedPoints(stats, settings)).toBeCloseTo(100 + 120 + 60 + 50);
    });

    it('ignores settings the player has no stat for, and anything not a number', () => {
        expect(projectedPoints({ pass_td: 20, note: 'x' }, { pass_td: 4, rush_td: 6, note: 2 })).toBe(80);
        expect(projectedPoints(undefined, { pass_td: 4 })).toBe(0);
    });
});

describe('projectionValues', () => {
    it('keys points by string player id', () => {
        const rows = [
            { player_id: 4046, stats: { pass_td: 30 } },
            { player_id: '7564', stats: { rec: 100 } },
        ];
        expect(projectionValues(rows, { pass_td: 4, rec: 1 })).toEqual({ 4046: 120, 7564: 100 });
    });
});

describe('adpKey', () => {
    it.each([
        [{ superflex: true, ppr: 1 }, 'adp_2qb'],
        [{ superflex: false, ppr: 1 }, 'adp_ppr'],
        [{ superflex: false, ppr: 0.5 }, 'adp_half_ppr'],
        [{ superflex: false, ppr: 0 }, 'adp_std'],
        [{ superflex: false }, 'adp_ppr'],
    ])('%o reads %s', (format, key) => {
        expect(adpKey(format)).toBe(key);
    });
});

describe('adpValues', () => {
    it("turns the league's ADP column into bigger-is-better, and skips Sleeper's 999", () => {
        const rows = [
            { player_id: 'a', stats: { adp_2qb: 1.5, adp_ppr: 20 } },
            { player_id: 'b', stats: { adp_2qb: 999 } },
            { player_id: 'c', stats: { adp_2qb: 450 } },
        ];

        expect(adpValues(rows, { superflex: true })).toEqual({ a: ADP_CEILING - 1.5, c: 0 });
    });
});
