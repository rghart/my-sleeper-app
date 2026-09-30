import { describe, expect, it } from 'vitest';
import { savedDateLabel, sortByMostRecent } from './savedRankLists.js';

describe('sortByMostRecent', () => {
    it('puts the newest save first and undated lists last, keeping their order', () => {
        const lists = [
            { route_name: 'old_undated' },
            { route_name: 'older', saved_at: 1000 },
            { route_name: 'undated_2' },
            { route_name: 'newest', saved_at: 3000 },
        ];
        expect(sortByMostRecent(lists).map((list) => list.route_name)).toEqual([
            'newest',
            'older',
            'old_undated',
            'undated_2',
        ]);
    });

    it('does not reorder the array it was given', () => {
        const lists = [{ saved_at: 1 }, { saved_at: 2 }];
        sortByMostRecent(lists);
        expect(lists[0].saved_at).toBe(1);
    });
});

describe('savedDateLabel', () => {
    const NOW = new Date(2026, 8, 30);

    it('reads month and day for a date this year', () => {
        expect(savedDateLabel(new Date(2026, 8, 28).getTime(), NOW)).toBe('Sep 28');
    });

    it('adds the year for a date in another year', () => {
        expect(savedDateLabel(new Date(2025, 11, 30).getTime(), NOW)).toBe('Dec 30, 2025');
    });

    it('is null for a list saved before dates were recorded', () => {
        expect(savedDateLabel(undefined, NOW)).toBeNull();
    });
});
