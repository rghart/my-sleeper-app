import { describe, expect, it } from 'vitest';
import { agoLabel } from './relativeTime.js';

const NOW = Date.UTC(2026, 6, 29, 12, 0, 0);
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('agoLabel', () => {
    it('is null when nothing has happened yet, rather than the word never', () => {
        expect(agoLabel(null, NOW)).toBeNull();
        expect(agoLabel(undefined, NOW)).toBeNull();
    });

    it('reads "just now" for anything under a minute', () => {
        expect(agoLabel(NOW, NOW)).toBe('just now');
        expect(agoLabel(NOW - 59000, NOW)).toBe('just now');
    });

    it('steps up through minutes, hours and days, flooring rather than rounding', () => {
        expect(agoLabel(NOW - MINUTE, NOW)).toBe('1m ago');
        expect(agoLabel(NOW - 2 * MINUTE - 59000, NOW)).toBe('2m ago');
        expect(agoLabel(NOW - HOUR, NOW)).toBe('1h ago');
        expect(agoLabel(NOW - 23 * HOUR, NOW)).toBe('23h ago');
        expect(agoLabel(NOW - DAY, NOW)).toBe('1d ago');
        expect(agoLabel(NOW - 9 * DAY, NOW)).toBe('9d ago');
    });

    it('reads "just now" rather than a negative age when the clock ran backwards', () => {
        // A device time change mid-draft. Rare, but "-3m ago" is worse than
        // being a minute optimistic about a sync that definitely happened.
        expect(agoLabel(NOW + 5 * MINUTE, NOW)).toBe('just now');
    });
});
