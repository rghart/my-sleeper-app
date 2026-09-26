import { describe, expect, it } from 'vitest';
import { valueWarning } from './valueStatus.js';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const source = (name, asOf, stale) => ({ name, asOf, maxAgeHours: 3, stale });

describe('valueWarning', () => {
    it('says nothing when every source is fresh and every pick was read', () => {
        expect(
            valueWarning(
                {
                    sources: [source('KeepTradeCut', '2026-09-26T11:15:00Z', false)],
                    unrecognizedPicks: { count: 0, examples: [] },
                },
                NOW,
            ),
        ).toBeNull();
        // A status that could not be fetched is not a reason to warn.
        expect(valueWarning(undefined, NOW)).toBeNull();
    });

    it('names a stale source, how long ago it last updated, and on which day', () => {
        expect(valueWarning({ sources: [source('KeepTradeCut', '2026-09-08T05:15:01Z', true)] }, NOW)).toBe(
            "KeepTradeCut values haven't updated in 18 days (last on Sep 8). Power rankings, Movers and trade values may be out of date.",
        );
        expect(valueWarning({ sources: [source('FantasyCalc', '2026-09-25T02:00:00Z', true)] }, NOW)).toMatch(
            /^FantasyCalc values haven't updated in 34 hours \(last on Sep 25\)\./,
        );
    });

    it('covers a source with nothing stored, and unreadable picks, in one message', () => {
        expect(
            valueWarning(
                {
                    sources: [source('KeepTradeCut', null, true), source('FantasyCalc', '2026-09-26T08:30:00Z', false)],
                    unrecognizedPicks: { count: 12, examples: ['2027 1.04'] },
                },
                NOW,
            ),
        ).toBe(
            "No KeepTradeCut values are available. KeepTradeCut lists 12 draft picks the app can't read yet (for example “2027 1.04”), so their values are missing. Power rankings, Movers and trade values may be out of date.",
        );
    });
});
