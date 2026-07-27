import { describe, expect, it } from 'vitest';
import {
    buildLineupSet,
    buildRosterInfo,
    decorateRosters,
    isInLineup,
    isTaken,
    memoizeRosterInfo,
    rosteredBy,
} from './rosterInfo.js';
// The board transformations are deliberately imported from the real module rather
// than reimplemented here: the flags are only correct if they are derived from the
// board the production code actually produces, so these tests drive the same
// functions DraftPanel and DraftRound call.
import { applyLivePicks, applyManualPick, syncLiveDraft } from './liveDraft.js';
import fixtureInputs from './__fixtures__/roster-flags-2026.json';
import golden from './__fixtures__/golden-roster-flags.json';

// Every test takes its own structuredClone, for the reason spelled out at the top
// of liveDraft.test.js: a shared JSON import lets a mutation bug in one test
// poison a later test's "before" snapshot and mask the regression it exists to
// catch.
const load = () => structuredClone(fixtureInputs);

// The golden records the three flag fields the pre-refactor code wrote onto every
// player. Projecting the derived map back into that shape is what makes the
// captured baseline directly comparable.
const flagsFrom = (rosterInfo, ids, lineupSet = new Set()) =>
    Object.fromEntries(
        [...ids].sort().map((id) => [
            id,
            {
                is_taken: isTaken(rosterInfo, id),
                rostered_by: rosteredBy(rosterInfo, id),
                in_lineup: isInLineup(lineupSet, id),
            },
        ]),
    );

const decoratedFor = (fx) => decorateRosters({ rosterData: fx.rosterDataRaw, managerData: fx.managerData });

// A board with picks filled in, exactly as the sync produces it.
const fillBoard = (builtDraft, livePicks) => applyLivePicks({ builtDraft, livePicks });

// Assigns (or clears, with a null playerID) a player on one pick and splices the
// updated round back into the board, which is the composition DraftRound and
// DraftPanel.handlePickChange perform between them.
const assignPick = (board, roundNumber, pickNumber, playerID) => {
    const round = board.find((r) => r.round === roundNumber);
    const currentManualPick = round.picks.find((p) => p.pick_number === pickNumber);
    const updatedRound = applyManualPick({ round, currentManualPick, playerID });
    return board.map((r) => (r.round === updatedRound.round ? updatedRound : r));
};

describe('decorateRosters', () => {
    it('matches the captured baseline for the real league', () => {
        const fx = load();
        expect(decoratedFor(fx)).toEqual(golden.decoratedRosters);
    });

    it('matches the captured baseline byte-for-byte (catches key-order regressions)', () => {
        const fx = load();
        expect(JSON.stringify(decoratedFor(fx))).toEqual(JSON.stringify(golden.decoratedRosters));
    });

    it('does not mutate the raw rosterData it was given', () => {
        const fx = load();
        const before = JSON.stringify(fx.rosterDataRaw);
        decorateRosters({ rosterData: fx.rosterDataRaw, managerData: fx.managerData });
        expect(JSON.stringify(fx.rosterDataRaw)).toEqual(before);
    });

    it('falls back to "Unassigned <roster_id>" and a null avatar for an ownerless roster', () => {
        const result = decorateRosters({
            rosterData: [{ roster_id: 7, owner_id: null, players: ['1001'] }],
            managerData: [],
        });
        expect(result[0].manager_display_name).toEqual('Unassigned 7');
        expect(result[0].avatar).toBeNull();
    });
});

describe('buildRosterInfo — derived from rosters', () => {
    it('reproduces the captured pre-refactor flags for every player in the fixture', () => {
        const fx = load();
        const rosterInfo = buildRosterInfo({ rosterData: decoratedFor(fx) });
        expect(flagsFrom(rosterInfo, Object.keys(fx.playerInfo))).toEqual(golden.flagsFromRosters);
    });

    it('reports free agents as untaken with a null manager', () => {
        const fx = load();
        const rosterInfo = buildRosterInfo({ rosterData: decoratedFor(fx) });
        // 13307 and 9499 are on nobody's roster in this league.
        for (const id of ['13307', '9499']) {
            expect(isTaken(rosterInfo, id)).toBe(false);
            expect(rosteredBy(rosterInfo, id)).toBeNull();
        }
    });

    it('reports an unknown player id as untaken rather than throwing', () => {
        const fx = load();
        const rosterInfo = buildRosterInfo({ rosterData: decoratedFor(fx) });
        expect(isTaken(rosterInfo, 'no-such-player')).toBe(false);
        expect(rosteredBy(rosterInfo, 'no-such-player')).toBeNull();
    });

    it('does not mutate its inputs', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        const before = JSON.stringify(rosterData);
        buildRosterInfo({ rosterData, builtDraft: fx.builtDraft });
        expect(JSON.stringify(rosterData)).toEqual(before);
    });

    it('leaves playerInfo completely alone — it is not an input and gains no flag fields', () => {
        const fx = load();
        const before = JSON.stringify(fx.playerInfo);
        buildRosterInfo({ rosterData: decoratedFor(fx), builtDraft: fx.builtDraft });
        expect(JSON.stringify(fx.playerInfo)).toEqual(before);
        for (const player of Object.values(fx.playerInfo)) {
            expect(player).not.toHaveProperty('is_taken');
            expect(player).not.toHaveProperty('rostered_by');
            expect(player).not.toHaveProperty('in_lineup');
        }
    });
});

describe('buildRosterInfo — derived from draft picks', () => {
    it('reproduces the captured flags for the fully synced board', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        const rosterInfo = buildRosterInfo({ rosterData, builtDraft: fillBoard(fx.builtDraft, fx.livePicks) });
        expect(flagsFrom(rosterInfo, Object.keys(fx.playerInfo))).toEqual(golden.flagsAfterFullSync);
    });

    it('reproduces the captured board-only flags for a partial board', () => {
        const fx = load();
        // Rosters emptied so only the board contributes, isolating the draft path.
        // Manager names are still needed to resolve each pick's owner.
        const rosterData = decoratedFor(fx).map((r) => ({ ...r, players: [] }));
        const rosterInfo = buildRosterInfo({ rosterData, builtDraft: fillBoard(fx.builtDraft, fx.livePicksPartial) });
        expect(flagsFrom(rosterInfo, Object.keys(fx.playerInfo))).toEqual(golden.flagsAfterPartialSync);
    });

    it('ignores empty pick slots', () => {
        const fx = load();
        const rosterData = decoratedFor(fx).map((r) => ({ ...r, players: [] }));
        const rosterInfo = buildRosterInfo({ rosterData, builtDraft: fx.builtDraft });
        expect(rosterInfo.size).toBe(0);
    });

    it('lets a draft pick outrank the roster when the two disagree', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        // 11435 is on ryangh's roster (roster_id 1). Put him on a pick owned by a
        // different roster and the pick owner must win, matching the pre-refactor
        // order where applyLivePicks ran after markTakenPlayers.
        const otherRoster = rosterData.find((r) => r.roster_id !== 1);
        const board = fx.builtDraft.map((round) => ({ ...round, picks: round.picks.map((p) => ({ ...p })) }));
        board[0].picks[0] = { ...board[0].picks[0], owner_id: otherRoster.roster_id, player_id: '11435', picked: true };

        const rosterInfo = buildRosterInfo({ rosterData, builtDraft: board });
        expect(rosteredBy(rosterInfo, '11435')).toEqual(otherRoster.manager_display_name);
    });

    it('marks a free agent taken once they occupy a pick', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        const board = fx.builtDraft.map((round) => ({ ...round, picks: round.picks.map((p) => ({ ...p })) }));
        const target = board[0].picks.find((p) => p.pick_number === 5);
        target.player_id = '13307';
        target.picked = true;

        const rosterInfo = buildRosterInfo({ rosterData, builtDraft: board });
        const owner = rosterData.find((r) => r.roster_id === target.owner_id);
        expect(isTaken(rosterInfo, '13307')).toBe(true);
        expect(rosteredBy(rosterInfo, '13307')).toEqual(owner.manager_display_name);
    });
});

describe('in_lineup derivation', () => {
    const slot = (label, playerId = null) => ({ label, playerId });

    it('treats a player as in the lineup exactly when their id fills a slot', () => {
        const lineup = buildLineupSet([
            slot('QB'),
            slot('RB', '11435'),
            slot('RB'),
            slot('FLX'),
            slot('SFLX', '13274'),
        ]);
        expect(isInLineup(lineup, '11435')).toBe(true);
        expect(isInLineup(lineup, '13274')).toBe(true);
        expect(isInLineup(lineup, '13279')).toBe(false);
    });

    it('counts no one as in the lineup when every slot is empty', () => {
        // This used to be a test that bare position labels were not mistaken
        // for player ids, which was a real hazard while labels and ids shared
        // one array. A slot now carries its occupant in its own field, so the
        // question is occupancy rather than what a string looks like.
        const lineup = buildLineupSet(['QB', 'RB', 'WR', 'TE', 'FLX', 'SFLX'].map((label) => slot(label)));
        expect(lineup.size).toBe(0);
    });

    it('does not treat a label as an occupant even when it looks like an id', () => {
        // Nothing rules out a future position label being numeric; the old
        // regex-based derivation would have counted one as a player.
        const lineup = buildLineupSet([slot('2'), slot('QB', '11435')]);
        expect(lineup.size).toBe(1);
        expect(isInLineup(lineup, '11435')).toBe(true);
        expect(isInLineup(lineup, '2')).toBe(false);
    });

    it('handles an empty lineup', () => {
        expect(buildLineupSet([]).size).toBe(0);
        expect(isInLineup(buildLineupSet([]), '11435')).toBe(false);
    });
});

describe('memoizeRosterInfo', () => {
    it('returns the identical map for repeated calls with unchanged inputs', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        const select = memoizeRosterInfo();
        const first = select({ rosterData, builtDraft: fx.builtDraft });
        const second = select({ rosterData, builtDraft: fx.builtDraft });
        expect(second).toBe(first);
    });

    it('rebuilds when the roster data changes identity', () => {
        const fx = load();
        const select = memoizeRosterInfo();
        const first = select({ rosterData: decoratedFor(fx), builtDraft: fx.builtDraft });
        const second = select({ rosterData: decoratedFor(fx), builtDraft: fx.builtDraft });
        expect(second).not.toBe(first);
        expect([...second.keys()].sort()).toEqual([...first.keys()].sort());
    });

    it('rebuilds when the board changes identity', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        const select = memoizeRosterInfo();
        const first = select({ rosterData, builtDraft: fx.builtDraft });
        const second = select({ rosterData, builtDraft: fillBoard(fx.builtDraft, fx.livePicks) });
        expect(second).not.toBe(first);
    });
});

// The two stale-flag bugs the redesign is meant to eliminate. Both fail against
// the pre-refactor code, which only ever SET flags and never cleared them; the
// captured golden records that wrong output alongside these expectations.
//
// Both drive the real board transformations - applyManualPick for the assignment
// and syncLiveDraft for the re-sync - so they cover the sites the bugs were
// reported against, not just buildRosterInfo's derivation from a hand-built board.
describe('stale-flag regressions', () => {
    it('drops a displaced free agent when another player takes their pick', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        const synced = fillBoard(fx.builtDraft, fx.livePicks);

        const withKlein = assignPick(synced, 1, 5, '13307');
        expect(isTaken(buildRosterInfo({ rosterData, builtDraft: withKlein }), '13307')).toBe(true);

        // 9499 displaces 13307 on the same pick
        const displaced = assignPick(withKlein, 1, 5, '9499');
        const after = buildRosterInfo({ rosterData, builtDraft: displaced });
        expect(isTaken(after, '9499')).toBe(true);
        expect(isTaken(after, '13307')).toBe(false);
        expect(rosteredBy(after, '13307')).toBeNull();

        // the pre-refactor code left the displaced player taken
        expect(golden.buggyDisplacedFreeAgent.displacedFlags.is_taken).toBe(true);
    });

    it('drops a manually assigned free agent once a re-sync removes them from the board', () => {
        const fx = load();
        const rosterData = decoratedFor(fx);
        const synced = fillBoard(fx.builtDraft, fx.livePicks);

        const withKlein = assignPick(synced, 1, 5, '13307');
        expect(isTaken(buildRosterInfo({ rosterData, builtDraft: withKlein }), '13307')).toBe(true);

        // Re-sync the board that still carries the manual pick, the way clicking
        // Update does. The live picks put 13294 back on the slot, leaving 13307 on
        // no pick and no roster.
        const resynced = syncLiveDraft({
            liveDraft: { built_draft: withKlein },
            livePicks: fx.livePicks,
            tradedPicks: fx.tradedPicks,
        }).built_draft;
        expect(resynced.flatMap((r) => r.picks).some((p) => p.player_id === '13307')).toBe(false);

        const after = buildRosterInfo({ rosterData, builtDraft: resynced });
        expect(isTaken(after, '13307')).toBe(false);
        expect(rosteredBy(after, '13307')).toBeNull();

        // the pre-refactor code left the assigned player taken
        expect(golden.buggyStaleAfterResync.flags.is_taken).toBe(true);
        expect(golden.buggyStaleAfterResync.onBoard).toBe(false);
        expect(golden.buggyStaleAfterResync.onAnyRoster).toBe(false);
    });
});
