import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaguePanel from './LeaguePanel';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// LeaguePanel is a router: it owns which of the two sub-panels is showing, and
// the weekly lineup is the only view rendered nowhere else. App.test.jsx never
// leaves the draft tab, so the weekly branch and the tab switch itself had no
// coverage at all.

const { rosterDataRaw, managerData, playerInfo, builtDraft } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const LEAGUE_ID = '1312088290526003200';
const OTHER_LEAGUE_ID = '9999999999999999999';
const STARTER = { id: '13274', name: 'Germie Bernard' };

// roster_text is written onto the player by lib/roster.js when a player is
// added to a lineup; the fixture holds the undecorated player database, so the
// decoration is applied here rather than in the fixture file.
const lineupPlayerInfo = {
    ...playerInfo,
    [STARTER.id]: { ...playerInfo[STARTER.id], roster_text: 'WR' },
};

// Index 1 is the only filled slot; the bare labels around it are what
// distinguishes a real starter from an empty position.
const ROSTER_POSITIONS = ['QB', STARTER.id, 'FLX'];

function renderPanel(overrides = {}) {
    const updateLeagueID = vi.fn();
    const removeFromLineup = vi.fn();
    const props = {
        leagueData: {
            currentLeague: { name: 'Test League' },
            leagueIds: [
                { league_id: LEAGUE_ID, name: 'Test League' },
                { league_id: OTHER_LEAGUE_ID, name: '4 QB Madness' },
            ],
            currentDraft: {
                draft_id: 'draft123',
                season: '2026',
                player_pool: 'Rookie',
                status: 'drafting',
                built_draft: builtDraft,
            },
            rosterData,
        },
        playerInfo: lineupPlayerInfo,
        rosterInfo,
        updateLeagueID,
        rosterPositions: ROSTER_POSITIONS,
        leagueID: LEAGUE_ID,
        loadingMessage: '',
        removeFromLineup,
        rankingPlayersIdsList: [],
        updateDraftBoard: vi.fn(),
        ...overrides,
    };
    const { container } = render(<LeaguePanel {...props} />);
    return { updateLeagueID, removeFromLineup, container };
}

const draftPanelShowing = () => screen.queryByRole('button', { name: 'Sync draft' }) !== null;

describe('LeaguePanel', () => {
    let user;

    beforeEach(() => {
        user = userEvent.setup();
        global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
    });

    it('shows only the loader while the league panel is loading', () => {
        const { container } = renderPanel({ loadingMessage: 'Loading league panel...' });

        expect(container.querySelector('.panel-loader')).toBeTruthy();
        expect(screen.queryByText('Test League')).toBeNull();
        expect(draftPanelShowing()).toBe(false);
    });

    it('opens on the draft tab', () => {
        renderPanel();

        expect(draftPanelShowing()).toBe(true);
        expect(screen.queryByText(STARTER.name)).toBeNull();
    });

    it('swaps the draft panel for the weekly lineup and back', async () => {
        renderPanel();

        await user.click(screen.getByText('Weekly'));
        expect(draftPanelShowing()).toBe(false);
        expect(screen.getAllByText(STARTER.name).length).toBeGreaterThan(0);

        // Switching back matters as much as switching away: the board used to
        // live in DraftPanel's own state, so a round trip through Weekly lost
        // every pick. It is App's state now, but the round trip is the thing
        // that exposed it.
        await user.click(screen.getByText('Draft'));
        expect(draftPanelShowing()).toBe(true);
        expect(screen.queryByText(STARTER.name)).toBeNull();
    });

    it('renders filled lineup slots as players and empty ones as bare position labels', async () => {
        const { container } = renderPanel();

        await user.click(screen.getByText('Weekly'));

        const slots = [...container.querySelectorAll('.lineup-position')];
        expect(slots).toHaveLength(ROSTER_POSITIONS.length);

        // A filled slot takes its class from the player's position rather than
        // from the raw entry, which is what colours it on screen.
        expect(slots[1].className).toContain(lineupPlayerInfo[STARTER.id].position);
        expect(slots[1].textContent).toContain(STARTER.name);
        // Doubled because the slot renders a full-text and an abbr-text span,
        // one of which CSS hides depending on viewport width.
        expect(slots[0].textContent).toBe('QBQB');
        expect(slots[2].textContent).toBe('FLXFLX');
    });

    it('removes a player from the lineup by slot index, and ignores clicks on empty slots', async () => {
        const { removeFromLineup, container } = renderPanel();

        await user.click(screen.getByText('Weekly'));
        const slots = [...container.querySelectorAll('.lineup-position')];

        await user.click(slots[0]);
        expect(removeFromLineup).not.toHaveBeenCalled();

        await user.click(slots[1]);
        // The index is what lib/roster.js splices the position label back into,
        // so passing the wrong one restores the slot in the wrong place.
        expect(removeFromLineup).toHaveBeenCalledTimes(1);
        expect(removeFromLineup).toHaveBeenCalledWith(STARTER.id, 1);
    });

    it('reports a league change up by league id', async () => {
        const { updateLeagueID } = renderPanel();

        await user.selectOptions(screen.getByRole('combobox'), OTHER_LEAGUE_ID);

        // The dropdown shows names but has to report ids: switching leagues by
        // display name would break the moment two leagues shared one.
        expect(updateLeagueID).toHaveBeenCalledWith(OTHER_LEAGUE_ID);
    });
});
