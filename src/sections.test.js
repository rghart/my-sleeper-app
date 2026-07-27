import { describe, expect, it } from 'vitest';
import { defaultSectionFor } from './sections.js';

describe('defaultSectionFor', () => {
    it('opens on lineup once the draft is complete', () => {
        expect(defaultSectionFor('complete')).toBe('lineup');
    });

    it('opens on draft for any other status, including no draft data yet', () => {
        expect(defaultSectionFor('drafting')).toBe('draft');
        expect(defaultSectionFor(undefined)).toBe('draft');
    });
});
