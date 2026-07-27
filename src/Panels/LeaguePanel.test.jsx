import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaguePanel from './LeaguePanel';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// LeaguePanel no longer owns which sub-panel is showing - a `view` prop
// selects it, and AppShell (via App) is what changes that prop. The weekly
// lineup is the only view rendered nowhere else, and App.test.jsx never
// leaves the draft tab, so the weekly branch had no coverage at all.

const { rosterDataRaw, managerData, playerInfo, builtDraft } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const LEAGUE_ID = '1312088290526003200';
const OTHER_LEAGUE_ID = '9999999999999999999';
const STARTER = { id: '13274', name: 'Germie Bernard' };

// The player database is used exactly as the fixture holds it - nothing is
// decorated onto it any more. The slot label lives on the slot, which is the
// whole point of the shape.
const lineupPlayerInfo = playerInfo;

// Index 1 is the only filled slot; the empty ones around it are what
// distinguishes a real starter from an open position.
// The filled slot is deliberately a FLX holding a WR: the label and the
// occupant's position must differ, or rendering the position instead of the
// label looks identical and the assertion proves nothing. A WR in a WR slot
// hides exactly the bug this is here to catch.
const ROSTER_SLOTS = [
    { label: 'QB', playerId: null },
    { label: 'FLX', playerId: STARTER.id },
    { label: 'WR', playerId: null },
];

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
        rosterSlots: ROSTER_SLOTS,
        leagueID: LEAGUE_ID,
        isLoading: false,
        removeFromLineup,
        rankingPlayersIdsList: [],
        updateDraftBoard: vi.fn(),
        view: 'draft',
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
        const { container } = renderPanel({ isLoading: true });

        expect(container.querySelector('.panel-loader')).toBeTruthy();
        expect(screen.queryByText('Test League')).toBeNull();
        expect(draftPanelShowing()).toBe(false);
    });

    it('shows the draft panel when view is draft', () => {
        renderPanel({ view: 'draft' });

        expect(draftPanelShowing()).toBe(true);
        expect(screen.queryByText(STARTER.name)).toBeNull();
    });

    it('shows the weekly lineup when view is weekly', () => {
        renderPanel({ view: 'weekly' });

        expect(draftPanelShowing()).toBe(false);
        expect(screen.getAllByText(STARTER.name).length).toBeGreaterThan(0);
    });

    it('renders filled lineup slots as players and empty ones as bare position labels', () => {
        const { container } = renderPanel({ view: 'weekly' });

        const slots = [...container.querySelectorAll('.lineup-position')];
        expect(slots).toHaveLength(ROSTER_SLOTS.length);

        // Two different things are rendered from one filled slot, and they
        // disagree here on purpose: the class comes from the occupant's
        // position (that is what colours the row), while the visible label
        // comes from the slot. A WR sitting in FLX must read FLX.
        expect(slots[1].className).toContain(lineupPlayerInfo[STARTER.id].position);
        expect(slots[1].textContent).toContain(STARTER.name);
        expect(slots[1].textContent).toContain('FLX');
        expect(slots[1].textContent).not.toContain('WR');
        // Doubled because the slot renders a full-text and an abbr-text span,
        // one of which CSS hides depending on viewport width.
        expect(slots[0].textContent).toBe('QBQB');
        expect(slots[2].textContent).toBe('WRWR');
    });

    it('removes a player from the lineup by slot index, and ignores clicks on empty slots', async () => {
        const { removeFromLineup, container } = renderPanel({ view: 'weekly' });

        const slots = [...container.querySelectorAll('.lineup-position')];

        await user.click(slots[0]);
        expect(removeFromLineup).not.toHaveBeenCalled();

        await user.click(slots[1]);
        // The index is which slot gets emptied, so passing the wrong one clears
        // someone else's.
        expect(removeFromLineup).toHaveBeenCalledTimes(1);
        // The index alone identifies the slot now - the player id was only ever
        // needed to look roster_text back off the player.
        expect(removeFromLineup).toHaveBeenCalledWith(1);
    });

    it('reports a league change up by league id', async () => {
        const { updateLeagueID } = renderPanel();

        await user.selectOptions(screen.getByRole('combobox'), OTHER_LEAGUE_ID);

        // The dropdown shows names but has to report ids: switching leagues by
        // display name would break the moment two leagues shared one.
        expect(updateLeagueID).toHaveBeenCalledWith(OTHER_LEAGUE_ID);
    });
});
