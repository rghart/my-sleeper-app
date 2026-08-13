import { describe, expect, it } from 'vitest';
import { movers, readingCoverage } from './movers.js';

const entry = (playerId, change, changePct) => ({ playerId, change, changePct, value: 1000 });

describe('movers', () => {
    const values = [
        entry('rise-big', 900, 90),
        entry('rise-small', 100, 10),
        entry('fall-big', -800, -80),
        entry('fall-small', -50, -5),
        entry('flat', 0, 0),
        entry('unknown', null, null),
    ];

    it('ranks risers biggest first', () => {
        expect(movers(values, { direction: 'up' }).map((e) => e.playerId)).toEqual(['rise-big', 'rise-small']);
    });

    it('ranks fallers by magnitude, so the list starts with the biggest drop', () => {
        // Sorting ascending would start the fallers list at -5%, which reads
        // as "nothing is happening".
        expect(movers(values, { direction: 'down' }).map((e) => e.playerId)).toEqual(['fall-big', 'fall-small']);
    });

    it('drops a player with no reading rather than treating him as flat', () => {
        // `change` is null when there was nothing to compare against.
        //
        // This asserts a real guarantee but is over-determined: the direction
        // comparison excludes null on its own, so deleting the explicit guard
        // in `movers` leaves this green. Kept as a statement of the contract
        // callers rely on, not as cover for that line.
        const all = [...movers(values, { direction: 'up' }), ...movers(values, { direction: 'down' })];
        expect(all.map((e) => e.playerId)).not.toContain('unknown');
    });

    it('excludes a flat player from both directions, since he has not moved', () => {
        const all = [...movers(values, { direction: 'up' }), ...movers(values, { direction: 'down' })];
        expect(all.map((e) => e.playerId)).not.toContain('flat');
    });

    it('ranks by points when asked, which is a different order from percent', () => {
        // The case that makes both bases worth offering: a small player
        // doubling outranks a big one on percent and loses on points.
        const mixed = [
            { playerId: 'scrub', value: 200, change: 200, changePct: 100 },
            { playerId: 'stud', value: 9000, change: 600, changePct: 7 },
        ];

        expect(movers(mixed, { basis: 'percent' }).map((e) => e.playerId)).toEqual(['scrub', 'stud']);
        expect(movers(mixed, { basis: 'points' }).map((e) => e.playerId)).toEqual(['stud', 'scrub']);
    });

    it('caps the list when a limit is given', () => {
        expect(movers(values, { direction: 'up', limit: 1 })).toHaveLength(1);
    });

    it('survives an absent or empty list', () => {
        expect(movers(undefined)).toEqual([]);
        expect(movers([])).toEqual([]);
    });
});

describe('readingCoverage', () => {
    it('counts how much of the board can actually be read', () => {
        // A movers list over 460 priced players and one over 12 are different
        // claims, and only the header can say which this is.
        expect(readingCoverage([entry('a', 1, 1), entry('b', null, null)])).toEqual({
            total: 2,
            withReading: 1,
        });
    });

    it('is zeroes rather than a crash on an absent list', () => {
        expect(readingCoverage(undefined)).toEqual({ total: 0, withReading: 0 });
    });
});
