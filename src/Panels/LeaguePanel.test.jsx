import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LeaguePanel from './LeaguePanel';
import { buildRosterInfo, decorateRosters } from '../lib/rosterInfo.js';
import rosterFlagsFixture from '../lib/__fixtures__/roster-flags-2026.json';

// LeaguePanel no longer owns which sub-panel is showing - a `view` prop
// selects it, and AppShell (via App) is what changes that prop. The weekly
// lineup's own rendering is covered in LineupPanel.test.jsx; this file only
// covers the loader and the view switch itself.

const { rosterDataRaw, managerData, playerInfo, builtDraft } = rosterFlagsFixture;

const rosterData = decorateRosters({ rosterData: rosterDataRaw, managerData });
const rosterInfo = buildRosterInfo({ rosterData, builtDraft: null });

const LEAGUE_ID = '1312088290526003200';
const OTHER_LEAGUE_ID = '9999999999999999999';
const STARTER = { id: '13274', name: 'Germie Bernard' };

// Index 1 is the only filled slot; the empty ones around it are what
// distinguishes a real starter from an open position.
const ROSTER_SLOTS = [
    { label: 'QB', playerId: null },
    { label: 'FLX', playerId: STARTER.id },
    { label: 'WR', playerId: null },
];

function renderPanel(overrides = {}) {
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
        playerInfo,
        rosterInfo,
        rosterSlots: ROSTER_SLOTS,
        isLoading: false,
        removeFromLineup,
        rankingPlayersIdsList: [],
        updateDraftBoard: vi.fn(),
        view: 'draft',
        ...overrides,
    };
    const { container } = render(<LeaguePanel {...props} />);
    return { removeFromLineup, container };
}

const draftPanelShowing = () => screen.queryByRole('button', { name: 'Sync draft' }) !== null;

describe('LeaguePanel', () => {
    beforeEach(() => {
        global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
    });

    it('shows only the loader while the league panel is loading', () => {
        renderPanel({ isLoading: true });

        expect(screen.queryByRole('progressbar', { name: 'Loading' })).toBeTruthy();
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
});
