import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PowerRankingsPanel from './PowerRankingsPanel';
import { clearRankingCache } from '../lib/leagueRankings.js';

// The panel owns its fetch, so these drive the real effect through a
// URL-routed fetch rather than passing data in - the wiring is the part a
// prop-fed test would skip.
//
// The ranking maths is the backend's (`GET /api/v1/leagues/:id/rankings`),
// tested there against this app's former results on real leagues. Here the
// response is canned, and what is tested is what the screen does with it.

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

const ROSTERS = [
    roster(1, 'uA', 'alpha', ['qa', 'ra', 'ba']),
    roster(2, 'uB', 'bravo', ['qb', 'rb']),
    roster(3, 'uC', 'charlie', ['qc', 'rc', 'bc']),
    roster(4, 'uD', 'delta', ['qd', 'rd']),
];

const LEAGUE = { league_id: 'L1', season: '2026', status: 'in_season' };

const SOURCES = ['proj', 'adp', 'ktc', 'fc'];

// One lineup per source: a QB and an RB, worth what the team's score says.
const lineups = (players, now) =>
    Object.fromEntries(
        SOURCES.map((id) => [
            id,
            {
                total: 2 * now[id],
                starters: [
                    { slot: 'QB', playerId: players[0], value: now[id] },
                    { slot: 'RB', playerId: players[1], value: now[id] },
                ],
            },
        ]),
    );

const pick = (season, originalRosterId) => ({
    season,
    round: 1,
    originalRosterId,
    value: 3000,
    basis: 'mid',
    tier: 'mid',
});

// Four teams, one per KTC tier: alpha is strong with its pick, bravo is as
// strong but sold its pick, charlie is weak but bought two firsts, delta is
// weak with nothing coming. FantasyCalc disagrees and likes charlie best.
const team = ({ rosterId, name, players, now, future, netPickValue, tiers, picks }) => {
    const blend = SOURCES.reduce((sum, id) => sum + now[id], 0) / SOURCES.length;
    return {
        rosterId,
        ownerId: `u${name[0].toUpperCase()}`,
        name,
        tier: tiers.blend,
        rank: {},
        now: { ...now, blend },
        future,
        netPickValue,
        tiers,
        lineups: lineups(players, now),
        futureDetail: {
            playerValue: 1000,
            pickValue: picks.length * 3000,
            netPickValue,
            total: 1000 + netPickValue,
            picks,
        },
    };
};

const TEAMS = [
    team({
        rosterId: 1,
        name: 'alpha',
        players: ['qa', 'ra'],
        now: { proj: -0.3, adp: 1.1, ktc: 1.2, fc: 0.2 },
        future: 0.3,
        netPickValue: 0,
        tiers: { proj: 'middle', adp: 'contender', ktc: 'contender', fc: 'middle', blend: 'contender' },
        picks: [pick(2027, 1)],
    }),
    team({
        rosterId: 2,
        name: 'bravo',
        players: ['qb', 'rb'],
        now: { proj: 0.6, adp: -0.2, ktc: 0.9, fc: 0.1 },
        future: -0.7,
        netPickValue: -3000,
        tiers: { proj: 'all-in', adp: 'middle', ktc: 'all-in', fc: 'middle', blend: 'middle' },
        picks: [],
    }),
    team({
        rosterId: 3,
        name: 'charlie',
        players: ['qc', 'rc'],
        now: { proj: 1.0, adp: 0.4, ktc: -0.8, fc: 1.5 },
        future: 1.4,
        netPickValue: 6000,
        tiers: { proj: 'contender', adp: 'middle', ktc: 'rebuilding', fc: 'contender', blend: 'middle' },
        picks: [pick(2027, 3), pick(2027, 2), pick(2027, 4)],
    }),
    team({
        rosterId: 4,
        name: 'delta',
        players: ['qd', 'rd'],
        now: { proj: -1.3, adp: -1.3, ktc: -1.3, fc: -1.8 },
        future: -1.0,
        netPickValue: -3000,
        tiers: { proj: 'stuck', adp: 'stuck', ktc: 'stuck', fc: 'stuck', blend: 'stuck' },
        picks: [],
    }),
];

const RANKINGS = {
    leagueId: 'L1',
    sources: [
        { id: 'ktc', provider: 'keeptradecut:1qb', asOf: '2026-09-20T00:00:00Z' },
        { id: 'fc', provider: 'fantasycalc', asOf: '2026-09-24T00:00:00Z' },
        { id: 'projections', provider: 'sleeper', asOf: '2026-09-25T00:00:00Z' },
    ],
    missing: [],
    notes: [],
    thresholds: { strongNow: 0.5, weakNow: -0.5, allInFuture: -0.5, rebuildingFuture: 0, rebuildingPicks: 0 },
    teams: TEAMS,
};

// What the backend sends when an input dropped out: that source's Now scores
// are gone and `missing` says why.
const without = (id, response = RANKINGS) => {
    const dropped = id === 'projections' ? ['proj', 'adp'] : id === 'fc' ? ['fc'] : [];
    const strip = (map) => Object.fromEntries(Object.entries(map).filter(([key]) => !dropped.includes(key)));
    return {
        ...response,
        sources: response.sources.filter((source) => source.id !== id),
        missing: [...response.missing, { id, reason: `${id} unavailable` }],
        teams: response.teams.map((t) => ({
            ...t,
            now: strip(t.now),
            tiers: strip(t.tiers),
            lineups: strip(t.lineups),
            ...(id === 'picks' ? { netPickValue: null, futureDetail: { ...t.futureDetail, picks: [] } } : {}),
        })),
    };
};

// A second league whose trades went the other way: delta bought the firsts.
const L2_RANKINGS = {
    ...RANKINGS,
    leagueId: 'L2',
    teams: TEAMS.map((t) =>
        t.name === 'delta'
            ? { ...t, future: 1.8, netPickValue: 6000, tiers: { ...t.tiers, ktc: 'rebuilding' } }
            : t.name === 'charlie'
              ? { ...t, future: -0.9 }
              : t,
    ),
};

// The backend's /weaknesses: each team's QB and RB strength, by source and
// blended. Charlie is strong at QB and weak at RB; alpha the reverse.
const GROUPS = {
    alpha: { QB: -0.6, RB: 1.3 },
    bravo: { QB: 0.4, RB: 0.2 },
    charlie: { QB: 1.1, RB: -0.9 },
    delta: { QB: -0.9, RB: -0.6 },
};
const WEAKNESSES = {
    leagueId: 'L1',
    threshold: 0.5,
    teams: TEAMS.map((t) => ({
        rosterId: t.rosterId,
        name: t.name,
        tier: t.tier,
        groups: Object.entries(GROUPS[t.name]).map(([group, z]) => ({
            group,
            z,
            bySource: Object.fromEntries(SOURCES.map((id) => [id, z])),
        })),
    })),
};

const routeFetch = ({ L1 = RANKINGS, weaknesses = WEAKNESSES } = {}) =>
    vi.fn((url) => {
        if (url.includes('leagues/L1/rankings')) return L1 ? jsonResponse(L1) : failure();
        if (url.includes('leagues/L2/rankings')) return jsonResponse(L2_RANKINGS);
        if (url.includes('/weaknesses')) return weaknesses ? jsonResponse(weaknesses) : failure();
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
        // The rankings are cached per session for the menu; a test that fails
        // them must not be handed the previous test's copy.
        clearRankingCache();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("asks the backend for this league's rankings and position strengths, together", async () => {
        global.fetch = routeFetch();
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        expect(global.fetch.mock.calls.map(([url]) => url).sort()).toEqual([
            expect.stringMatching(/api\/v1\/leagues\/L1\/rankings$/),
            expect.stringMatching(/api\/v1\/leagues\/L1\/weaknesses$/),
        ]);
    });

    it("lists every team under KTC with the backend's tiers, ranked by Now and by Future", async () => {
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

    it('offers every source the backend ranked with, and says how old the values are', async () => {
        global.fetch = routeFetch();
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        for (const name of ['Blend', 'Projections', 'ADP', 'KTC', 'FantasyCalc']) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument();
        }
        expect(screen.getByText(/4 teams · KTC .* · FantasyCalc /)).toBeInTheDocument();
    });

    it('drops projections and ADP, and says so, when the backend had no projections', async () => {
        global.fetch = routeFetch({ L1: without('projections') });
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        expect(screen.queryByRole('button', { name: 'Projections' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'ADP' })).toBeNull();
        expect(screen.getByText(/projections unavailable/)).toBeInTheDocument();
    });

    it('drops FantasyCalc, and says so, when the backend could not get it', async () => {
        global.fetch = routeFetch({ L1: without('fc') });
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        expect(screen.queryByRole('button', { name: 'FantasyCalc' })).toBeNull();
        expect(screen.getByText(/FantasyCalc unavailable/)).toBeInTheDocument();
    });

    it('says picks were not counted when the backend could not read them', async () => {
        global.fetch = routeFetch({ L1: without('picks') });
        renderPanel();

        await screen.findByRole('list', { name: 'Teams by Now score' });
        expect(screen.getByText(/picks not counted/)).toBeInTheDocument();
    });

    it('says why there is nothing to show when the rankings fail, rather than an empty list', async () => {
        global.fetch = routeFetch({ L1: null });
        renderPanel();

        expect(await screen.findByText(/Couldn.t load the rankings/)).toBeInTheDocument();
        expect(screen.queryByRole('list', { name: 'Teams by Now score' })).toBeNull();
    });

    it("shows a switched-to league's own rankings, never the last league's", async () => {
        // App updates the league id first and the league object (and its
        // rosters) a beat later. Nothing should be claimed until they agree.
        global.fetch = routeFetch();
        const user = userEvent.setup();
        const props = { playerInfo: PLAYER_INFO, sleeperUserId: 'uA', rosterData: ROSTERS };
        const { rerender } = render(<PowerRankingsPanel {...props} leagueID="L1" league={LEAGUE} />);
        await screen.findByRole('list', { name: 'Teams by Now score' });

        rerender(<PowerRankingsPanel {...props} leagueID="L2" league={LEAGUE} />);
        // Mid-switch: nothing about either league should be claimed.
        expect(screen.queryByRole('list', { name: 'Teams by Now score' })).toBeNull();

        rerender(<PowerRankingsPanel {...props} leagueID="L2" league={{ ...LEAGUE, league_id: 'L2' }} />);
        await user.click(await screen.findByRole('button', { name: 'KTC' }));

        const delta = (await rowNames()).find((row) => row.startsWith('delta'));
        expect(delta).toMatch(/Rebuilding, 4th for Now, 1st for Future$/);
    });

    it('fetches fresh each time it opens, since rosters move', async () => {
        global.fetch = routeFetch();
        const first = renderPanel();
        await screen.findByRole('list', { name: 'Teams by Now score' });
        first.unmount();

        renderPanel();
        await screen.findByRole('list', { name: 'Teams by Now score' });

        // Rankings and strengths, twice.
        expect(global.fetch).toHaveBeenCalledTimes(4);
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

    describe('a team, opened', () => {
        const openRow = async (user, name) => {
            const list = await screen.findByRole('list', { name: 'Teams by Now score' });
            await user.click(within(list).getByRole('button', { name: new RegExp(`^${name}\\b`) }));
        };

        it('compares a leaguemate with you, lists their picks, and goes back', async () => {
            global.fetch = routeFetch();
            const user = userEvent.setup();
            renderPanel();
            await user.click(await screen.findByRole('button', { name: 'KTC' }));

            await openRow(user, 'charlie');

            expect(screen.getByRole('heading', { name: 'charlie' })).toBeInTheDocument();
            expect(screen.getByText('Rebuilding')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Starters vs you' })).toBeInTheDocument();
            // One bar pair per position group, straight from /weaknesses.
            expect(screen.getByRole('group', { name: 'QB: charlie +1.1, you −0.6' })).toBeInTheDocument();
            expect(screen.getByRole('group', { name: 'RB: charlie −0.9, you +1.3' })).toBeInTheDocument();

            // Charlie holds their own 2027 first plus bravo's and delta's.
            const picks = within(screen.getByRole('heading', { name: 'Their picks' }).closest('section')).getAllByRole(
                'listitem',
            );
            expect(picks.map((item) => item.textContent)).toEqual([
                expect.stringMatching(/^2027 1st · mid/),
                expect.stringMatching(/^2027 1st · mid · via bravo/),
                expect.stringMatching(/^2027 1st · mid · via delta/),
            ]);

            await user.click(screen.getByRole('button', { name: /Power rankings/ }));
            expect(await screen.findByRole('list', { name: 'Teams by Now score' })).toBeInTheDocument();
        });

        it('says the position bars are unavailable, and shows the rest, when strengths fail', async () => {
            global.fetch = routeFetch({ weaknesses: null });
            const user = userEvent.setup();
            renderPanel();

            await openRow(user, 'charlie');

            expect(screen.queryByRole('group', { name: /^QB: / })).toBeNull();
            expect(screen.getByText(/couldn’t be loaded/)).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Their picks' })).toBeInTheDocument();
        });

        it('shows your own team without comparing it to itself', async () => {
            global.fetch = routeFetch();
            const user = userEvent.setup();
            renderPanel();

            await openRow(user, 'alpha');

            // Asserted on text, not the accessible name: the name calculation
            // trims the " · you" span's leading space, which the page keeps.
            expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('alpha · you');
            expect(screen.getByRole('heading', { name: 'Starters' })).toBeInTheDocument();
            expect(screen.queryByRole('heading', { name: 'Starters vs you' })).toBeNull();
            expect(screen.queryByRole('button', { name: 'Look for trades' })).toBeNull();
        });

        it('goes to Trades from a leaguemate', async () => {
            global.fetch = routeFetch();
            const user = userEvent.setup();
            window.location.hash = '#/power';
            renderPanel();

            await openRow(user, 'bravo');
            await user.click(screen.getByRole('button', { name: 'Look for trades' }));

            expect(window.location.hash).toBe('#/trades');
            window.location.hash = '';
        });
    });

    it('waits for the rankings before drawing anything', async () => {
        // Both requests held open until released by hand.
        const pending = [];
        global.fetch = vi.fn((url) => new Promise((resolve) => pending.push({ url, resolve })));
        renderPanel();

        await waitFor(() => expect(pending).toHaveLength(2));
        expect(screen.queryByRole('list', { name: 'Teams by Now score' })).toBeNull();

        for (const { url, resolve } of pending) {
            const body = url.includes('/weaknesses') ? WEAKNESSES : RANKINGS;
            resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
        }
        await waitFor(() => expect(screen.getByRole('list', { name: 'Teams by Now score' })).toBeInTheDocument());
    });
});
