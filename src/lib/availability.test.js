import { describe, expect, it } from 'vitest';
import { defaultAnalyzedPick, managerSample, pickOptions, survivalAt } from './availability.js';

describe('defaultAnalyzedPick', () => {
    // docs/leaguemate-intel.md §3g gap 1b. "My next pick" was resolved as the
    // first pick at *or after* the current one that I own, so the moment I was
    // on the clock it resolved to the pick I was making right now: nothing
    // between, every player 100%, the feature blank exactly when it is wanted.
    it('is my next pick when someone else is on the clock', () => {
        expect(defaultAnalyzedPick({ myPicks: [39], currentPick: 35 })).toBe(39);
    });

    it('is my FOLLOWING pick when I am the one on the clock, not the pick I am making', () => {
        expect(defaultAnalyzedPick({ myPicks: [39, 51], currentPick: 39 })).toBe(51);
    });

    it('is null when I am on the clock with no pick after this one', () => {
        // A last-round pick. "No further picks this draft" is the honest
        // answer; rendering 100% for every player is not.
        expect(defaultAnalyzedPick({ myPicks: [48], currentPick: 48 })).toBeNull();
    });

    it('is null when I have no remaining picks at all', () => {
        expect(defaultAnalyzedPick({ myPicks: [], currentPick: 35 })).toBeNull();
    });

    it('takes the earliest following pick when I own several', () => {
        expect(defaultAnalyzedPick({ myPicks: [39, 51, 63], currentPick: 35 })).toBe(39);
    });

    it('does not assume myPicks arrives sorted', () => {
        expect(defaultAnalyzedPick({ myPicks: [63, 39, 51], currentPick: 35 })).toBe(39);
    });

    it('treats a missing myPicks as no picks rather than throwing', () => {
        // The API returns `myPicks: []` for a completed draft; a caller
        // rendering before the first response has nothing at all.
        expect(defaultAnalyzedPick({ currentPick: 35 })).toBeNull();
        expect(defaultAnalyzedPick({})).toBeNull();
    });
});

describe('survivalAt', () => {
    const target = {
        byPick: {
            35: { adjSurvival: 1, baseSurvival: 1, threats: [] },
            39: { adjSurvival: 0.459, baseSurvival: 0.447, threats: [] },
        },
    };

    it('reads the adjusted survival for a pick the response covers', () => {
        expect(survivalAt(target, 39)).toBe(0.459);
    });

    it('accepts the pick as a number even though byPick is keyed by string', () => {
        expect(survivalAt(target, 35)).toBe(1);
    });

    // The prototype ended this in `?? 1`, which renders a missing read as a
    // confident 100% - the same failure gap 1b is about, reintroduced as a
    // default. A number the data does not support must not reach the screen.
    it('is null for a pick the response has no read for', () => {
        expect(survivalAt(target, 42)).toBeNull();
    });

    it('is null rather than throwing for a target with no byPick at all', () => {
        expect(survivalAt({}, 39)).toBeNull();
        expect(survivalAt(undefined, 39)).toBeNull();
    });

    it('is null when no pick is being analyzed', () => {
        // What §3g's "no further picks this draft" case passes in.
        expect(survivalAt(target, null)).toBeNull();
    });

    it('keeps a real zero rather than treating it as missing', () => {
        expect(survivalAt({ byPick: { 48: { adjSurvival: 0 } } }, 48)).toBe(0);
    });
});

describe('pickOptions', () => {
    const board = [
        { pick: 35, manager: 'atekipp', mine: false, drafts: 3 },
        { pick: 39, manager: 'ryangh', mine: true, drafts: 4 },
    ];

    it('offers every pick left on the board, with its trade-resolved owner', () => {
        expect(pickOptions(board)).toEqual([
            { pick: 35, manager: 'atekipp', mine: false },
            { pick: 39, manager: 'ryangh', mine: true },
        ]);
    });

    it('is empty for a finished draft rather than throwing', () => {
        expect(pickOptions([])).toEqual([]);
        expect(pickOptions(undefined)).toEqual([]);
    });
});

describe('managerSample', () => {
    // The copy-rules table in docs/leaguemate-intel.md §3 Frontend. The
    // standing lesson of this feature is that the numbers were fine and the
    // sentence next to them overclaimed, so each row is its own test.
    const threshold = { minDrafts: 8, minTimes: 3 };

    it('says none of their drafts were seen when there are none', () => {
        expect(managerSample({ times: 0, of: 0 }, threshold)).toEqual({
            kind: 'none',
            of: 0,
            times: 0,
        });
    });

    // "took him 0× of 3 drafts" is a rate nobody asked for; the fact is that
    // they have never taken him, and the sample size qualifies how much that
    // is worth. Distinct from 'none', where we have seen nothing at all and
    // cannot say even that.
    it('says they have never taken him rather than quoting a zero rate', () => {
        const sample = managerSample({ times: 0, of: 3, picks: [] }, threshold);

        expect(sample.kind).toBe('never');
        expect(sample.of).toBe(3);
    });

    it('still says never at a large sample, where it means considerably more', () => {
        expect(managerSample({ times: 0, of: 30, picks: [] }, threshold).kind).toBe('never');
    });

    it('names the literal pick when there is only one, and never calls it an ADP', () => {
        const sample = managerSample({ times: 1, of: 4, adp: 46.6, picks: ['4.9@39'] }, threshold);

        expect(sample.kind).toBe('singlePick');
        expect(sample.pick).toBe('39');
        // A single pick is not an average of anything.
        expect(sample.adp).toBeUndefined();
    });

    it('quotes no rate when fewer than five of their drafts were seen', () => {
        const sample = managerSample({ times: 2, of: 3, adp: 30.6, picks: ['3.1@25', '3.5@29'] }, threshold);

        expect(sample.kind).toBe('thin');
        expect(sample.of).toBe(3);
        expect(sample.adp).toBeUndefined();
    });

    it('gives the count and their own ADP once past the signal threshold', () => {
        const sample = managerSample({ times: 11, of: 24, adp: 20.9, picks: [] }, threshold);

        expect(sample).toEqual({ kind: 'full', times: 11, of: 24, adp: 20.9 });
    });

    // Not in the table: enough drafts to quote a rate, too few picks on this
    // player to call the average an ADP. The threshold gates the ADP
    // specifically (§3), so the count survives and the ADP does not.
    it('gives the count without an ADP when the drafts clear but the picks do not', () => {
        const sample = managerSample({ times: 2, of: 12, adp: 31.4, picks: [] }, threshold);

        expect(sample.kind).toBe('countOnly');
        expect(sample.times).toBe(2);
        expect(sample.of).toBe(12);
        expect(sample.adp).toBeUndefined();
    });

    it('withholds the ADP when they have the picks but too few drafts seen', () => {
        const sample = managerSample({ times: 3, of: 6, adp: 28.1, picks: [] }, threshold);

        expect(sample.kind).toBe('countOnly');
        expect(sample.adp).toBeUndefined();
    });

    it('reads the threshold from the response rather than hardcoding it', () => {
        const entry = { times: 3, of: 8, adp: 20.9, picks: [] };

        expect(managerSample(entry, { minDrafts: 8, minTimes: 3 }).kind).toBe('full');
        expect(managerSample(entry, { minDrafts: 20, minTimes: 3 }).kind).toBe('countOnly');
    });
});
