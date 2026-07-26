import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveLeagueSeason, resolveMyDisplayName } from './sleeper.js';

describe('resolveLeagueSeason', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns league_season when present', () => {
        expect(resolveLeagueSeason({ league_season: '2026', season: '2025' })).toBe('2026');
    });

    it('falls back to season when league_season is absent', () => {
        expect(resolveLeagueSeason({ season: '2025' })).toBe('2025');
    });

    it('falls back to the current year when neither is present', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2030, 5, 15));
        expect(resolveLeagueSeason({})).toBe('2030');
    });

    it('falls back to the current year for null input', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2030, 5, 15));
        expect(resolveLeagueSeason(null)).toBe('2030');
    });

    it('falls back to the current year for undefined input', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2030, 5, 15));
        expect(resolveLeagueSeason(undefined)).toBe('2030');
    });
});

describe('resolveMyDisplayName', () => {
    const managerData = [
        { user_id: '521035584588267520', display_name: 'testDisplayName' },
        { user_id: '999', display_name: 'someoneElse' },
    ];

    it('returns the display_name when the user is found', () => {
        expect(resolveMyDisplayName(managerData, '521035584588267520')).toBe('testDisplayName');
    });

    it('returns null when the user is not found', () => {
        expect(resolveMyDisplayName(managerData, 'not-a-real-id')).toBeNull();
    });

    it('returns null for an empty array', () => {
        expect(resolveMyDisplayName([], '521035584588267520')).toBeNull();
    });

    it('returns null and does not throw for null managerData', () => {
        expect(resolveMyDisplayName(null, '521035584588267520')).toBeNull();
    });

    it('returns null and does not throw for undefined managerData', () => {
        expect(resolveMyDisplayName(undefined, '521035584588267520')).toBeNull();
    });
});
