import { describe, expect, it } from 'vitest';
import { defaultSectionFor, groupSectionsFor, PLANNED_SECTIONS, SECTION_GROUPS, SECTIONS } from './sections.js';

describe('defaultSectionFor', () => {
    it('opens on lineup once the draft is complete', () => {
        expect(defaultSectionFor('complete')).toBe('lineup');
    });

    it('opens on draft for any other status, including no draft data yet', () => {
        expect(defaultSectionFor('drafting')).toBe('draft');
        expect(defaultSectionFor(undefined)).toBe('draft');
    });
});

describe('section groups', () => {
    // A section whose group is missing or misspelt silently drops out of the
    // side menu - NavMenu lists sections by group - and gets no tab bar.
    it('puts every section, built or planned, in a group that exists', () => {
        const groupIds = SECTION_GROUPS.map((group) => group.id);
        for (const section of [...SECTIONS, ...PLANNED_SECTIONS]) {
            expect(groupIds).toContain(section.group);
        }
    });

    it('groups sections for the tab bar in SECTIONS order', () => {
        expect(groupSectionsFor(SECTIONS, 'trades').map((section) => section.id)).toEqual(['movers', 'trades']);
        expect(groupSectionsFor(SECTIONS, 'not-a-section')).toEqual([]);
    });
});
