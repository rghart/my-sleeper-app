import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaguemateIntelPanel from './LeaguemateIntelPanel';

// The panel owns its own fetch, so these tests drive the real effect rather
// than a passed-in prop - that wiring is exactly what went untested when the
// rank-list intel shipped, and had to be added afterwards (#150).

const jsonResponse = (data) => Promise.resolve({ ok: true, statusText: 'OK', json: () => Promise.resolve(data) });

const manager = ({ tendencies, ...overrides } = {}) => ({
    userId: 1,
    displayName: 'atekipp',
    leaguesCount: 3,
    draftsCount: 3,
    draftsComplete: 3,
    ...overrides,
    tendencies: { crushes: [], positionLean: [], reachVsAdp: -2.03, ...tendencies },
});

// baconstains is the well-observed case; cja9689 the thin one. Having both in
// every render is what makes "withheld" distinguishable from "not rendered".
const HEAVY = manager({
    userId: 2,
    displayName: 'baconstains',
    leaguesCount: 30,
    draftsCount: 30,
    draftsComplete: 30,
    tendencies: {
        reachVsAdp: -2.03,
        positionLean: [
            { position: 'WR', picks: 40, share: 0.4 },
            { position: 'RB', picks: 30, share: 0.3 },
        ],
        crushes: [{ playerId: '13278', name: 'Max Klare', position: 'TE', times: 9, of: 30 }],
    },
});

const THIN = manager({
    userId: 3,
    displayName: 'cja9689',
    leaguesCount: 1,
    draftsCount: 1,
    draftsComplete: 1,
    tendencies: {
        reachVsAdp: -6.1,
        positionLean: [{ position: 'QB', picks: 2, share: 0.5 }],
        crushes: [],
    },
});

const intelBody = (overrides = {}) => ({
    corpus: { drafts: 72, picks: 3382, lastCrawledAt: '2026-08-06T20:58:28Z' },
    managers: [THIN, HEAVY],
    ...overrides,
});

// Routed by URL: opening a profile fires a second request to /activity, and
// answering it with the intel body would be testing a shape the API never
// sends.
const renderPanel = (body = intelBody(), props = {}, activity = activityBody()) => {
    global.fetch = vi.fn((url) => (String(url).includes('/activity') ? jsonResponse(activity) : jsonResponse(body)));
    return render(<LeaguemateIntelPanel leagueID="lg1" season="2026" {...props} />);
};

const activityBody = (overrides = {}) => ({
    transactions: [],
    players: {},
    coverage: { leaguesSeen: 0, leaguesKnown: 0, lastCrawledAt: null },
    ...overrides,
});

describe('LeaguemateIntelPanel', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('asks for the league it was given, for the right season', async () => {
        renderPanel();
        await screen.findByText('baconstains');

        const url = new URL(global.fetch.mock.calls[0][0], 'http://localhost');
        expect(url.pathname).toBe('/api/v1/leagues/lg1/intel');
        expect(url.searchParams.get('season')).toBe('2026');
    });

    it('states the corpus the whole screen rests on', async () => {
        renderPanel();
        // A stale crawl is the difference between "they have never taken him"
        // and "we have not looked lately", so it is header text, not a detail.
        expect(await screen.findByText(/72 drafts · 3382 picks/)).toBeInTheDocument();
        expect(screen.getByText(/crawled/)).toBeInTheDocument();
    });

    it('lists the most-observed managers first', async () => {
        renderPanel();
        await screen.findByText('baconstains');

        const names = screen.getAllByRole('listitem').map((item) => item.textContent);
        expect(names[0]).toContain('baconstains');
        expect(names[1]).toContain('cja9689');
    });

    it('quotes a reach tendency only where the sample supports it', async () => {
        renderPanel();
        await screen.findByText('baconstains');

        const heavy = screen.getByText('baconstains').closest('li');
        // Short form on the row so the meta line beside it is not truncated
        // at 375px; the long sentence survives in the accessible name, which
        // is read rather than laid out.
        expect(within(heavy).getByText('2.0 early')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /baconstains, 30 drafts seen, reaches 2\.0 picks early/ }),
        ).toBeInTheDocument();

        // cja9689 has a reachVsAdp too - a bigger one - but off one draft.
        // Rendering it would be the "0-draft manager shown with a league
        // baseline as if it were their own tendency" trap all over again.
        const thin = screen.getByText('cja9689').closest('li');
        expect(within(thin).getByText('no read')).toBeInTheDocument();
        expect(within(thin).queryByText(/picks early/)).toBeNull();
    });

    it('pushes a profile in place and comes back', async () => {
        const user = userEvent.setup();
        renderPanel();
        await screen.findByText('baconstains');

        await user.click(screen.getByRole('button', { name: /baconstains/ }));

        expect(screen.getByText('Players they keep taking')).toBeInTheDocument();
        expect(screen.getByText('9 of 30')).toBeInTheDocument();
        // The list is gone, not layered underneath.
        expect(screen.queryByText('cja9689')).toBeNull();

        await user.click(screen.getByRole('button', { name: /Leaguemates/ }));
        expect(screen.getByText('cja9689')).toBeInTheDocument();
    });

    it('shows positional shares as percentages only above the pick threshold', async () => {
        const user = userEvent.setup();
        renderPanel();
        await screen.findByText('baconstains');

        await user.click(screen.getByRole('button', { name: /baconstains/ }));
        expect(screen.getByText('40% · 40')).toBeInTheDocument();
    });

    it('replaces the share with a raw count when there are too few picks behind it', async () => {
        const user = userEvent.setup();
        renderPanel();
        await screen.findByText('cja9689');

        await user.click(screen.getByRole('button', { name: /cja9689/ }));

        // 2 picks is not a 50% lean, it is two picks.
        expect(screen.getByText('2 picks')).toBeInTheDocument();
        expect(screen.queryByText(/50%/)).toBeNull();
        expect(screen.getByText(/only seen 1 of their drafts/)).toBeInTheDocument();
    });

    it('does not call it a pattern when every player was taken exactly once', async () => {
        const user = userEvent.setup();
        const once = manager({
            userId: 5,
            displayName: 'skeefe',
            draftsComplete: 1,
            tendencies: {
                positionLean: [{ position: 'RB', picks: 2, share: 0.5 }],
                crushes: [{ playerId: '1', name: 'Ted Hurst', position: 'WR', times: 1, of: 1 }],
            },
        });
        renderPanel(intelBody({ managers: [once] }));
        await screen.findByText('skeefe');

        await user.click(screen.getByRole('button', { name: /skeefe/ }));

        // "1 of 1" is honest; "players they keep taking" over it is not.
        expect(screen.getByText('Players they have taken')).toBeInTheDocument();
        expect(screen.queryByText('Players they keep taking')).toBeNull();
    });

    it('says nothing can be read for a manager with no observed drafts', async () => {
        const user = userEvent.setup();
        const unseen = manager({ userId: 4, displayName: 'pavelito0010', draftsComplete: 0 });
        renderPanel(intelBody({ managers: [unseen] }));
        await screen.findByText('pavelito0010');

        await user.click(screen.getByRole('button', { name: /pavelito0010/ }));
        expect(screen.getByText(/None of their drafts have been seen/)).toBeInTheDocument();
    });

    // The activity block (§6 step 6 phase 4). Two of these exist because a
    // live crawl found what no fixture had: `commissioner` transactions, and
    // that 11% of real transactions are `failed`.
    describe('the activity block', () => {
        const tx = (overrides = {}) => ({
            id: 1,
            type: 'trade',
            status: 'complete',
            created: '2026-08-05T12:00:00Z',
            creator: 2,
            participantIds: [2, 3],
            adds: { 4001: 1 },
            drops: {},
            draftPicks: [],
            waiverBid: null,
            ...overrides,
        });

        const withActivity = (overrides) =>
            renderPanel(
                intelBody(),
                {},
                activityBody({ players: { 4001: { name: 'Some Player', position: 'WR' } }, ...overrides }),
            );

        const openProfile = async (user) => {
            await screen.findByText('baconstains');
            await user.click(screen.getByRole('button', { name: /baconstains/ }));
        };

        it('asks for that manager only, when the profile is opened', async () => {
            const user = userEvent.setup();
            withActivity({ transactions: [] });
            await openProfile(user);

            const call = global.fetch.mock.calls.map((c) => String(c[0])).find((u) => u.includes('/activity'));
            const url = new URL(call, 'http://localhost');
            expect(url.pathname).toBe('/api/v1/users/2/activity');
            expect(url.searchParams.get('season')).toBe('2026');
        });

        it('renders a move with the players named', async () => {
            const user = userEvent.setup();
            withActivity({ transactions: [tx()], coverage: { leaguesSeen: 33, leaguesKnown: 42 } });
            await openProfile(user);

            expect(await screen.findByText('Trade')).toBeInTheDocument();
            expect(screen.getByText(/Some Player/)).toBeInTheDocument();
        });

        it('always states coverage beside the count', async () => {
            // "5 trades" across 42 leagues and across 4 are different claims,
            // and a live run once reported a denominator describing nobody.
            const user = userEvent.setup();
            withActivity({ transactions: [tx()], coverage: { leaguesSeen: 33, leaguesKnown: 42 } });
            await openProfile(user);

            expect(await screen.findByText(/33 of 42 leagues/)).toBeInTheDocument();
        });

        it('labels a failed transaction rather than mixing it in', async () => {
            // 11% of real transactions are failed. Unlabelled, the list claims
            // things happened that did not.
            const user = userEvent.setup();
            withActivity({ transactions: [tx({ type: 'waiver', status: 'failed', waiverBid: 37 })] });
            await openProfile(user);

            expect(await screen.findByText('Failed')).toBeInTheDocument();
            expect(screen.getByText('$37')).toBeInTheDocument();
        });

        it('names a commissioner move instead of showing the raw API string', async () => {
            // 143 of 13,610 in the real corpus, and absent from the scope.
            const user = userEvent.setup();
            withActivity({ transactions: [tx({ type: 'commissioner' })] });
            await openProfile(user);

            expect(await screen.findByText('Commissioner')).toBeInTheDocument();
            expect(screen.queryByText('commissioner')).toBeNull();
        });

        it('says nothing is seen yet rather than rendering an empty block', async () => {
            const user = userEvent.setup();
            withActivity({ transactions: [], coverage: { leaguesSeen: 0, leaguesKnown: 42 } });
            await openProfile(user);

            expect(await screen.findByText(/Nothing seen yet/)).toBeInTheDocument();
        });

        it('leaves the rest of the profile intact when activity fails', async () => {
            // Additive, like the rank list's intel: a failed fetch must not
            // take the profile down with it.
            const user = userEvent.setup();
            global.fetch = vi.fn((url) =>
                String(url).includes('/activity') ? Promise.reject(new Error('offline')) : jsonResponse(intelBody()),
            );
            render(<LeaguemateIntelPanel leagueID="lg1" season="2026" />);
            await openProfile(user);

            expect(screen.getByText('Players they keep taking')).toBeInTheDocument();
            expect(screen.queryByText('Recent moves')).toBeNull();
        });
    });

    it('says so when the fetch fails, rather than rendering an empty screen', async () => {
        // Unlike the rank list, intel is not additive here - it is the whole
        // section, so a failure has to be visible.
        global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
        render(<LeaguemateIntelPanel leagueID="lg1" season="2026" />);

        expect(await screen.findByText(/Couldn’t load leaguemate intel/)).toBeInTheDocument();
    });

    it('re-asks when the league changes', async () => {
        const { rerender } = renderPanel();
        await screen.findByText('baconstains');
        expect(global.fetch).toHaveBeenCalledTimes(1);

        rerender(<LeaguemateIntelPanel leagueID="lg2" season="2026" />);
        await screen.findByText('baconstains');

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch.mock.calls[1][0]).toContain('/leagues/lg2/intel');
    });
});
