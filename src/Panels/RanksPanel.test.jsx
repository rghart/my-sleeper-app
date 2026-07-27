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
    // branch and no global fetch is needed; ADP resolves empty so the panel
    // renders without an ADP column. Neither touches the filter path.
    const props = {
        isLoading: false,
        signedIn: false,
        playerInfo,
        rosterInfo,
        lineupSet: new Set(),
        updateRankingPlayersIdsList: vi.fn(),
        startLoad: vi.fn(),
        fetchRequest: vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
        checkErrors: vi.fn((response) => response),
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

// The filter controls are <label> elements wrapping a checkbox, so the
// accessible name is what to click rather than the label text node.
const toggle = (user, name) => user.click(screen.getByRole('checkbox', { name }));

const visiblePlayers = () =>
    [FREE_AGENT, OTHERS_PLAYER, MY_PLAYER].filter((p) => screen.queryByText(p.name) !== null).map((p) => p.name);

describe('RanksPanel loading', () => {
    it('shows only the loader while the ranks panel is loading', () => {
        const { container } = renderPanel({ isLoading: true });

        expect(container.querySelector('.panel-loader')).toBeTruthy();
        expect(screen.queryByText(FREE_AGENT.name)).toBeNull();
    });

    it('asks for a search by text alone, without naming a loading state', async () => {
        // startLoad used to take the loading message as its first argument, and
        // RanksPanel passed the literal 'Loading search panel...' - which came
        // straight back down as the prop it then compared against. The panel no
        // longer knows that vocabulary exists.
        const user = userEvent.setup();
        const { startLoad } = renderPanel();

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

        await toggle(user, 'Taken');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, OTHERS_PLAYER.name, MY_PLAYER.name]);
    });

    it('shows only free agents when both Taken and My players are off', async () => {
        renderPanel();

        await toggle(user, 'My players');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name]);
    });

    it('hides my own players when Taken is on but My players is off', async () => {
        // The one branch that reads rosteredBy rather than isTaken: it keeps
        // anything not rostered by me, which is how a manager scouts the rest
        // of the league without their own roster in the way.
        renderPanel();

        await toggle(user, 'Taken');
        await toggle(user, 'My players');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name, OTHERS_PLAYER.name]);
    });

    it('applies the position filters on top of the flag filters', async () => {
        // The position filter runs as a second pass over whatever filterPlayers
        // returned, so turning WR off must not disturb the taken/mine decision
        // for the TE that remains.
        renderPanel();

        await toggle(user, 'WR');

        expect(visiblePlayers()).toEqual([FREE_AGENT.name]);
    });
});
