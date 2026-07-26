import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const { rosterDataRaw, managerData, playerInfo } = rosterFlagsFixture;
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
        // under test; give it a harmless response so it doesn't produce an
        // unhandled rejection.
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
});
