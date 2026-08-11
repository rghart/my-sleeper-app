import { describe, expect, it } from 'vitest';
import { groupByTier } from './rankTiers.js';

const entry = (ranking, tier, tier_label) => ({
    ranking,
    match_results: [[`p${ranking}`, '0.000']],
    search_string: `player ${ranking}`,
    ...(tier ? { tier, tier_label } : {}),
});

describe('groupByTier', () => {
    it('groups consecutive entries that share a tier', () => {
        const groups = groupByTier([
            entry(1, 1, 'Tier 1'),
            entry(2, 1, 'Tier 1'),
            entry(3, 2, 'Tier 2'),
            entry(4, 2, 'Tier 2'),
        ]);
        expect(groups.map((group) => [group.tier, group.entries.length])).toEqual([
            [1, 2],
            [2, 2],
        ]);
    });

    it('carries the label a heading gave the tier', () => {
        const groups = groupByTier([entry(1, 1, 'Tier 1 · Elite'), entry(2, 2, 'Tier 2 · Solid')]);
        expect(groups.map((group) => group.label)).toEqual(['Tier 1 · Elite', 'Tier 2 · Solid']);
    });

    it('falls back to a plain label when a tier has none', () => {
        expect(groupByTier([entry(1, 1, undefined), entry(2, 2, undefined)])[0].label).toBe('Tier 1');
    });

    // Null rather than one group covering everything: an untiered list has to
    // render exactly as it did before tiers existed, with no heading at all.
    it('returns null for a list with no tiers', () => {
        expect(groupByTier([entry(1), entry(2), entry(3)])).toBeNull();
    });

    it('returns null for an empty list', () => {
        expect(groupByTier([])).toBeNull();
    });

    // Filtering happens before grouping - a position chip can empty a tier
    // out of the middle of the list - and the groups that remain must still
    // be the right ones rather than being merged across the hole.
    it('keeps tiers apart when the ones between them are filtered away', () => {
        const groups = groupByTier([entry(1, 1, 'Tier 1'), entry(9, 3, 'Tier 3')]);
        expect(groups.map((group) => group.tier)).toEqual([1, 3]);
    });
});
