import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

// A fixed base time plus a live-paced pick_timer (well under the 900s
// live/slow boundary in draftClock.js) so the default fixture keeps the same
// 3s poll cadence every pre-existing test in this file already assumes.
// Tests that care about a slower cadence override `currentDraft` directly.
const DRAFT_BASE_TIME = Date.UTC(2026, 6, 27, 12, 0, 0);

function renderPanel(overrides = {}) {
    const updateDraftBoard = vi.fn();
    const props = {
        leagueData: {
            currentDraft: {
                draft_id: DRAFT_ID,
                season: '2026',
                player_pool: 'Rookie',
                status: 'drafting',
                start_time: DRAFT_BASE_TIME,
                last_picked: null,
                settings: { pick_timer: 30 },
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

// One sync tick and no more. The panel's old one-shot "Update" button went
// with the redesigned clock card - the draft id is edited in the Draft source
// sheet now and the card carries only the sync toggle - so a single tick is
// switching sync on and stopping before the next one is due.
const syncOnce = async () => {
    await click(button('Sync draft'));
    await settle(0);
    await click(button('Stop sync'));
};
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

        await syncOnce();

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

        await click(screen.getByText('1.01').closest('button'));
        const modal = screen.getByRole('dialog', { name: /^Manually select pick/ });
        await click(within(modal).getByText(new RegExp(FREE_AGENT.name)));

        expect(updateDraftBoard).toHaveBeenCalledTimes(1);
        const reducer = updateDraftBoard.mock.calls[0][0];
        expect(typeof reducer).toBe('function');

        const next = reducer(builtDraft);
        expect(next.find((round) => round.round === 1).picks[0].player_id).toBe(FREE_AGENT.id);
        // Only the edited round is replaced; the others keep their identity.
        expect(next.find((round) => round.round === 2)).toBe(builtDraft.find((round) => round.round === 2));
    });

    // Both live-sync fetches swallow their failure and resolve to undefined, and
    // syncLiveDraft's helpers forEach over the result - so before the guard in
    // getLiveDraft either failure threw `Cannot read properties of undefined
    // (reading 'forEach')`. That fires on the 3-second poll as well as the
    // button, so a single blip mid-draft killed the board and the poll kept
    // running. What matters is not just that nothing throws, but that the half
    // that succeeded still reaches the board: bailing out entirely would also
    // stop the crash while quietly dropping a live pick.
    //
    // These run against a board with the trades stripped back out. The shared
    // builtDraft fixture already has all 21 traded picks applied, so asserting
    // an owner_id the fixture ships with passes whether or not applyTradedPicks
    // ever ran.
    const pristineBoard = () =>
        builtDraft.map((round) => ({
            ...round,
            picks: round.picks.map((pick) => ({ ...pick, is_traded: false, owner_id: pick.roster_id })),
        }));

    const failing = (shouldFail) =>
        vi.fn((url) => (shouldFail(url) ? Promise.reject(new Error('network blip')) : instantFetch(url)));

    const livePicksFail = (url) => url.includes('picks/') && !url.includes('traded_picks');

    it('still applies traded picks when the live-picks request fails', async () => {
        global.fetch = failing(livePicksFail);
        const { updateDraftBoard } = renderPanel();

        await syncOnce();

        expect(updateDraftBoard).toHaveBeenCalledTimes(1);
        const next = updateDraftBoard.mock.calls[0][0](pristineBoard());

        // Round 2 / roster 2 goes to owner 6 in the tradedPicks fixture, and
        // starts at owner 2 on the pristine board.
        const traded = next.find((round) => round.round === 2).picks.find((pick) => pick.roster_id === 2);
        expect(traded.owner_id).toBe(6);
        expect(traded.is_traded).toBe(true);
        // No live picks landed, and the board was not blanked to compensate.
        expect(next.find((round) => round.round === 1).picks.every((pick) => pick.player_id === null)).toBe(true);
        expect(next.flatMap((round) => round.picks).length).toBe(builtDraft.flatMap((round) => round.picks).length);
    });

    it('still applies live picks when the traded-picks request fails', async () => {
        global.fetch = failing((url) => url.includes('traded_picks'));
        const { updateDraftBoard } = renderPanel();

        await syncOnce();

        expect(updateDraftBoard).toHaveBeenCalledTimes(1);
        const next = updateDraftBoard.mock.calls[0][0](pristineBoard());

        const firstPick = next.find((round) => round.round === 1).picks.find((pick) => pick.board_spot === 1);
        expect(firstPick.player_id).toBe('13287');
        expect(firstPick.picked).toBe(true);
        // Nothing claimed a trade off the back of a failed request.
        expect(next.every((round) => round.picks.every((pick) => !pick.is_traded))).toBe(true);
    });

    it('keeps polling after a failed sync rather than dying on the first blip', async () => {
        let calls = 0;
        // Fails the first live-picks request only; the poll must survive it and
        // recover on a later tick.
        global.fetch = vi.fn((url) => {
            if (livePicksFail(url)) {
                calls += 1;
                if (calls === 1) {
                    return Promise.reject(new Error('network blip'));
                }
            }
            return instantFetch(url);
        });
        const { updateDraftBoard } = renderPanel();

        await click(button('Sync draft'));
        await settle(0);
        await settle(3000);
        await settle(3000);

        expect(updateDraftBoard.mock.calls.length).toBeGreaterThanOrEqual(3);

        // Every reducer has to be applied, in order, starting with the one from
        // the failed tick. updateDraftBoard is a mock here and never invokes
        // what it is handed, so asserting only on the last tick's reducer would
        // pass even with the guard removed - the throw would simply never
        // happen. App's real updateDraftBoard is a setState updater and does
        // invoke it, so folding them is what reproduces the live-draft path.
        const board = updateDraftBoard.mock.calls.reduce((acc, [reducer]) => reducer(acc), pristineBoard());

        expect(board.find((round) => round.round === 1).picks.find((pick) => pick.board_spot === 1).player_id).toBe(
            '13287',
        );
    });

    it('syncs against the draft id pasted into the source sheet rather than the original one', async () => {
        renderPanel();

        await click(button(`Draft source: …${DRAFT_ID.slice(-4)}`));
        await act(async () => {
            fireEvent.change(screen.getByLabelText('Mock draft ID'), { target: { value: '123456' } });
        });
        await click(button('Use'));

        await syncOnce();

        expect(urlsFetched().length).toBeGreaterThan(0);
        expect(urlsFetched().every((url) => url.includes('123456'))).toBe(true);
        expect(urlsFetched().some((url) => url.includes(DRAFT_ID))).toBe(false);
    });

    // pollIntervalMs (src/lib/draftClock.js) is unit-tested in isolation;
    // what needs proving here is that DraftPanel actually reads it off
    // currentDraft rather than the hard-coded 3000ms the loop used to carry,
    // for both paces the real leagues use. Asserting on fetch call counts
    // after advancing time - not on the timer id - is what actually shows
    // the cadence, since a wrong interval still schedules *a* timer.
    it('polls a live-paced draft every 3s', async () => {
        renderPanel({
            leagueData: {
                currentDraft: {
                    draft_id: DRAFT_ID,
                    season: '2026',
                    player_pool: 'Rookie',
                    status: 'drafting',
                    start_time: DRAFT_BASE_TIME,
                    last_picked: null,
                    settings: { pick_timer: 30 },
                    built_draft: builtDraft,
                },
                rosterData,
            },
        });

        await click(button('Sync draft'));
        expect(global.fetch.mock.calls.length).toBe(2); // one tick: two requests

        await settle(3000);
        expect(global.fetch.mock.calls.length).toBe(4); // a second tick landed

        await settle(3000);
        expect(global.fetch.mock.calls.length).toBe(6); // and a third
    });

    it('polls a slow (24h dynasty) draft every 30s, not every 3s', async () => {
        renderPanel({
            leagueData: {
                currentDraft: {
                    draft_id: DRAFT_ID,
                    season: '2026',
                    player_pool: 'Rookie',
                    status: 'drafting',
                    start_time: DRAFT_BASE_TIME,
                    last_picked: null,
                    settings: { pick_timer: 86400 },
                    built_draft: builtDraft,
                },
                rosterData,
            },
        });

        await click(button('Sync draft'));
        expect(global.fetch.mock.calls.length).toBe(2); // one tick: two requests

        await settle(3000);
        // A live cadence would have landed a second tick by now; a slow one
        // must not have.
        expect(global.fetch.mock.calls.length).toBe(2);

        await settle(27000); // total 30s since the first tick
        expect(global.fetch.mock.calls.length).toBe(4); // now the second tick lands
    });
});

describe('DraftPanel board view toggle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        global.fetch = vi.fn(instantFetch);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the feed by default', () => {
        renderPanel();

        // The feed groups picks into per-round lists; the grid does not.
        expect(screen.getByRole('list', { name: 'Round 1' })).toBeInTheDocument();
        expect(button('Feed')).toHaveAttribute('aria-pressed', 'true');
        expect(button('Grid')).toHaveAttribute('aria-pressed', 'false');
    });

    it('switches to the grid view and back on click', async () => {
        renderPanel();

        await click(button('Grid'));

        expect(screen.queryByRole('list', { name: 'Round 1' })).toBeNull();
        expect(button('Grid')).toHaveAttribute('aria-pressed', 'true');
        // The grid has one density and no sub-toggle, so what proves it is on
        // screen is the position key it carries instead.
        expect(screen.getByText('YOU')).toBeVisible();

        await click(button('Feed'));

        expect(screen.getByRole('list', { name: 'Round 1' })).toBeInTheDocument();
        expect(screen.queryByText('YOU')).toBeNull();
    });
});

// Coverage moved here from the old BestAvailableSheet.test.jsx (deleted with
// that component): the collapsed/expanded toggle and the "n left" count are
// now DraftPanel's own composition of BestAvailableHandle + Sheet +
// BestAvailable rather than one self-contained component, so the tests that
// used to exercise BestAvailableSheet directly move up a level to here. Real
// timers and userEvent, same as the new-pick-markers suite below - nothing
// here touches the sync poll.
describe('DraftPanel best-available sheet', () => {
    // 13294 is genuinely taken (roster 2) in the shared fixture - added
    // alongside the default FREE_AGENT entry so "shown but marked" has
    // something to prove against "excluded outright".
    const TAKEN = { id: '13294', name: 'Makai Lemon' };

    it('is collapsed by default', () => {
        renderPanel();

        const handle = screen.getByRole('button', { name: /Best available/ });
        expect(handle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog', { name: 'Best available' })).toBeNull();
    });

    it('expands and collapses on click, tracked by aria-expanded', async () => {
        const user = userEvent.setup();
        renderPanel();

        const handle = () => screen.getByRole('button', { name: /Best available/ });
        await user.click(handle());
        expect(handle()).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('dialog', { name: 'Best available' })).toBeInTheDocument();

        await user.click(handle());
        expect(handle()).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('dialog', { name: 'Best available' })).toBeNull();
    });

    it('reflects the unrostered count, not the raw list, in the collapsed handle', () => {
        renderPanel({ rankingPlayersIdsList: [rankEntry(FREE_AGENT.id), rankEntry(TAKEN.id)] });

        expect(screen.getByRole('button', { name: /Best available/ })).toHaveTextContent('1 left');
    });

    it('shows a taken player marked Taken rather than excluding it, and offers no action at all', async () => {
        const user = userEvent.setup();
        renderPanel({ rankingPlayersIdsList: [rankEntry(FREE_AGENT.id), rankEntry(TAKEN.id)] });

        await user.click(screen.getByRole('button', { name: /Best available/ }));
        const dialog = screen.getByRole('dialog', { name: 'Best available' });

        // Both rows render - taken is marked, not hidden.
        expect(within(dialog).getByText(FREE_AGENT.name)).toBeInTheDocument();
        expect(within(dialog).getByText(TAKEN.name)).toBeInTheDocument();
        expect(within(dialog).getByText('Taken')).toBeInTheDocument();

        // Read-only: recording a pick from here has no unambiguous target
        // pick to attach to, so there is no Add pill for the untaken player
        // either - see DraftPanel's own comment on this near its BestAvailable
        // usage.
        expect(within(dialog).queryByRole('button', { name: 'Add' })).toBeNull();
    });

    // The handle used to be swapped out for a flat message strip when there
    // was no list, which left a signed-in user with saved lists no way to
    // reach one from this screen - the switcher that reaches them is inside
    // the sheet the handle opens.
    it('still opens, with a rank-list switcher inside, when no list is selected yet', async () => {
        const user = userEvent.setup();
        renderPanel({ rankingPlayersIdsList: [] });

        const handle = screen.getByRole('button', { name: /Best available/ });
        expect(handle).toHaveTextContent('Paste a rank list');

        await user.click(handle);
        const dialog = screen.getByRole('dialog', { name: 'Best available' });

        expect(within(dialog).getByRole('button', { name: /^Rank list/ })).toBeInTheDocument();
        expect(within(dialog).getByText(/No rank list selected/)).toBeInTheDocument();
    });

    it('reads a saved list picked from the switcher rather than the empty session list', async () => {
        const user = userEvent.setup();
        renderPanel({
            rankingPlayersIdsList: [],
            signedIn: true,
            savedRankLists: {
                default: { pretty_name: '-- Select saved ranks list', route_name: 'default' },
                my_ranks: {
                    pretty_name: 'My Rankings',
                    route_name: 'my_ranks',
                    rank_list: [rankEntry(FREE_AGENT.id)],
                },
            },
        });

        await user.click(screen.getByRole('button', { name: /Best available/ }));
        await user.click(screen.getByRole('button', { name: /^Rank list/ }));
        await user.click(screen.getByRole('button', { name: /^My Rankings/ }));

        const dialog = screen.getByRole('dialog', { name: 'Best available' });
        expect(within(dialog).getByText(FREE_AGENT.name)).toBeInTheDocument();
    });
});

// The wiring seam: useSeenPicks lives in DraftPanel, and every piece below it
// takes newPickKeys as a prop with an empty-Set default. That default means
// unthreading the prop anywhere between the hook and PickRow leaves the whole
// component suite green - the feature silently does nothing while every unit
// still passes. These two tests are the only place the assembled path is
// exercised, so they run against real timers and userEvent rather than the
// fake-timer harness above, which nothing here needs.
describe('DraftPanel new-pick markers', () => {
    const ROUND_NUMBER = builtDraft[0].round;
    const STORAGE_KEY = `sleeper-app:seen-picks:${DRAFT_ID}`;

    // A one-round board with the given pick numbers filled in, so "made" and
    // "seen" can be varied independently. The fixture's own board has no made
    // picks at all, which is why nothing is filled in by default.
    const boardWith = (madePickNumbers) => [
        {
            ...builtDraft[0],
            picks: builtDraft[0].picks.map((pick) => ({
                ...pick,
                player_id: madePickNumbers.includes(pick.pick_number) ? FREE_AGENT.id : null,
            })),
        },
    ];

    it('marks picks made since the stored snapshot, and counts them in the round header', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([`${ROUND_NUMBER}.1`]));

        renderPanel({
            leagueData: {
                currentDraft: {
                    draft_id: DRAFT_ID,
                    season: '2026',
                    player_pool: 'Rookie',
                    status: 'drafting',
                    start_time: DRAFT_BASE_TIME,
                    last_picked: null,
                    settings: { pick_timer: 30 },
                    built_draft: boardWith([1, 2, 3]),
                },
                rosterData,
            },
        });

        // Picks 2 and 3 were made after the stored snapshot; pick 1 is in it.
        expect(screen.getAllByText('NEW')).toHaveLength(2);
        expect(screen.getByText('2 new')).toBeVisible();
    });

    it('does not mark a pick the user just made themselves', async () => {
        const user = userEvent.setup();
        // A first visit with a board that already has pick 1 made: nothing is
        // new, which is the state a manual pick has to leave intact.
        const currentDraft = {
            draft_id: DRAFT_ID,
            season: '2026',
            player_pool: 'Rookie',
            status: 'drafting',
            start_time: DRAFT_BASE_TIME,
            last_picked: null,
            settings: { pick_timer: 30 },
            built_draft: boardWith([1]),
        };

        // updateDraftBoard has to really apply the reducer here. With the usual
        // vi.fn() the board never changes, so no chip could appear whatever
        // markSeen did and the test would pass vacuously.
        const StatefulPanel = () => {
            const [board, setBoard] = useState(currentDraft.built_draft);
            return (
                <DraftPanel
                    leagueData={{ currentDraft: { ...currentDraft, built_draft: board }, rosterData }}
                    playerInfo={playerInfo}
                    rosterInfo={rosterInfo}
                    rankingPlayersIdsList={[rankEntry(FREE_AGENT.id)]}
                    updateDraftBoard={(reducer) => setBoard((prev) => reducer(prev))}
                />
            );
        };
        render(<StatefulPanel />);

        expect(screen.queryByText('NEW')).toBeNull();

        await user.click(screen.getByRole('button', { name: new RegExp(`pick 2,`) }));
        const modal = screen.getByRole('dialog', { name: /^Manually select pick/ });
        await user.click(within(modal).getByText(new RegExp(FREE_AGENT.name)));

        // The board really did update - without this the assertion below is
        // just re-checking a board that never changed.
        const filledRow = screen.getByRole('button', { name: new RegExp(`pick 2,.*${FREE_AGENT.name}`) });
        expect(filledRow).toBeInTheDocument();

        expect(screen.queryByText('NEW')).toBeNull();
        expect(screen.queryByText(/\d+ new/)).toBeNull();
    });
});
