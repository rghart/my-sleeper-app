import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PowerRankingsPanel from './PowerRankingsPanel';

// The panel owns its fetches, so these drive the real effect through a
// URL-routed fetch rather than passing data in - the wiring is the part a
// prop-fed test would skip.

const jsonResponse = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
const failure = () => Promise.resolve({ ok: false, status: 503, statusText: 'Unavailable', json: () => ({}) });

const pos = (position) => ({ position, fantasy_positions: [position] });
const PLAYER_INFO = {
    qa: pos('QB'),
    ra: pos('RB'),
    ba: pos('RB'),
    qb: pos('QB'),
    rb: pos('RB'),
    qc: pos('QB'),
    rc: pos('RB'),
    bc: pos('RB'),
    qd: pos('QB'),
    rd: pos('RB'),
};

const roster = (id, owner, name, players) => ({
    roster_id: id,
    owner_id: owner,
    manager_display_name: name,
    players,
    reserve: null,
    taxi: null,
});

// Four teams, one per KTC tier: alpha is strong with a bench and its pick,
// bravo is as strong but sold its pick and has no bench, charlie is weak but
// bought two firsts, delta is weak with nothing coming.
const ROSTERS = [
    roster(1, 'uA', 'alpha', ['qa', 'ra', 'ba']),
    roster(2, 'uB', 'bravo', ['qb', 'rb']),
    roster(3, 'uC', 'charlie', ['qc', 'rc', 'bc']),
    roster(4, 'uD', 'delta', ['qd', 'rd']),
];

const LEAGUE = {
    season: '2026',
    total_rosters: 4,
    roster_positions: ['QB', 'RB', 'BN', 'BN'],
    settings: { type: 2, draft_rounds: 1 },
    scoring_settings: { rec: 1, pass_td: 4 },
};

const values = (table) => Object.entries(table).map(([playerId, value]) => ({ playerId, value }));

const KTC = {
    asOf: '2026-09-20T00:00:00Z',
    source: 'keeptradecut:1qb',
    values: values({
        qa: 9500,
        ra: 8000,
        ba: 3000,
        qb: 8500,
        rb: 8500,
        qc: 2000,
        rc: 1500,
        bc: 4000,
        qd: 1500,
        rd: 1000,
    }),
    picks: [
        { season: 2026, round: 1, tier: 'mid', value: 9999 },
        { season: 2027, round: 1, tier: 'mid', value: 3000 },
    ],
};

// FantasyCalc disagrees: it likes charlie's starters best.
const FC = {
    asOf: '2026-09-24T00:00:00Z',
    settings: { source: 'fantasycalc' },
    values: values({ qa: 5000, ra: 5000, qb: 5000, rb: 5000, qc: 9000, rc: 9000, qd: 1000, rd: 1000 }),
};

// Sleeper's season projections. `pts_ppr` is deliberately in the opposite
// order to what this league's own scoring gives, so a test can only pass if
// the panel scores the raw stats itself.
const projection = (player_id, stats, ptsPpr) => ({ player_id, stats: { ...stats, pts_ppr: ptsPpr } });
const PROJECTIONS = [
    projection('qa', { pass_td: 10, adp_ppr: 10 }, 400),
    projection('ra', { rec: 50, adp_ppr: 20 }, 400),
    projection('qb', { pass_td: 30, adp_ppr: 200 }, 100),
    projection('rb', { rec: 10, adp_ppr: 250 }, 100),
    projection('qc', { pass_td: 20, adp_ppr: 100 }, 1),
    projection('rc', { rec: 60, adp_ppr: 90 }, 1),
    projection('qd', { pass_td: 5, adp_ppr: 280 }, 900),
    projection('rd', { rec: 5, adp_ppr: 290 }, 900),
];

const TRADED = [
    { season: '2027', round: 1, roster_id: 2, owner_id: 3, previous_owner_id: 2 },
    { season: '2027', round: 1, roster_id: 4, owner_id: 3, previous_owner_id: 4 },
    // Last season's draft has run; this must not count.
    { season: '2026', round: 1, roster_id: 1, owner_id: 4, previous_owner_id: 1 },
];

const routeFetch = ({ ktc = KTC, fc = FC, traded = TRADED, projections = PROJECTIONS } = {}) =>
    vi.fn((url) => {
        if (url.includes('projections')) return projections ? jsonResponse(projections) : failure();
        if (url.includes('dynasty-values')) return ktc ? jsonResponse(ktc) : failure();
        if (url.includes('/values')) return fc ? jsonResponse(fc) : failure();
        if (url.includes('traded_picks')) return traded ? jsonResponse(traded) : failure();
        return failure();
    });

const renderPanel = () =>
    render(
        <PowerRankingsPanel
            leagueID="L1"
            league={LEAGUE}
            rosterData={ROSTERS}
            playerInfo={PLAYER_INFO}
            sleeperUserId="uA"
            currentDraftComplete
        />,
    );

const rowNames = async () => {
    const list = await screen.findByRole('list', { name: 'Teams by Now score' });
    return within(list)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'));
};

describe('PowerRankingsPanel', () => {
    let originalFetch;
    beforeEach(() => {
        originalFetch = global.fetch;
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('tiers every team under KTC, counting bench and traded picks as Future', async () => {
        global.fetch = routeFetch();
        const user = userEvent.setup();
        renderPanel();

        await user.click(await screen.findByRole('button', { name: 'KTC' }));

        expect(await rowNames()).toEqual([
            'alpha, you, Contender, 1st for Now, 2nd for Future',
            'bravo, All-in, 2nd for Now, 3rd for Future',
            'charlie, Rebuilding, 3rd for Now, 1st for Future',
            'delta, Stuck, 4th for Now, 4th for Future',
        ]);
    });

    it('re-ranks Now when the source changes, leaving Future alone', async () => {
        global.fetch = routeFetch();
        const user = userEvent.setup();
        renderPanel();

        await user.click(await screen.findByRole('button', { name: 'FantasyCalc' }));

        const rows = await rowNames();
        expect(rows[0]).toBe('charlie, Contender, 1st for Now, 1st for Future');
        expect(rows[3]).toBe('delta, Stuck, 4th for Now, 4th for Future');
    });

    it('marks your own team on the chart as well as in the list', async () => {
        global.fetch = routeFetch();
        renderPanel();

        // The chart dot and the list row both name you.
        expect(await screen.findAllByRole('button', { name: /^alpha, you, / })).toHaveLength(2);
        // Four dots on the chart, four rows in the list.
        expect(screen.getAllByRole('button', { name: /^(alpha|bravo|charlie|delta)\b/ })).toHaveLength(8);
    });

    it("ranks by projections scored with this league's settings, not Sleeper's stock points", async () => {
        global.fetch = routeFetch();
        const user = userEvent.setup();
        renderPanel();

        await user.click(await screen.findByRole('button', { name: 'Projections' }));

        // pass_td x4 + rec x1: charlie 140, bravo 130, alpha 90, delta 25.
        const rows = await rowNames();
        expect(rows.map((row) => row.split(',')[0])).toEqual(['charlie', 'bravo', 'alpha', 'delta']);
        expect(screen.getByText(/scored with this league’s settings/)).toBeInTheDocument();
    });

    it("ranks by the league's redraft ADP column, earliest picks best", async () => {
        global.fetch = routeFetch();
        const user = userEvent.setup();
        renderPanel();

        await user.click(await screen.findByRole('button', { name: 'ADP' }));

        const rows = await rowNames();
        expect(rows.map((row) => row.split(',')[0])).toEqual(['alpha', 'charlie', 'bravo', 'delta']);
    });

    it('drops projections and ADP, and says so, when projections fail to load', async () => {
        global.fetch = routeFetch({ projections: null });
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        expect(screen.queryByRole('button', { name: 'Projections' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'ADP' })).toBeNull();
        expect(screen.getByText(/projections unavailable/)).toBeInTheDocument();
    });

    it('drops FantasyCalc, and says so, when it fails to load', async () => {
        global.fetch = routeFetch({ fc: null });
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        expect(screen.queryByRole('button', { name: 'FantasyCalc' })).toBeNull();
        expect(screen.getByText(/FantasyCalc unavailable/)).toBeInTheDocument();
    });

    it('leaves picks out, and says so, when the traded picks fail to load', async () => {
        global.fetch = routeFetch({ traded: null });
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        expect(screen.getByText(/picks not counted/)).toBeInTheDocument();
    });

    it('says why there is nothing to show when KTC fails, rather than an empty list', async () => {
        global.fetch = routeFetch({ ktc: null });
        renderPanel();

        expect(await screen.findByText(/Couldn.t load KTC values/)).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Teams by Now score' })).toBeNull();
    });

    it('explains the tiers on request', async () => {
        global.fetch = routeFetch();
        const user = userEvent.setup();
        renderPanel();

        await user.click(await screen.findByRole('button', { name: 'How tiers work' }));

        const sheet = screen.getByRole('dialog', { name: 'How tiers work' });
        for (const tier of ['Contender', 'All-in', 'Middle', 'Rebuilding', 'Stuck']) {
            expect(within(sheet).getByText(tier)).toBeInTheDocument();
        }
    });

    it('asks for 1QB values in a league that cannot start a second quarterback', async () => {
        global.fetch = routeFetch();
        renderPanel();

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const ktcUrl = global.fetch.mock.calls.map(([url]) => url).find((url) => url.includes('dynasty-values'));
        expect(ktcUrl).toContain('superflex=false');
    });
});
