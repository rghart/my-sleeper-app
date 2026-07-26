import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import DraftPanel from './DraftPanel';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// The polling loop is the reason this file exists. Its `cancelled` re-check
// guards a loop that could not be stopped mid-flight - the await can resolve
// after cleanup has already run, so clearTimeout fires against a timer that
// does not exist yet and the next tick gets scheduled anyway. Nothing tested it.
//
// The other half is that both call sites hand updateDraftBoard a *reducer*
// rather than a finished board (PR #100). A regression that passes a finished
// board still renders correctly in isolation, so what needs asserting is the
// shape of the argument, not what ends up on screen.
//
// This file drives the DOM with fireEvent rather than userEvent: userEvent's
// internal delay schedules real timers, which deadlocks against the fake timers
// the 3s poll needs. fireEvent is synchronous and does fire React's onChange,
// so nothing is lost here beyond a less realistic click.

const { rosterDataRaw, managerData, playerInfo, builtDraft, livePicksPartial, tradedPicks } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const DRAFT_ID = 'draft123';
const FREE_AGENT = { id: '13307', name: 'Marlin Klein' };

const jsonResponse = (data) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });

const rankEntry = (playerId) => ({
    match_results: [[playerId, '0.000']],
    ranking: '1',
    search_string: 'a pasted rank line',
});

const instantFetch = (url) => jsonResponse(url.includes('traded_picks') ? tradedPicks : livePicksPartial);

// Gates only the first live-picks request; everything else stays instant. That
// is control over the interleaving rather than added latency - blanket delays
// are what hid the bugs these tests exist for.
function gatedFetch() {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    let gated = false;
    const fetchMock = vi.fn((url) => {
        if (url.includes('picks/') && !url.includes('traded_picks') && !gated) {
            gated = true;
            return gate.then(() => jsonResponse(livePicksPartial));
        }
        return instantFetch(url);
    });
    return { fetchMock, release: () => release() };
}

function renderPanel(overrides = {}) {
    const updateDraftBoard = vi.fn();
    const props = {
        leagueData: {
            currentDraft: {
                draft_id: DRAFT_ID,
                season: '2026',
                player_pool: 'Rookie',
                status: 'drafting',
                built_draft: builtDraft,
            },
            rosterData,
        },
        playerInfo,
        rosterInfo,
        rankingPlayersIdsList: [rankEntry(FREE_AGENT.id)],
        updateDraftBoard,
        ...overrides,
    };
    const result = render(<DraftPanel {...props} />);
    return { updateDraftBoard, ...result };
}

const click = async (element) => {
    await act(async () => {
        fireEvent.click(element);
    });
};

const settle = async (ms) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
};

const button = (name) => screen.getByRole('button', { name });
const urlsFetched = () => global.fetch.mock.calls.map((call) => call[0]);

describe('DraftPanel', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        global.fetch = vi.fn(instantFetch);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('polls repeatedly while syncing and stops when sync is switched off', async () => {
        renderPanel();

        await click(button('Sync draft'));
        await settle(7000);

        // Two fetches per tick on a 3s timer: the immediate poll plus two more.
        const whileSyncing = global.fetch.mock.calls.length;
        expect(whileSyncing).toBeGreaterThan(2);

        await click(button('Stop sync'));
        await settle(10000);

        expect(global.fetch.mock.calls.length).toBe(whileSyncing);
    });

    it('does not schedule another tick when sync is stopped while a request is in flight', async () => {
        // The exact shape of the bug the `cancelled` re-check guards: cleanup
        // runs while the awaits are still pending, so clearTimeout has nothing
        // to clear and the loop reschedules itself forever after.
        const { fetchMock, release } = gatedFetch();
        global.fetch = fetchMock;

        renderPanel();

        await click(button('Sync draft'));
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Stop while that first request is still pending.
        await click(button('Stop sync'));

        release();
        await settle(10000);

        // The in-flight invocation still finishes its own second fetch - that
        // is unavoidable and not the bug. What must not happen is a further
        // tick: without the re-check, 10s buys three more polls.
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('stops polling when the panel unmounts mid-request', async () => {
        const { fetchMock, release } = gatedFetch();
        global.fetch = fetchMock;

        const { unmount } = renderPanel();

        await click(button('Sync draft'));
        unmount();

        release();
        await settle(10000);

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('hands updateDraftBoard a reducer rather than a finished board when syncing', async () => {
        const { updateDraftBoard } = renderPanel();

        await click(button('Update'));
        await settle(0);

        expect(updateDraftBoard).toHaveBeenCalledTimes(1);
        const reducer = updateDraftBoard.mock.calls[0][0];
        expect(typeof reducer).toBe('function');

        // Composing against whatever the caller passes is the whole point of
        // #100: a sync that captured its own board would discard a manual pick
        // made during the two awaits inside getLiveDraft.
        const boardWithManualPick = builtDraft.map((round) =>
            round.round === 3
                ? {
                      ...round,
                      picks: round.picks.map((pick) =>
                          pick.pick_number === 1 ? { ...pick, player_id: FREE_AGENT.id } : pick,
                      ),
                  }
                : round,
        );
        const next = reducer(boardWithManualPick);
        const round3Pick1 = next.find((round) => round.round === 3).picks.find((pick) => pick.pick_number === 1);

        // livePicksPartial covers rounds 1 and 2.1-2.8, so the server has no
        // pick for 3.1 and the manual one has to survive the merge.
        expect(round3Pick1.player_id).toBe(FREE_AGENT.id);
    });

    it('hands updateDraftBoard a reducer that swaps in only the changed round on a manual pick', async () => {
        const { updateDraftBoard } = renderPanel();

        await click(screen.getByText('1.1').closest('.draft-pick'));
        const modal = screen.getByText(/^Manually select pick/).closest('div').parentElement;
        await click(within(modal).getByText(new RegExp(FREE_AGENT.name)));

        expect(updateDraftBoard).toHaveBeenCalledTimes(1);
        const reducer = updateDraftBoard.mock.calls[0][0];
        expect(typeof reducer).toBe('function');

        const next = reducer(builtDraft);
        expect(next.find((round) => round.round === 1).picks[0].player_id).toBe(FREE_AGENT.id);
        // Only the edited round is replaced; the others keep their identity.
        expect(next.find((round) => round.round === 2)).toBe(builtDraft.find((round) => round.round === 2));
    });

    it('syncs against the draft id typed into the input rather than the original one', async () => {
        renderPanel();

        await act(async () => {
            fireEvent.change(screen.getByDisplayValue(DRAFT_ID), { target: { value: 'other456' } });
        });

        await click(button('Update'));
        await settle(0);

        expect(urlsFetched().length).toBeGreaterThan(0);
        expect(urlsFetched().every((url) => url.includes('other456'))).toBe(true);
        expect(urlsFetched().some((url) => url.includes(DRAFT_ID))).toBe(false);
    });
});
