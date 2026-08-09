import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { auth } from './firebase.js';
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

const authMockState = vi.hoisted(() => ({ unsubscribe: null, callback: null, user: null }));

// The user the observer reports. Overridable per test because the app now
// branches on `isAnonymous`: an anonymous visitor's Sleeper account is
// local-only, while a real sign-in also reads the saved copy. Mutating
// `auth.currentUser` alone does not cover it - that object feeds the
// displayed identity, but this one is what the resolution logic receives.
const observedUser = () => authMockState.user || { uid: 'test-uid', isAnonymous: true };

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn((auth, callback) => {
        // Simplest path: report an already-signed-in (anonymous) user
        // immediately, so App skips the signInAnonymously branch entirely.
        authMockState.callback = callback;
        callback({ ...observedUser(), getIdToken: vi.fn().mockResolvedValue('test-id-token') });
        authMockState.unsubscribe = vi.fn();
        return authMockState.unsubscribe;
    }),
    signInAnonymously: vi.fn().mockResolvedValue({ user: { uid: 'test-uid', isAnonymous: true } }),
    signInWithPopup: vi.fn().mockResolvedValue({}),
    signOut: vi.fn().mockResolvedValue({}),
}));

const { rosterDataRaw, managerData, playerInfo, livePicksPartial } = rosterFlagsFixture;
const { currentDraft: draftSettings, tradedDraftPicks } = realDraftFixture;

// The Sleeper account these tests connect as. This was a hardcoded constant in
// the app itself until the app became multi-user; it lives here now because the
// fixture's rosters and managerData are built around this manager.
const SLEEPER_USER_ID = '521035584588267520';
const LEAGUE_ID = '1312088290526003200';
const OTHER_LEAGUE_ID = '9999999999999999999';
const DRAFT_ID = 'draft123';
const OTHER_DRAFT_ID = 'draftOther';
// The clock card's draft-source pill: the only place the active draft id is
// shown now that the raw "Draft ID" input moved into the Draft source sheet.
const SOURCE_PILL = `Draft source: …${DRAFT_ID.slice(-4)}`;

// On roster 1 (mine) in the first league, dropped from every roster in the
// second - so switching leagues must change this player's attribution from
// 'ryangh' to 'Free Agent'.
const SWAPPED_PLAYER = { id: '13274', name: 'Germie Bernard' };

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
    // The second league exists so the dropdown has somewhere to switch to. Its
    // rosters are the same fixture with SWAPPED_PLAYER dropped from every
    // roster, so that player's attribution differs between the two leagues -
    // which is what makes a switch observable in the ranks panel rather than
    // only on the draft board.
    if (/league\/\d+\/rosters\//.test(url)) {
        const rosters = structuredClone(rosterDataRaw);
        if (url.includes(OTHER_LEAGUE_ID)) {
            rosters.forEach((roster) => {
                if (roster.players) {
                    roster.players = roster.players.filter((id) => id !== SWAPPED_PLAYER.id);
                }
            });
        }
        return jsonResponse(rosters);
    }
    if (/league\/\d+\/users\//.test(url)) {
        return jsonResponse(structuredClone(managerData));
    }
    if (/league\/\d+\/drafts\//.test(url)) {
        return jsonResponse([{ draft_id: url.includes(OTHER_LEAGUE_ID) ? OTHER_DRAFT_ID : DRAFT_ID }]);
    }
    if (url.includes('leagues/nfl/')) {
        return jsonResponse([
            { league_id: LEAGUE_ID, name: 'Test League' },
            { league_id: OTHER_LEAGUE_ID, name: 'Other League' },
        ]);
    }
    if (/league\/\d+\/$/.test(url)) {
        return jsonResponse({
            league_id: url.includes(OTHER_LEAGUE_ID) ? OTHER_LEAGUE_ID : LEAGUE_ID,
            name: url.includes(OTHER_LEAGUE_ID) ? 'Other League' : 'Test League',
            roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN'],
        });
    }
    if (/draft\/[\w]+\/traded_picks\//.test(url)) {
        return jsonResponse(structuredClone(tradedDraftPicks));
    }
    if (/draft\/[\w]+$/.test(url)) {
        return jsonResponse({
            ...structuredClone(draftSettings),
            draft_id: url.includes(OTHER_DRAFT_ID) ? OTHER_DRAFT_ID : DRAFT_ID,
            season: '2026',
            status: 'drafting',
            draft_order: {},
        });
    }
    return Promise.reject(new Error(`Unhandled fetch url in App.test.jsx: ${url}`));
}

describe('App', () => {
    // Every test below renders the app expecting a league on screen, which now
    // requires a connected Sleeper account - the id used to be a constant, so
    // there was nothing to set up. `ryangh` is roster 1's owner in the fixture,
    // which is what makes that roster "mine" in the assertions.
    beforeEach(() => {
        window.localStorage.setItem('sleeper.account', JSON.stringify({ userId: SLEEPER_USER_ID, username: 'ryangh' }));
    });

    // Cleared between tests because the app remembers the last league per
    // account: without this, a test that switches leagues would leave the next
    // one opening on the other league.
    afterEach(() => {
        window.localStorage.clear();
    });

    it('renders a manager display name resolved from managerData on the draft board', async () => {
        global.fetch = vi.fn(mockFetch);

        render(<App />);

        // Roster 1 is owned by managerData's `ryangh`, and slot_to_roster_id in
        // the real-draft fixture assigns board spot 3 to roster 1 in every
        // round (the draft is linear, not snake) - so once the board is built,
        // "ryangh" should show up as a pick owner at least once. This element
        // only exists if `decorateRosters` ran: without it,
        // `roster.manager_display_name` is `undefined` and PickRow renders
        // "Pick owner missing" or `undefined` instead. Matched as a substring
        // because roster 1 is also `myDisplayName` here, so PickRow appends
        // " · you" to every mention of it.
        const ryanghMentions = await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        expect(ryanghMentions.length).toBeGreaterThan(0);
    });

    it('applies every traded pick to the board', async () => {
        global.fetch = vi.fn(mockFetch);

        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        // These mocked fetches resolve immediately, which is the whole point: it
        // leaves React no window to flush a setState between getTradedDraftPicks
        // and buildDraft. When the traded picks were round-tripped through state,
        // buildDraft read the previous value and none of them landed.
        //
        // A traded pick also reads two different rosters - the current owner via
        // pick.owner_id and the original holder via pick.roster_id - so the
        // "<owner> via <originator>" text covers a lookup the assertion above
        // never touches.
        const traded = screen.getAllByRole('button', { name: /via/ });
        expect(traded).toHaveLength(tradedDraftPicks.length);
        for (const pick of traded) {
            expect(pick.getAttribute('aria-label')).toMatch(/\S+ via \S+/);
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
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        // livePicksPartial covers rounds 1 and 2.1-2.8, so 3.01 is a slot the
        // server has no pick for - the mid-draft case where a manager pencils in
        // a pick the sync can't legitimately overwrite.
        const manualPickBox = screen.getByText('3.01').closest('button');

        await user.click(screen.getByRole('button', { name: 'Sync draft' }));

        await user.click(manualPickBox);
        await user.type(screen.getByPlaceholderText('Start typing player name to search'), 'Brady');
        await user.click(await screen.findByText(/Tom Brady/));

        // The pick is on the board before the sync resolves; that is what makes
        // the assertion after the release meaningful rather than vacuous.
        const round3 = manualPickBox.closest('section');
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

            const user = userEvent.setup();
            render(<App />);

            // The rest of the app must still come up: a failed ADP lookup costs
            // the ADP column, nothing else.
            await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

            // RanksPanel - and the ADP effect under test - only mounts on the
            // Ranks section now that the wide-screen aside beside Draft/Lineup
            // is the best-available rail rather than a second copy of Ranks
            // (see App.renderBestAvailableRail).
            await user.click(screen.getAllByRole('button', { name: 'Ranks' })[0]);
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(rejections).toEqual([]);
        } finally {
            process.off('unhandledRejection', recordRejection);
            // Every later test in this file assumes it starts on the default
            // section unless it resets the hash itself - leaving this on
            // '#/ranks' would silently change what every subsequent test
            // renders.
            window.location.hash = '';
        }
    });

    it('survives a draft request that fails', async () => {
        // getSpecificDraft's own catch resolves draftData to undefined on a
        // failed fetch, and DraftPanel reads currentDraft.draft_id
        // unconditionally to label the clock card's draft-source pill - so
        // this only passes if currentDraft fell back to a real object instead
        // of crashing the render.
        const rejections = [];
        const recordRejection = (reason) => rejections.push(reason);
        process.on('unhandledRejection', recordRejection);

        try {
            global.fetch = vi.fn((url) => {
                if (url.includes(`draft/${DRAFT_ID}/traded_picks/`)) {
                    return mockFetch(url);
                }
                if (url.includes(`draft/${DRAFT_ID}`)) {
                    return Promise.reject(new Error('Draft service unavailable'));
                }
                return mockFetch(url);
            });

            render(<App />);

            expect(await screen.findByRole('button', { name: SOURCE_PILL }, { timeout: 5000 })).toBeTruthy();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(rejections).toEqual([]);
        } finally {
            process.off('unhandledRejection', recordRejection);
        }
    });

    it('shows a full-page loader, and neither panel, until the league data arrives', async () => {
        // The initial-load branch used to be guarded by `isLoading &&
        // loadingMessage === 'Initial load...'` and is now a single enum
        // check. Nothing rendered App before its data settled, so which of
        // those two conditions was doing the work was never observable.
        let releaseLeague;
        const leagueGate = new Promise((resolve) => {
            releaseLeague = resolve;
        });
        global.fetch = vi.fn((url) => {
            if (url.includes(`league/${LEAGUE_ID}/rosters/`)) {
                return leagueGate.then(() => mockFetch(url));
            }
            return mockFetch(url);
        });

        render(<App />);

        // The whole-page loader is distinct from the per-panel loader the two
        // panels render, but both are now the same Spinner component, so the
        // page one is told apart by its accessible name.
        await waitFor(() => expect(screen.queryByRole('progressbar', { name: 'Loading your leagues' })).toBeTruthy());
        expect(screen.queryByText('Team Assistant')).toBeNull();

        releaseLeague();

        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        expect(screen.queryByRole('progressbar', { name: 'Loading your leagues' })).toBeNull();
    });

    it('shows the league panel loader while a league switch is in flight', async () => {
        // The only path where the league-panel loading state earns its keep.
        // On the initial load it is redundant - the full-page loader already
        // suppresses both panels until the board is built, so never entering
        // it changes nothing observable. On a switch, App is already past that
        // branch, and without this state LeaguePanel would render against
        // half-replaced league data.
        let releaseSecondLeague;
        const gate = new Promise((resolve) => {
            releaseSecondLeague = resolve;
        });
        let gated = false;
        global.fetch = vi.fn((url) => {
            if (url.includes(`league/${OTHER_LEAGUE_ID}/rosters/`) && !gated) {
                gated = true;
                return gate.then(() => mockFetch(url));
            }
            return mockFetch(url);
        });

        const user = userEvent.setup();
        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        // LeaguePanel and RanksPanel are the only two panels that render a
        // panel-sized Spinner (labelled "Loading", as opposed to the
        // full-page one labelled "Loading your leagues"), and their loading
        // states are mutually exclusive - so during a league switch this can
        // only be LeaguePanel's, with no container class needed to scope to.
        const leaguePanelLoader = () => screen.queryByRole('progressbar', { name: 'Loading' });
        expect(leaguePanelLoader()).toBeNull();

        await user.selectOptions(screen.getByDisplayValue('Test League'), OTHER_LEAGUE_ID);

        await waitFor(() => expect(leaguePanelLoader()).toBeTruthy());
        // The full-page loader is a different thing and must not come back:
        // a league switch replaces one panel, it does not restart the app.
        expect(screen.queryByRole('progressbar', { name: 'Loading your leagues' })).toBeNull();

        releaseSecondLeague();

        await waitFor(() => expect(leaguePanelLoader()).toBeNull());
        expect(screen.getAllByText(/ryangh/).length).toBeGreaterThan(0);
    });

    it('recomputes roster attribution in the ranks panel after a league switch', async () => {
        // Characterization test, written before touching anything: getLeagueData
        // ends with a spread of rankingPlayersIdsList into a new array whose
        // only purpose is to force a re-render. It looks vestigial - the flags
        // are derived from leagueData.rosterData now, which changes identity on
        // a switch - but nothing covered this path, so the question could not
        // be answered by reading. This test answers it either way.
        global.fetch = vi.fn(mockFetch);

        const user = userEvent.setup();
        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        // RanksPanel only mounts on the Ranks section now that the
        // wide-screen aside beside Draft/Lineup is the best-available rail
        // rather than a second copy of Ranks (see App.renderBestAvailableRail).
        await user.click(screen.getAllByRole('button', { name: 'Ranks' })[0]);

        // The paste box moved into a sheet opened by the "Paste list" pill
        // (step 6d) - open it before reaching for the textarea.
        await user.click(screen.getByRole('button', { name: 'Paste list' }));
        await user.type(screen.getByPlaceholderText('Copy + Paste rankings here...'), `1. ${SWAPPED_PLAYER.name}`);
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        // PlayerInfoItem's row carries availability in its accessible name now
        // (see playerInfoLabels.js) rather than in a `.team-name` element, so
        // this reads the row's aria-label instead of a class-scoped text node.
        const attribution = async () => {
            await screen.findByText(SWAPPED_PLAYER.name);
            const row = screen.getByRole('group', { name: new RegExp(`^${SWAPPED_PLAYER.name}, `) });
            return row.getAttribute('aria-label');
        };

        expect(await attribution()).toContain('taken by ryangh');

        // The Ranks section's top-bar pill is the rank list, not the league,
        // while RanksPanel is mounted (step 6a) - the league switcher is
        // reachable again from another section, so switch there and back
        // rather than expecting a league combobox on this one.
        await user.click(screen.getAllByRole('button', { name: 'Draft' })[0]);
        await user.selectOptions(screen.getByDisplayValue('Test League'), OTHER_LEAGUE_ID);
        await user.click(screen.getAllByRole('button', { name: 'Ranks' })[0]);

        // The second league has this player on nobody's roster, so the derived
        // flags must follow the new league rather than keeping the stale name.
        await waitFor(async () => expect(await attribution()).toContain('free agent'));

        // Every later test in this file assumes it starts on the default
        // section unless it resets the hash itself.
        window.location.hash = '';
    });

    it('checks rosters against a player database that has actually loaded', async () => {
        // warnAboutMissingRosterPlayers used to read this.state.playerInfo,
        // written by the setState immediately before the call. With
        // instantly-resolving fetches that setState has not flushed, so the
        // check ran against an empty database and warned about every player in
        // the league - another instance of the read-before-flush class (#96,
        // #98). playerInfo is threaded through as an argument now.
        const warnings = [];
        vi.spyOn(console, 'warn').mockImplementation((message) => {
            if (String(message).includes("Can't find player ID")) {
                warnings.push(message);
            }
        });

        try {
            global.fetch = vi.fn(mockFetch);
            render(<App />);
            await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

            // Derived from the fixture rather than hardcoded: it is trimmed, so
            // some roster players are legitimately absent from the player DB.
            const rosterPlayerIds = rosterDataRaw.flatMap((roster) => roster.players || []);
            const known = new Set(Object.keys(playerInfo));
            const legitimatelyMissing = rosterPlayerIds.filter((id) => !known.has(id));

            // The assertion only means something if the fixture actually knows
            // about some roster players - otherwise both the correct and the
            // stale read would produce the same count.
            expect(legitimatelyMissing.length).toBeLessThan(rosterPlayerIds.length);
            expect(warnings).toHaveLength(legitimatelyMissing.length);
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('shows a retryable error instead of a blank page when the league load fails', async () => {
        // Nothing covered a failed league bundle, and the app rendered a blank
        // page: loadLeague bailed to LOADING.NONE, render ran with leagueData
        // still empty, and buildRosterInfo threw on undefined rosterData.
        // Before the load chain was reworked this was an infinite spinner
        // instead - bad, but not a white screen.
        const rejections = [];
        const recordRejection = (reason) => rejections.push(reason);
        process.on('unhandledRejection', recordRejection);

        try {
            global.fetch = vi.fn((url) => {
                if (/league\/\d+\//.test(url) || url.includes('leagues/nfl/')) {
                    return Promise.reject(new Error('Sleeper unavailable'));
                }
                return mockFetch(url);
            });

            render(<App />);

            const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
            expect(alert.textContent).toMatch(/Couldn't load your league data/);
            expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();

            // The page is not blank and not stuck on a spinner.
            expect(screen.getByText('Team Assistant')).toBeTruthy();
            expect(screen.queryByRole('progressbar')).toBeNull();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(rejections).toEqual([]);
        } finally {
            process.off('unhandledRejection', recordRejection);
        }
    });

    it('does not render the panels when there is no league data to render them from', async () => {
        // LeaguePanel reads leagueData.currentLeague.name unconditionally, so
        // "render the panels anyway" is not an option - this is why the banner
        // replaces them rather than sitting above them.
        global.fetch = vi.fn((url) => {
            if (/league\/\d+\//.test(url) || url.includes('leagues/nfl/')) {
                return Promise.reject(new Error('Sleeper unavailable'));
            }
            return mockFetch(url);
        });

        render(<App />);
        await screen.findByRole('alert', {}, { timeout: 5000 });

        expect(screen.queryByRole('main')).toBeNull();
        expect(screen.queryByPlaceholderText('Copy + Paste rankings here...')).toBeNull();
    });

    it('replaces the panels rather than leaving a board that disagrees with the dropdown', async () => {
        // A league switch that fails leaves the previous league's data in
        // state. Rendering the panels from it would show one league's board
        // under a dropdown reading another - the same confidently-wrong shape
        // the banner exists to avoid. So the banner replaces the panels
        // whenever a load has failed, not only when there is nothing to render.
        global.fetch = vi.fn(mockFetch);
        const user = userEvent.setup();
        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        expect(screen.getByDisplayValue('Test League')).toBeTruthy();

        global.fetch = vi.fn((url) => {
            if (url.includes(OTHER_LEAGUE_ID)) {
                return Promise.reject(new Error('Sleeper unavailable'));
            }
            return mockFetch(url);
        });
        await user.selectOptions(screen.getByDisplayValue('Test League'), OTHER_LEAGUE_ID);

        await screen.findByRole('alert', {}, { timeout: 5000 });
        expect(screen.queryByRole('main')).toBeNull();
    });

    it('recovers when Retry succeeds', async () => {
        // Only the league load is retried; the player database is already in
        // memory and is not what failed.
        let failLeague = true;
        global.fetch = vi.fn((url) => {
            if (failLeague && (/league\/\d+\//.test(url) || url.includes('leagues/nfl/'))) {
                return Promise.reject(new Error('Sleeper unavailable'));
            }
            return mockFetch(url);
        });

        const user = userEvent.setup();
        render(<App />);
        await screen.findByRole('alert', {}, { timeout: 5000 });

        const playerDbRequestsBefore = global.fetch.mock.calls.filter((call) =>
            call[0].includes('legacy/players'),
        ).length;

        failLeague = false;
        await user.click(screen.getByRole('button', { name: 'Retry' }));

        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        expect(screen.queryByRole('alert')).toBeNull();

        expect(global.fetch.mock.calls.filter((call) => call[0].includes('legacy/players')).length).toBe(
            playerDbRequestsBefore,
        );
    });

    it('clears the error when a load triggered by anything other than Retry succeeds', async () => {
        // Retry clears the banner itself, so the clear on the success path is
        // only observable through the other caller: the auth callback, which
        // re-runs loadLeague whenever auth state changes - signing in, for
        // instance. Without it the banner would sit on screen next to a fully
        // working set of panels.
        let failLeague = true;
        global.fetch = vi.fn((url) => {
            if (failLeague && (/league\/\d+\//.test(url) || url.includes('leagues/nfl/'))) {
                return Promise.reject(new Error('Sleeper unavailable'));
            }
            return mockFetch(url);
        });

        render(<App />);
        await screen.findByRole('alert', {}, { timeout: 5000 });

        failLeague = false;
        await act(async () => {
            authMockState.callback({ uid: 'test-uid', isAnonymous: true });
        });

        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        expect(screen.queryByRole('alert')).toBeNull();
    });

    // loadDraft's guard used to check `draft_order`, a field buildDraftRounds
    // never reads. Everything the builder actually dereferences went unchecked,
    // so a malformed or partly-failed draft response threw inside loadDraft -
    // and because nothing catches it, the setState that clears the loader never
    // ran and the app sat on the LEAGUE_PANEL spinner forever. These assert on
    // what reaches the screen, since "it threw" and "it hung" look identical
    // from a unit test of the builder alone.
    describe('a draft response the board cannot be built from', () => {
        const without = (key) => (draft) => {
            const copy = { ...draft };
            delete copy[key];
            return copy;
        };

        const draftOverride = (transform) =>
            vi.fn((url) => {
                if (/draft\/[\w]+$/.test(url)) {
                    return jsonResponse(
                        transform({
                            ...structuredClone(draftSettings),
                            draft_id: DRAFT_ID,
                            season: '2026',
                            status: 'drafting',
                            draft_order: {},
                        }),
                    );
                }
                return mockFetch(url);
            });

        const renderAndSettle = async () => {
            render(<App />);
            // The clock card's draft-source pill renders from currentDraft
            // regardless of whether a board could be built, so it is the signal
            // that the load chain ran to completion rather than throwing
            // partway. (Its eyebrow is not: that reads `ON THE CLOCK` only
            // while a clock is counting, and a draft with no `settings` is
            // untimed, so the eyebrow becomes the season instead.)
            return await screen.findByRole('button', { name: SOURCE_PILL }, { timeout: 5000 });
        };

        it('renders the panels when the draft response has no settings', async () => {
            global.fetch = draftOverride(without('settings'));

            await renderAndSettle();

            expect(screen.getByRole('button', { name: SOURCE_PILL })).toBeInTheDocument();
            // No board, but a live app rather than a permanent loader.
            expect(screen.queryAllByRole('button', { name: /^Round \d+, pick \d+/ }).length).toBe(0);
        });

        it('renders the panels when the draft response has no slot_to_roster_id', async () => {
            global.fetch = draftOverride(without('slot_to_roster_id'));

            await renderAndSettle();

            expect(screen.getByRole('button', { name: SOURCE_PILL })).toBeInTheDocument();
            expect(screen.queryAllByRole('button', { name: /^Round \d+, pick \d+/ }).length).toBe(0);
        });
    });

    it('builds the board without trades when the traded-picks request fails', async () => {
        // fetchTradedDraftPicks resolves to undefined on failure and
        // buildDraftRounds forEaches over it, so this used to throw inside
        // loadDraft and hang the app on the loader. Trades are an overlay on a
        // board that renders fine without them.
        global.fetch = vi.fn((url) => {
            if (/draft\/[\w]+\/traded_picks\//.test(url)) {
                return Promise.reject(new Error('simulated traded_picks failure'));
            }
            return mockFetch(url);
        });

        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        // The board is fully built...
        expect(screen.queryAllByRole('button', { name: /^Round \d+, pick \d+/ }).length).toBeGreaterThan(0);
        // ...and carries no trade attribution, since that is what failed. The
        // successful case asserts the opposite in 'applies every traded pick to
        // the board' above, so this is not vacuous.
        expect(screen.queryByText(/ via /)).toBeNull();
    });

    it('shows a warning notice when the traded-picks request fails but the board builds', async () => {
        global.fetch = vi.fn((url) => {
            if (/draft\/[\w]+\/traded_picks\//.test(url)) {
                return Promise.reject(new Error('simulated traded_picks failure'));
            }
            return mockFetch(url);
        });

        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        expect(screen.queryAllByRole('button', { name: /^Round \d+, pick \d+/ }).length).toBeGreaterThan(0);
        expect(await screen.findByRole('status', {}, { timeout: 5000 })).toHaveTextContent(
            "Couldn't load traded draft picks",
        );
    });

    it('does not show the traded-picks notice on a fully successful load', async () => {
        global.fetch = vi.fn(mockFetch);

        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        expect(screen.queryByRole('status')).toBeNull();
    });

    it('does not show the traded-picks notice when the board could not be built at all', async () => {
        // A draft response missing `settings` means canBuild is false, so a
        // failed traded-picks request alongside it would just be noise on top
        // of an already-empty board.
        global.fetch = vi.fn((url) => {
            if (/draft\/[\w]+\/traded_picks\//.test(url)) {
                return Promise.reject(new Error('simulated traded_picks failure'));
            }
            if (/draft\/[\w]+$/.test(url)) {
                const copy = {
                    ...structuredClone(draftSettings),
                    draft_id: DRAFT_ID,
                    season: '2026',
                    status: 'drafting',
                    draft_order: {},
                };
                delete copy.settings;
                return jsonResponse(copy);
            }
            return mockFetch(url);
        });

        // The clock card renders whether or not a board could be built, so its
        // draft-source pill is the signal the load chain finished.
        render(<App />);
        await screen.findByRole('button', { name: SOURCE_PILL }, { timeout: 5000 });

        expect(screen.queryAllByRole('button', { name: /^Round \d+, pick \d+/ }).length).toBe(0);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('retries only the draft load and clears the notice when Retry succeeds', async () => {
        let failTradedPicks = true;
        global.fetch = vi.fn((url) => {
            if (failTradedPicks && /draft\/[\w]+\/traded_picks\//.test(url)) {
                return Promise.reject(new Error('simulated traded_picks failure'));
            }
            return mockFetch(url);
        });

        const user = userEvent.setup();
        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        await screen.findByRole('status', {}, { timeout: 5000 });

        const playerDbRequestsBefore = global.fetch.mock.calls.filter((call) =>
            call[0].includes('legacy/players'),
        ).length;
        const rostersRequestsBefore = global.fetch.mock.calls.filter((call) => call[0].includes('/rosters/')).length;

        failTradedPicks = false;
        await user.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
        expect(screen.getAllByText(/ via /).length).toBeGreaterThan(0);

        expect(global.fetch.mock.calls.filter((call) => call[0].includes('legacy/players')).length).toBe(
            playerDbRequestsBefore,
        );
        expect(global.fetch.mock.calls.filter((call) => call[0].includes('/rosters/')).length).toBe(
            rostersRequestsBefore,
        );
    });

    // The season-aware default has to be read from data that exists when the
    // shell first mounts. The obvious source - `currentDraft.status` - is
    // filled by loadDraft, which resolves a render later, so the default was
    // computed from `undefined` and the setting never took effect on the one
    // load it exists for. The draft's status is already in the league bundle's
    // drafts list, which is why that is what App reads.
    it('opens on Lineup when the current league draft is already complete', async () => {
        window.location.hash = '';
        global.fetch = vi.fn((url) => {
            if (/league\/\d+\/drafts\//.test(url)) {
                return jsonResponse([{ draft_id: DRAFT_ID, status: 'complete' }]);
            }
            return mockFetch(url);
        });

        render(<App />);

        // The same section buttons render twice - once in the phone tab bar,
        // once as pills in the top bar for md and up - so a name alone no
        // longer picks out a single button.
        const lineupTabs = await screen.findAllByRole('button', { name: 'Lineup' }, { timeout: 5000 });
        await waitFor(() => lineupTabs.forEach((tab) => expect(tab).toHaveAttribute('aria-current', 'page')));
    });

    it('opens on Draft while the draft is still running', async () => {
        window.location.hash = '';
        global.fetch = vi.fn((url) => {
            if (/league\/\d+\/drafts\//.test(url)) {
                return jsonResponse([{ draft_id: DRAFT_ID, status: 'drafting' }]);
            }
            return mockFetch(url);
        });

        render(<App />);

        const draftTabs = await screen.findAllByRole('button', { name: 'Draft' }, { timeout: 5000 });
        await waitFor(() => draftTabs.forEach((tab) => expect(tab).toHaveAttribute('aria-current', 'page')));
    });

    it('re-derives the default section when the league is switched', async () => {
        // The default is not a one-off decision taken at mount: switching to a
        // league whose draft is finished should land on Lineup, and this is
        // the case that a hook holding the resolved section in state gets
        // wrong, because nothing remounts on a league switch.
        window.location.hash = '';
        global.fetch = vi.fn((url) => {
            if (/league\/\d+\/drafts\//.test(url)) {
                return url.includes(OTHER_LEAGUE_ID)
                    ? jsonResponse([{ draft_id: OTHER_DRAFT_ID, status: 'complete' }])
                    : jsonResponse([{ draft_id: DRAFT_ID, status: 'drafting' }]);
            }
            return mockFetch(url);
        });

        const user = userEvent.setup();
        render(<App />);

        const draftTabs = await screen.findAllByRole('button', { name: 'Draft' }, { timeout: 5000 });
        await waitFor(() => draftTabs.forEach((tab) => expect(tab).toHaveAttribute('aria-current', 'page')));

        await user.selectOptions(screen.getByRole('combobox'), OTHER_LEAGUE_ID);

        await waitFor(() =>
            screen
                .getAllByRole('button', { name: 'Lineup' })
                .forEach((tab) => expect(tab).toHaveAttribute('aria-current', 'page')),
        );
    });

    it('unsubscribes from auth state changes on unmount', async () => {
        global.fetch = vi.fn(mockFetch);

        const { unmount } = render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        expect(authMockState.unsubscribe).toEqual(expect.any(Function));
        expect(authMockState.unsubscribe).not.toHaveBeenCalled();

        unmount();

        expect(authMockState.unsubscribe).toHaveBeenCalledTimes(1);
    });
});

// The app was single-tenant until this feature: the Sleeper account was a
// constant, so "nobody has connected one" was not a state that could exist.
// These cover the states that constant used to make unreachable.
describe('App, connecting a Sleeper account', () => {
    afterEach(() => {
        window.localStorage.clear();
        auth.currentUser.isAnonymous = true;
        auth.currentUser.email = null;
        authMockState.user = null;
    });

    // Signs in for real, on both the object the app displays identity from and
    // the one the observer hands to the account-resolution logic.
    const signIn = () => {
        auth.currentUser.isAnonymous = false;
        auth.currentUser.email = 'ryan@example.com';
        authMockState.user = { uid: 'test-uid', isAnonymous: false };
    };

    const connectFetch = (url) => {
        if (/v1\/user\/[^/]+$/.test(url)) {
            return jsonResponse({ user_id: SLEEPER_USER_ID, display_name: 'ryangh' });
        }
        return mockFetch(url);
    };

    it('asks for a Sleeper username when no account is connected', async () => {
        global.fetch = vi.fn(connectFetch);

        render(<App />);

        expect(await screen.findByLabelText(/sleeper username/i)).toBeInTheDocument();
        // The whole point of the screen: there is no league to show behind it.
        expect(screen.queryByText(/ryangh/)).not.toBeInTheDocument();
    });

    it('loads the account’s leagues once a username is connected', async () => {
        global.fetch = vi.fn(connectFetch);

        render(<App />);
        const user = userEvent.setup();
        await user.type(await screen.findByLabelText(/sleeper username/i), 'ryangh');
        await user.click(screen.getByRole('button', { name: /^connect$/i }));

        expect(await screen.findAllByText(/ryangh/, {}, { timeout: 5000 })).not.toHaveLength(0);
        // Every league request must be built from the resolved id, not from
        // any surviving constant.
        expect(global.fetch.mock.calls.some(([url]) => url.includes(`/user/${SLEEPER_USER_ID}/leagues/`))).toBe(true);
    });

    it('keeps the account across a reload, so it is only typed once', async () => {
        global.fetch = vi.fn(connectFetch);

        const first = render(<App />);
        const user = userEvent.setup();
        await user.type(await screen.findByLabelText(/sleeper username/i), 'ryangh');
        await user.click(screen.getByRole('button', { name: /^connect$/i }));
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        first.unmount();

        render(<App />);

        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        expect(screen.queryByLabelText(/sleeper username/i)).not.toBeInTheDocument();
    });

    // A failed league-list request and an account genuinely in no leagues both
    // end with no league to open, and it is tempting to render one message for
    // both. Telling someone mid-outage that they are in no leagues is wrong
    // and leaves them nothing to do about it.
    it('separates an account in no leagues from a Sleeper that would not answer', async () => {
        window.localStorage.setItem('sleeper.account', JSON.stringify({ userId: SLEEPER_USER_ID, username: 'ryangh' }));
        global.fetch = vi.fn((url) => (url.includes('leagues/nfl/') ? jsonResponse([]) : mockFetch(url)));

        const empty = render(<App />);
        expect(await screen.findByText(/isn't in any leagues/i, {}, { timeout: 5000 })).toBeInTheDocument();
        empty.unmount();

        // Only the *first* league-list request fails, and every other request
        // succeeds - including ones for a league id of `undefined`.
        //
        // Both of those are load-bearing. The league list is fetched twice on
        // this path (once to choose a league, once inside the league bundle),
        // so failing it outright fails the bundle too, and code that ignored
        // the first failure still reached this same message by falling through
        // into a bundle that then failed for its own reasons. Failing only the
        // first, and serving the fallthrough's `league/undefined/` requests,
        // means the message can only appear if the failed list was caught
        // where it happened.
        let leagueListCalls = 0;
        global.fetch = vi.fn((url) => {
            if (url.includes('leagues/nfl/')) {
                leagueListCalls += 1;
                if (leagueListCalls === 1) {
                    return Promise.reject(new Error('Sleeper down'));
                }
            }
            return mockFetch(url.replace('league/undefined/', `league/${LEAGUE_ID}/`));
        });

        render(<App />);
        expect(await screen.findByText(/Couldn't load your league data/i, {}, { timeout: 5000 })).toBeInTheDocument();
    });

    // Roaming is the only reason the account is saved server-side, so the
    // saved copy has to beat whatever this particular device had stored.
    it('follows the signed-in account rather than the one left on this device', async () => {
        window.localStorage.setItem('sleeper.account', JSON.stringify({ userId: '999', username: 'someone-else' }));
        signIn();

        global.fetch = vi.fn((url) => {
            if (url.includes('/users/test-uid/sleeper_account')) {
                return jsonResponse({ userId: SLEEPER_USER_ID, username: 'ryangh' });
            }
            if (url.includes('/users/test-uid')) {
                return jsonResponse({});
            }
            return connectFetch(url);
        });

        render(<App />);

        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });
        expect(global.fetch.mock.calls.some(([url]) => url.includes(`/user/${SLEEPER_USER_ID}/leagues/`))).toBe(true);
        expect(global.fetch.mock.calls.some(([url]) => url.includes('/user/999/leagues/'))).toBe(false);
    });

    // The saved account lives in the same `users/{uid}` record as every saved
    // rank list, so an unfiltered read turns it into a phantom list in the
    // switcher - one with no pretty_name, which renders as "dunno".
    it('does not mistake the saved account for a saved rank list', async () => {
        window.localStorage.setItem('sleeper.account', JSON.stringify({ userId: SLEEPER_USER_ID, username: 'ryangh' }));
        signIn();

        global.fetch = vi.fn((url) => {
            if (url.includes('/users/test-uid/sleeper_account')) {
                return jsonResponse({ userId: SLEEPER_USER_ID, username: 'ryangh' });
            }
            if (url.includes('/users/test-uid')) {
                return jsonResponse({
                    sleeper_account: { userId: SLEEPER_USER_ID, username: 'ryangh' },
                    my_ranks: { pretty_name: 'My Ranks', route_name: 'my_ranks' },
                });
            }
            return connectFetch(url);
        });

        render(<App />);
        await screen.findAllByText(/ryangh/, {}, { timeout: 5000 });

        // The switcher only exists on the Ranks section - RanksPanel is what
        // publishes the list it renders from - so asserting anywhere else
        // passes no matter what the map contains.
        await userEvent.setup().click(screen.getAllByRole('button', { name: 'Ranks' })[0]);
        const switcher = await screen.findByRole('combobox', { name: 'Rank list' });

        // Every option is a real saved list: the placeholder and the one list
        // this user has. An unfiltered read adds a third for the account,
        // labelled "dunno" because it has no pretty_name.
        expect([...switcher.options].map((option) => option.text)).toEqual(['-- Select saved ranks list', 'My Ranks']);
    });
});
