import { describe, expect, it } from 'vitest';
import {
    faabFailedText,
    faabHeadline,
    faabRangeText,
    faabSample,
    faabSampleText,
    faabWindowText,
    pct,
    pricesByPlayerId,
} from './faab.js';

const entry = (attrs) => ({ median: 10, low: 0, high: 40, claims: 8, leagues: 7, failed: 0, ...attrs });

describe('faabSample', () => {
    it('says nothing at all when nobody has claimed him', () => {
        expect(faabSample(undefined).kind).toBe('none');
        expect(faabSample({ claims: 0 }).kind).toBe('none');
    });

    // The same call `managerSample` makes for a single pick: one observation
    // is not an average and must not be dressed as one.
    it('treats a single claim as a price paid, not a median', () => {
        const sample = faabSample(entry({ claims: 1, leagues: 1 }));
        expect(sample.kind).toBe('single');
        expect(faabHeadline(sample)).toBe('Went for 10% of budget, once');
    });

    it('names a number below the threshold without calling it typical', () => {
        const sample = faabSample(entry({ claims: 3 }));
        expect(sample.kind).toBe('thin');
        expect(faabHeadline(sample)).toBe('Went for 10% of budget');
    });

    it('only calls a price typical once the sample supports it', () => {
        expect(faabHeadline(faabSample(entry({ claims: 5 })))).toBe('Typically 10% of budget');
    });
});

describe('the denominator', () => {
    // Ten claims in one league is a much weaker read than ten across ten, and
    // only the pair says which one you have.
    it('always names both claims and leagues', () => {
        expect(faabSampleText(faabSample(entry({ claims: 8, leagues: 7 })))).toBe('8 claims in 7 leagues');
    });

    it('is singular when it should be', () => {
        expect(faabSampleText(faabSample(entry({ claims: 1, leagues: 1 })))).toBe('1 claim in 1 league');
    });
});

describe('faabRangeText', () => {
    it('shows the spread, which is usually the story', () => {
        expect(faabRangeText(faabSample(entry({ low: 0, high: 100 })))).toBe('0% to 100%');
    });

    // "0% to 0%" reads as a measurement rather than as the one price it is.
    it('is silent when low and high agree', () => {
        expect(faabRangeText(faabSample(entry({ low: 12, high: 12 })))).toBeNull();
    });

    it('is silent for a single claim, which has no spread', () => {
        expect(faabRangeText(faabSample(entry({ claims: 1 })))).toBeNull();
    });
});

describe('faabFailedText', () => {
    // Sleeper does not say why a claim failed, so this must never be called
    // losing bids.
    it('counts them without naming a cause', () => {
        expect(faabFailedText(faabSample(entry({ failed: 13 })))).toBe('13 more claims did not go through');
    });

    it('is silent when none failed', () => {
        expect(faabFailedText(faabSample(entry({ failed: 0 })))).toBeNull();
    });
});

describe('pct', () => {
    it('drops a pointless decimal but keeps a real one', () => {
        expect(pct(12)).toBe('12%');
        expect(pct(12.5)).toBe('12.5%');
        expect(pct(0)).toBe('0%');
    });

    it('passes null through rather than printing NaN', () => {
        expect(pct(null)).toBeNull();
    });
});

describe('faabWindowText', () => {
    it('reads as the span the prices come from', () => {
        expect(faabWindowText({ window: { from: '2025-12-31', to: '2026-08-15' } })).toBe('Dec 2025 – Aug 2026');
    });

    // A local-time parse, not `new Date(iso)`, which is UTC midnight and
    // renders the previous month in any negative offset.
    it('does not slip a month in a negative UTC offset', () => {
        expect(faabWindowText({ window: { from: '2026-01-01', to: '2026-01-01' } })).toBe('Jan 2026');
    });

    it('is silent without a window, so nothing claims a span it lacks', () => {
        expect(faabWindowText({})).toBeNull();
        expect(faabWindowText(null)).toBeNull();
    });
});

describe('pricesByPlayerId', () => {
    it('returns an empty map on a failed fetch, so callers can look up blind', () => {
        expect(pricesByPlayerId(undefined)).toEqual({});
        expect(pricesByPlayerId({ players: null })).toEqual({});
    });

    it('hands back the players map as sent', () => {
        expect(pricesByPlayerId({ players: { 4034: entry({}) } })['4034'].claims).toBe(8);
    });
});
