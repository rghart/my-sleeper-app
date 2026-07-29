import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RanksPanel from './RanksPanel';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// RanksPanel.filterPlayers is the only place the derived flags decide what
// renders at all, and it is a four-branch table over isTaken/rosteredBy rather
// than a single condition. App.test.jsx cannot reach it: the rank list is empty
// there, so every branch is vacuous. Each test below pins one branch, because a
// table that agrees with the real one only in the default state is the likely
// shape of a regression here.

vi.mock('../firebase.js', () => ({
    auth: {
        currentUser: {
            uid: 'test-uid',
            getIdToken: vi.fn().mockResolvedValue('test-id-token'),
        },
    },
    googleProvider: {},
}));

const { rosterDataRaw, managerData, playerInfo } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const MY_DISPLAY_NAME = 'ryangh';

// One player per flag state, all WR/TE so the position filters (which default
// to QB/RB/WR/TE on) never confound the taken/mine assertions.
const FREE_AGENT = { id: '13307', name: 'Marlin Klein' }; // on nobody's roster
const OTHERS_PLAYER = { id: '13294', name: 'Makai Lemon' }; // roster 2, aphilliny21
const MY_PLAYER = { id: '13274', name: 'Germie Bernard' }; // roster 1, mine

const rankEntry = (playerId, ranking) => ({
    match_results: [[playerId, '0.000']],
    ranking: String(ranking),
    search_string: 'a pasted rank line',
});

const rankingPlayersIdsList = [rankEntry(FREE_AGENT.id, 1), rankEntry(OTHERS_PLAYER.id, 2), rankEntry(MY_PLAYER.id, 3)];

function renderPanel(overrides = {}) {
    // signedIn stays false so the saved-rank-lists effect takes its else
    // branch and never fetches. The ADP request still fires on mount and now
    // goes through the real fetchRequest, so it needs a stubbed global fetch
    // rather than an injected mock - which is closer to production than the
    // hand-written stand-in it replaces.
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, statusText: 'OK', json: () => Promise.resolve({}) }));
    const props = {
        isLoading: false,
        signedIn: false,
        playerInfo,
        rosterInfo,
        lineupSet: new Set(),
        updateRankingPlayersIdsList: vi.fn(),
        startLoad: vi.fn(),
        rankingPlayersIdsList,
        addToRoster: vi.fn(),
        updatePlayerId: vi.fn(),
        notFoundPlayers: [],
        myDisplayName: MY_DISPLAY_NAME,
        ...overrides,
    };
    const { container } = render(<RanksPanel {...props} />);
    return { ...props, container };
}

// The paste box moved from the page into a sheet opened by the "Paste list"
// pill (step 6d) - every test that needs the textarea has to open it first.
const openPasteSheet = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Paste list' }));
};

// The four flag toggles (Taken/My players/Only rookies/All players) and the
// ADP type control both moved into the FILTERS popover (step 6e), which
// renders as two trees at once - an anchored desktop popover and a phone
// Sheet, both always in the DOM together the same way AppShell's section nav
// and tab bar are (see RanksPanel.jsx's comment on FiltersDesktopPopover) -
// so every query against something inside it comes back twice. `openFilters`
// is idempotent (checks before clicking) so tests can call it before more
// than one toggle in the same case without accidentally closing it again.
const openFilters = async (user) => {
    if (screen.queryAllByRole('checkbox', { name: 'Taken' }).length === 0) {
        await user.click(screen.getByRole('button', { name: /^FILTERS/ }));
    }
};

// The filter controls are <label> elements wrapping a checkbox, so the
// accessible name is what to click rather than the label text node. Takes
// the first of the two (popover + sheet) matches - see openFilters above.
const toggleFlag = async (user, name) => {
    await openFilters(user);
    await user.click(screen.getAllByRole('checkbox', { name })[0]);
};

// Position chips are plain toggle buttons now (aria-pressed), not checkboxes,
// and they live in the always-visible chip row rather than behind FILTERS -
// see RanksPanel.jsx's positionChipClass/POSITIONS.
const togglePosition = async (user, position) => {
    await user.click(screen.getByRole('button', { name: position }));
};

const visiblePlayers = () =>
    [FREE_AGENT, OTHERS_PLAYER, MY_PLAYER].filter((p) => screen.queryByText(p.name) !== null).map((p) => p.name);

describe('RanksPanel loading', () => {
    it('shows only the loader while the ranks panel is loading', () => {
        renderPanel({ isLoading: true });

        expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeTruthy();
        expect(screen.queryByText(FREE_AGENT.name)).toBeNull();
    });

    it('asks for a search by text alone, without naming a loading state', async () => {
        // startLoad used to take the loading message as its first argument, and
        // RanksPanel passed the literal 'Loading search panel...' - which came
        // straight back down as the prop it then compared against. The panel no
        // longer knows that vocabulary exists.
        const user = userEvent.setup();
        const { startLoad } = renderPanel();

        await openPasteSheet(user);
        await user.type(screen.getByPlaceholderText('Copy + Paste rankings here...'), 'Ja  rr Chase');
        await user.click(screen.getByRole('button', { name: 'Submit' }));

        expect(startLoad).toHaveBeenCalledWith('Ja  rr Chase');
    });
});

describe('RanksPanel player filters', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
    });

    it('shows free agents and my own players by default, and hides everyone elses', async () => {
        // Default filters: showTaken false, showMyPlayers true - the branch a
        // manager actually drafts against.
        renderPanel();

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, MY_PLAYER.name]);
    });

    it('shows every player once Taken is on alongside My players', async () => {
        renderPanel();

        await toggleFlag(user, 'Taken');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, OTHERS_PLAYER.name, MY_PLAYER.name]);
    });

    it('shows only free agents when both Taken and My players are off', async () => {
        renderPanel();

        await toggleFlag(user, 'My players');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name]);
    });

    it('hides my own players when Taken is on but My players is off', async () => {
        // The one branch that reads rosteredBy rather than isTaken: it keeps
        // anything not rostered by me, which is how a manager scouts the rest
        // of the league without their own roster in the way.
        renderPanel();

        await toggleFlag(user, 'Taken');
        await toggleFlag(user, 'My players');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, OTHERS_PLAYER.name]);
    });

    it('applies the position filters on top of the flag filters', async () => {
        // The position filter runs as a second pass over whatever filterPlayers
        // returned, so turning WR off must not disturb the taken/mine decision
        // for the TE that remains.
        renderPanel();

        await togglePosition(user, 'WR');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name]);
    });

    it('marks a filter chip checked once toggled on, and only that one', async () => {
        // The chips are real checkboxes styled as pills (SearchFilterButton),
        // not a from-scratch control - this is the assertion that the
        // Tailwind conversion didn't quietly disconnect `checked` from the
        // underlying input.
        renderPanel();

        await openFilters(user);
        expect(screen.getAllByRole('checkbox', { name: 'Taken' })[0].checked).toBe(false);

        await toggleFlag(user, 'Taken');

        expect(screen.getAllByRole('checkbox', { name: 'Taken' })[0].checked).toBe(true);
        // WR defaults on (see the top-of-file position filter defaults) and is
        // untouched by toggling Taken. It's a button now (aria-pressed), not a
        // checkbox - see togglePosition above.
        expect(screen.getByRole('button', { name: 'WR' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks a position chip pressed once toggled on, with its own position colours', async () => {
        renderPanel();

        expect(screen.getByRole('button', { name: 'K' })).toHaveAttribute('aria-pressed', 'false');

        await togglePosition(user, 'K');

        expect(screen.getByRole('button', { name: 'K' })).toHaveAttribute('aria-pressed', 'true');
        // Off by default and untouched by turning K on.
        expect(screen.getByRole('button', { name: 'WR' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'DEF' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('counts non-default filters on the FILTERS chip, and shows no count when everything is default', async () => {
        renderPanel();

        // Nothing has been touched yet: showTaken/showMyPlayers/
        // showRookiesOnly/showAllPlayers and adpType are all still their
        // initial values, so the chip carries no count.
        expect(screen.getByRole('button', { name: 'FILTERS' })).toBeTruthy();

        await toggleFlag(user, 'Taken');

        expect(screen.getByRole('button', { name: 'FILTERS · 1' })).toBeTruthy();

        await toggleFlag(user, 'Only rookies');

        expect(screen.getByRole('button', { name: 'FILTERS · 2' })).toBeTruthy();

        // My players defaults to true, so turning it off is a third
        // non-default filter, not a fourth toggle back toward zero.
        await toggleFlag(user, 'My players');

        expect(screen.getByRole('button', { name: 'FILTERS · 3' })).toBeTruthy();
    });
});

describe('RanksPanel ADP type picker', () => {
    it('has no ADP type selected by default, then reflects the pressed option, and counts toward FILTERS', async () => {
        // adpType starts as undefined - no `.radio-label.checked` div in the old
        // markup, no `aria-pressed` segment here - and a click should move
        // exactly one segment into the pressed state. The control now lives in
        // the FILTERS popover, which renders twice (desktop popover + phone
        // sheet) - see openFilters/toggleFlag above - so every query takes the
        // first of the two matches.
        const user = userEvent.setup();
        renderPanel();

        await openFilters(user);

        expect(screen.getAllByRole('button', { name: 'Startup' })[0]).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getAllByRole('button', { name: 'Rookie' })[0]).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'FILTERS' })).toBeTruthy();

        await user.click(screen.getAllByRole('button', { name: 'Rookie' })[0]);

        expect(screen.getAllByRole('button', { name: 'Rookie' })[0]).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('button', { name: 'Startup' })[0]).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'FILTERS · 1' })).toBeTruthy();
    });
});
