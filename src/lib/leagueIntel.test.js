import { describe, expect, it } from 'vitest';
import {
    countLabel,
    coverageLabel,
    crushesShowPattern,
    didHappen,
    managerSignal,
    movedPlayers,
    transactionLabel,
    observedPicks,
    reachPhrase,
    reachPhraseShort,
    sortManagers,
} from './leagueIntel.js';

// `tendencies` is merged rather than replaced: overriding just `positionLean`
// used to drop `reachVsAdp` with it, which made two cases here look like
// implementation failures when the fixture was the thing at fault.
const manager = ({ tendencies, ...overrides } = {}) => ({
    userId: 1,
    displayName: 'atekipp',
    leaguesCount: 3,
    draftsCount: 3,
    draftsComplete: 3,
    ...overrides,
    tendencies: { crushes: [], positionLean: [], reachVsAdp: -2.03, ...tendencies },
});

const lean = (...counts) => counts.map((picks, i) => ({ position: ['WR', 'RB', 'TE'][i], picks, share: 0 }));

describe('observedPicks', () => {
    it('totals the picks behind a manager’s positional lean', () => {
        expect(observedPicks(manager({ tendencies: { positionLean: lean(15, 7, 6) } }))).toBe(28);
    });

    it('is zero for a manager with nothing observed, rather than undefined', () => {
        expect(observedPicks(manager({ tendencies: { positionLean: [] } }))).toBe(0);
        expect(observedPicks({})).toBe(0);
    });
});

describe('managerSignal', () => {
    // Same discipline as the rank list's copy rules: an average measured over
    // 3 drafts is not the same claim as one measured over 30, and the UI must
    // change shape rather than just shrink the number.
    const thresholds = { minDrafts: 5, minPicks: 20 };

    it('says nothing can be said when none of their drafts were seen', () => {
        const signal = managerSignal(manager({ draftsComplete: 0, tendencies: { positionLean: [] } }), thresholds);

        expect(signal.kind).toBe('none');
        expect(signal.quotesReach).toBe(false);
        expect(signal.quotesShares).toBe(false);
    });

    it('withholds the reach average below the draft threshold', () => {
        const signal = managerSignal(
            manager({ draftsComplete: 3, tendencies: { positionLean: lean(15, 7, 6) } }),
            thresholds,
        );

        expect(signal.kind).toBe('thin');
        expect(signal.draftsComplete).toBe(3);
        // 28 picks clears minPicks, but 3 drafts does not clear minDrafts -
        // reach is an average *per draft*, so it is the drafts that gate it.
        expect(signal.quotesReach).toBe(false);
    });

    it('withholds positional shares when they rest on too few picks', () => {
        // Plenty of drafts, but almost no picks in them - percentages off a
        // handful of picks are noise dressed as a tendency.
        const signal = managerSignal(
            manager({ draftsComplete: 12, tendencies: { positionLean: lean(2, 1, 1) } }),
            thresholds,
        );

        expect(signal.quotesShares).toBe(false);
        expect(signal.quotesReach).toBe(true);
    });

    it('quotes both once the sample supports them', () => {
        const signal = managerSignal(
            manager({ draftsComplete: 30, tendencies: { positionLean: lean(40, 20, 15) } }),
            thresholds,
        );

        expect(signal.kind).toBe('measured');
        expect(signal.quotesReach).toBe(true);
        expect(signal.quotesShares).toBe(true);
    });

    it('treats a missing reach figure as nothing to quote, however big the sample', () => {
        const signal = managerSignal(
            manager({ draftsComplete: 30, tendencies: { positionLean: lean(40), reachVsAdp: null } }),
            thresholds,
        );

        expect(signal.quotesReach).toBe(false);
    });
});

describe('reachPhrase', () => {
    // Negative means they take players before the league's own ADP.
    it('reads a negative gap as reaching early', () => {
        expect(reachPhrase(-2.03)).toBe('reaches 2.0 picks early');
    });

    it('reads a positive gap as waiting', () => {
        expect(reachPhrase(3.4)).toBe('waits 3.4 picks');
    });

    it('calls a gap under half a pick chalky rather than inventing a direction', () => {
        expect(reachPhrase(0.2)).toBe('drafts to ADP');
        expect(reachPhrase(-0.4)).toBe('drafts to ADP');
        expect(reachPhrase(0)).toBe('drafts to ADP');
    });

    it('is null when there is no figure at all', () => {
        expect(reachPhrase(null)).toBeNull();
        expect(reachPhrase(undefined)).toBeNull();
    });
});

describe('reachPhraseShort', () => {
    // The long form truncated the meta line beside it at 375px against real
    // data, on the very first row.
    it('keeps the direction but drops the words that do not fit', () => {
        expect(reachPhraseShort(-2.03)).toBe('2.0 early');
        expect(reachPhraseShort(3.4)).toBe('3.4 late');
        expect(reachPhraseShort(0.2)).toBe('on ADP');
    });

    it('is null when there is no figure', () => {
        expect(reachPhraseShort(null)).toBeNull();
    });

    it('is always shorter than the long form it replaces', () => {
        for (const reach of [-9.9, -2.03, -0.4, 0, 0.2, 3.4, 12.5]) {
            expect(reachPhraseShort(reach).length).toBeLessThan(reachPhrase(reach).length);
        }
    });
});

describe('crushesShowPattern', () => {
    // The counts state their own denominator, so they cannot lie. The heading
    // over them can: "players they keep taking" over a list of "1 of 1" is a
    // pattern claimed from a single observation.
    it('is false when nothing has been taken more than once', () => {
        expect(
            crushesShowPattern([
                { times: 1, of: 1 },
                { times: 1, of: 1 },
            ]),
        ).toBe(false);
    });

    it('is true as soon as one player was taken repeatedly', () => {
        expect(
            crushesShowPattern([
                { times: 1, of: 6 },
                { times: 3, of: 6 },
            ]),
        ).toBe(true);
    });

    it('is false for no crushes at all', () => {
        expect(crushesShowPattern([])).toBe(false);
        expect(crushesShowPattern(undefined)).toBe(false);
    });
});

describe('countLabel', () => {
    it('does not say "1 leagues"', () => {
        expect(countLabel(1, 'league')).toBe('1 league');
        expect(countLabel(1, 'draft')).toBe('1 draft');
    });

    it('pluralises everything else, including zero', () => {
        expect(countLabel(0, 'league')).toBe('0 leagues');
        expect(countLabel(31, 'draft')).toBe('31 drafts');
    });
});

describe('sortManagers', () => {
    it('puts the most-observed managers first, since they are the ones worth reading', () => {
        const managers = [
            manager({ displayName: 'cja9689', draftsComplete: 1 }),
            manager({ displayName: 'baconstains', draftsComplete: 30 }),
            manager({ displayName: 'atekipp', draftsComplete: 3 }),
        ];

        expect(sortManagers(managers).map((m) => m.displayName)).toEqual(['baconstains', 'atekipp', 'cja9689']);
    });

    it('breaks ties by name so the order is stable between loads', () => {
        const managers = [
            manager({ displayName: 'zeta', draftsComplete: 4 }),
            manager({ displayName: 'alpha', draftsComplete: 4 }),
        ];

        expect(sortManagers(managers).map((m) => m.displayName)).toEqual(['alpha', 'zeta']);
    });

    it('does not mutate the response it was handed', () => {
        const managers = [
            manager({ displayName: 'b', draftsComplete: 1 }),
            manager({ displayName: 'a', draftsComplete: 9 }),
        ];
        sortManagers(managers);

        expect(managers.map((m) => m.displayName)).toEqual(['b', 'a']);
    });

    it('is empty rather than throwing when there is no manager list', () => {
        expect(sortManagers(undefined)).toEqual([]);
    });
});

describe('transactionLabel', () => {
    it('names the types the plan anticipated', () => {
        expect(transactionLabel('trade')).toBe('Trade');
        expect(transactionLabel('waiver')).toBe('Waiver');
        expect(transactionLabel('free_agent')).toBe('Free agent');
    });

    it('names commissioner moves, which the scope missed and a live crawl found', () => {
        // 143 of 13,610 real transactions. Without this it renders as the raw
        // API string.
        expect(transactionLabel('commissioner')).toBe('Commissioner');
    });

    it('shows an unrecognised type rather than hiding it', () => {
        // Somebody else's API, and its vocabulary can grow. A type nobody
        // anticipated should look odd on screen, not vanish from a list that
        // claims to be complete.
        expect(transactionLabel('some_new_type')).toBe('some_new_type');
        expect(transactionLabel(undefined)).toBe('Unknown');
    });
});

describe('didHappen', () => {
    it('separates completed from failed', () => {
        // 11% of real transactions are failed, so this is not a rare edge.
        expect(didHappen({ status: 'complete' })).toBe(true);
        expect(didHappen({ status: 'failed' })).toBe(false);
    });

    it('treats an unknown status as having happened rather than hiding it', () => {
        expect(didHappen({ status: 'pending' })).toBe(true);
        expect(didHappen({})).toBe(true);
    });
});

describe('movedPlayers', () => {
    const players = { 4001: { name: 'Some Player', position: 'WR' } };

    it('resolves ids to names through the map the endpoint sends', () => {
        const moved = movedPlayers({ adds: { 4001: 1 }, drops: {} }, players);

        expect(moved.adds).toEqual([{ id: '4001', name: 'Some Player', position: 'WR' }]);
        expect(moved.drops).toEqual([]);
    });

    it('falls back to the id rather than dropping a player the lookup misses', () => {
        // A transaction that silently lists two of its three players is worse
        // than one showing an id.
        const moved = movedPlayers({ adds: { 9999: 1 } }, players);

        expect(moved.adds).toEqual([{ id: '9999', name: '9999', position: undefined }]);
    });

    it('is empty rather than throwing for a transaction with neither', () => {
        expect(movedPlayers(undefined)).toEqual({ adds: [], drops: [] });
    });
});

describe('coverageLabel', () => {
    it('always states both numbers', () => {
        expect(coverageLabel({ leaguesSeen: 33, leaguesKnown: 42 })).toBe('33 of 42 leagues');
    });

    it('does not say "1 leagues"', () => {
        expect(coverageLabel({ leaguesSeen: 1, leaguesKnown: 1 })).toBe('1 of 1 league');
    });

    it('is null when there is nothing to qualify', () => {
        expect(coverageLabel({ leaguesSeen: 0, leaguesKnown: 0 })).toBeNull();
        expect(coverageLabel(undefined)).toBeNull();
    });
});
