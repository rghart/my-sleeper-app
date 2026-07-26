import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import rosterFlagsFixture from './lib/__fixtures__/roster-flags-2026.json';
import realDraftFixture from './lib/__fixtures__/real-draft-2026.json';

// This test exists to close a specific coverage gap: the whole suite stayed
// green when the `decorateRosters` call was deliberately deleted from
// `App.getLeagueData`. Nothing exercised a real render of `App`, so nothing
// could notice that `roster.manager_display_name` had gone missing. Asserting
// that a manager name resolved from the fixture's `managerData` reaches the
// rendered draft board is what makes that deletion fail this test.

vi.mock('./firebase.js', () => ({
    auth: {
        currentUser: {
            isAnonymous: true,
            email: null,
            uid: 'test-uid',
            getIdToken: vi.fn().mockResolvedValue('test-id-token'),
        },
    },
    googleProvider: {},
}));

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn((auth, callback) => {
        // Simplest path: report an already-signed-in (anonymous) user
        // immediately, so App skips the signInAnonymously branch entirely.
        callback({ uid: 'test-uid', isAnonymous: true });
        return () => {};
    }),
    signInAnonymously: vi.fn().mockResolvedValue({ user: { uid: 'test-uid', isAnonymous: true } }),
    signInWithPopup: vi.fn().mockResolvedValue({}),
    signOut: vi.fn().mockResolvedValue({}),
}));

const { rosterDataRaw, managerData, playerInfo, livePicksPartial } = rosterFlagsFixture;
const { currentDraft: draftSettings, tradedDraftPicks } = realDraftFixture;

const LEAGUE_ID = '1312088290526003200';
const DRAFT_ID = 'draft123';

const jsonResponse = (data) => Promise.resolve({ ok: true, statusText: 'OK', json: () => Promise.resolve(data) });

function mockFetch(url) {
    if (url.includes('latest_update_attempt')) {
        return jsonResponse('2026-01-01T00:00:00.000Z');
    }
    if (url.includes('legacy/players')) {
        return jsonResponse(playerInfo);
    }
    if (url.includes('dlf_adp')) {
        // RanksPanel fetches this on mount regardless of the App-level flow
        // under test; give it a successful response so it stays out of the way.
        // The failing case is exercised deliberately in its own test below.
        return jsonResponse({});
    }
    if (url.includes('state/nfl')) {
        return jsonResponse({ league_season: '2026' });
    }
    if (url.includes(`league/${LEAGUE_ID}/rosters/`)) {
        return jsonResponse(structuredClone(rosterDataRaw));
    }
    if (url.includes(`league/${LEAGUE_ID}/users/`)) {
        return jsonResponse(structuredClone(managerData));
    }
    if (url.includes(`league/${LEAGUE_ID}/drafts/`)) {
        return jsonResponse([{ draft_id: DRAFT_ID }]);
    }
    if (url.includes('leagues/nfl/')) {
        return jsonResponse([{ league_id: LEAGUE_ID, name: 'Test League' }]);
    }
    if (url.includes(`league/${LEAGUE_ID}/`)) {
        return jsonResponse({
            league_id: LEAGUE_ID,
            name: 'Test League',
            roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN'],
        });
    }
    if (url.includes(`draft/${DRAFT_ID}/traded_picks/`)) {
        return jsonResponse(structuredClone(tradedDraftPicks));
    }
    if (url.includes(`draft/${DRAFT_ID}`)) {
        return jsonResponse({
            ...structuredClone(draftSettings),
            draft_id: DRAFT_ID,
            season: '2026',
            status: 'drafting',
            draft_order: {},
        });
    }
    return Promise.reject(new Error(`Unhandled fetch url in App.test.jsx: ${url}`));
}

describe('App', () => {
    it('renders a manager display name resolved from managerData on the draft board', async () => {
        global.fetch = vi.fn(mockFetch);

        render(<App />);

        // Roster 1 is owned by managerData's `ryangh`, and slot_to_roster_id in
        // the real-draft fixture assigns board spot 3 to roster 1 in every
        // round (the draft is linear, not snake) - so once the board is built,
        // "ryangh" should show up as a pick owner at least once. This element
        // only exists if `decorateRosters` ran: without it,
        // `roster.manager_display_name` is `undefined` and DraftRound renders
        // "Pick owner missing" or `undefined` instead.
        const ryanghMentions = await screen.findAllByText('ryangh', {}, { timeout: 5000 });
        expect(ryanghMentions.length).toBeGreaterThan(0);
    });

    it('applies every traded pick to the board', async () => {
        global.fetch = vi.fn(mockFetch);

        render(<App />);
        await screen.findAllByText('ryangh', {}, { timeout: 5000 });

        // These mocked fetches resolve immediately, which is the whole point: it
        // leaves React no window to flush a setState between getTradedDraftPicks
        // and buildDraft. When the traded picks were round-tripped through state,
        // buildDraft read the previous value and none of them landed.
        //
        // A traded pick also reads two different rosters - the current owner via
        // pick.owner_id and the original holder via pick.roster_id - so the
        // "<owner> via <originator>" text covers a lookup the assertion above
        // never touches.
        const owners = [...document.querySelectorAll('p.draft-pick')];
        const traded = owners.filter((pick) => pick.textContent.includes(' via '));
        expect(traded).toHaveLength(tradedDraftPicks.length);
        for (const pick of traded) {
            expect(pick.textContent).toMatch(/^\S+ via \S+$/);
        }
    });

    it('keeps a manual pick made while a sync tick is in flight', async () => {
        // Reproduces #96. `getLiveDraft` awaits two fetches and then builds the
        // new board from the `currentDraft` its closure captured, so anything
        // written to the board during those awaits is overwritten.
        //
        // Only the live-picks fetch is gated, and only so the manual pick can be
        // placed inside the window - every other fetch still resolves instantly.
        // This is control over the interleaving, not added latency: real latency
        // is what hid #98, and against the live app this window measured ~50ms,
        // which is precisely why the bug is easy to hit and hard to notice.
        let releaseLivePicks;
        const livePicksGate = new Promise((resolve) => {
            releaseLivePicks = resolve;
        });
        global.fetch = vi.fn((url) => {
            if (url.includes(`draft/${DRAFT_ID}/picks/`)) {
                return livePicksGate.then(() => jsonResponse(structuredClone(livePicksPartial)));
            }
            return mockFetch(url);
        });

        const user = userEvent.setup();
        render(<App />);
        await screen.findAllByText('ryangh', {}, { timeout: 5000 });

        // livePicksPartial covers rounds 1 and 2.1-2.8, so 3.1 is a slot the
        // server has no pick for - the mid-draft case where a manager pencils in
        // a pick the sync can't legitimately overwrite.
        const manualPickBox = screen.getByText('3.1').closest('.draft-pick');

        await user.click(screen.getByRole('button', { name: 'Update' }));

        await user.click(manualPickBox);
        await user.type(screen.getByPlaceholderText('Start typing player name to search'), 'Brady');
        await user.click(await screen.findByText(/Tom Brady/));

        // The pick is on the board before the sync resolves; that is what makes
        // the assertion after the release meaningful rather than vacuous.
        const round3 = manualPickBox.closest('.draft-picks-box');
        expect(within(round3).getByText('Tom Brady')).toBeTruthy();

        releaseLivePicks();

        // The sync landing is the event under test, so wait on its own result
        // rather than on a timer: Jeremiyah Love is live pick 1.1.
        await waitFor(() => expect(screen.getAllByText('Jeremiyah Love').length).toBeGreaterThan(0));

        expect(within(round3).queryByText('Tom Brady')).toBeTruthy();
    });

    it('survives an ADP request that fails', async () => {
        // `RanksPanel.getADP` called `updateResponse.json()` before checking the
        // response, and `App.fetchRequest` returns undefined whenever its own
        // catch swallows an error - which includes any non-ok response, since
        // checkErrors throws on those. So a failing ADP request threw a
        // TypeError out of an async effect: ADP silently never loaded, and the
        // rejection went unhandled.
        const rejections = [];
        const recordRejection = (reason) => rejections.push(reason);
        process.on('unhandledRejection', recordRejection);

        try {
            global.fetch = vi.fn((url) => {
                if (url.includes('dlf_adp')) {
                    return Promise.reject(new Error('ADP service unavailable'));
                }
                return mockFetch(url);
            });

            render(<App />);

            // The rest of the app must still come up: a failed ADP lookup costs
            // the ADP column, nothing else.
            await screen.findAllByText('ryangh', {}, { timeout: 5000 });
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(rejections).toEqual([]);
        } finally {
            process.off('unhandledRejection', recordRejection);
        }
    });
});
