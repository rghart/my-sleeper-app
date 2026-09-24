import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppShell from './AppShell';
import { SECTIONS } from '../sections.js';
import { clearRankingCache } from '../lib/leagueRankings.js';

const LEAGUE_ID = '1312088290526003200';
const OTHER_LEAGUE_ID = '9999999999999999999';
const LEAGUE_IDS = [
    { league_id: LEAGUE_ID, name: 'Test League' },
    { league_id: OTHER_LEAGUE_ID, name: '4 QB Madness' },
];

const renderShell = (overrides = {}) =>
    render(
        <AppShell
            sections={SECTIONS}
            renderSection={(activeId) => <div data-testid="section-content">{activeId}</div>}
            renderAside={() => <div data-testid="aside-content">aside</div>}
            leagueID={LEAGUE_ID}
            leagueIds={LEAGUE_IDS}
            {...overrides}
        />,
    );

// The same section buttons render twice - once in AppShell's own phone tab
// bar, once as pills inside AppBar for md and up (see AppShell.jsx and
// AppBar.jsx) - so a name alone no longer picks out a single button. Every
// one of them shares the same accessible name and aria-current, so any of
// them answers "which section is active" equally well.
const sectionButtons = (name) => screen.getAllByRole('button', { name });

const sidebar = () => screen.getByRole('navigation', { name: 'All sections' });

// The group name sits in the top bar as plain text; the sidebar's group
// heading carries the same words, so exclude anything inside the sidebar.
const topBarGroupName = (label) => screen.getAllByText(label).find((element) => !sidebar().contains(element));

describe('AppShell', () => {
    beforeEach(() => {
        window.location.hash = '';
    });

    afterEach(() => {
        window.location.hash = '';
    });

    it('renders the default section when the hash is empty', () => {
        renderShell();

        expect(screen.getByTestId('section-content')).toHaveTextContent('draft');
        for (const button of sectionButtons('Draft')) {
            expect(button).toHaveAttribute('aria-current', 'page');
        }
    });

    it('changes the rendered section and the hash when a tab is clicked', async () => {
        const user = userEvent.setup();
        renderShell();

        await user.click(sectionButtons('Lineup')[0]);

        expect(screen.getByTestId('section-content')).toHaveTextContent('lineup');
        expect(window.location.hash).toBe('#/lineup');
        for (const button of sectionButtons('Lineup')) {
            expect(button).toHaveAttribute('aria-current', 'page');
        }
    });

    it('selects the section named by an existing hash on first render', () => {
        window.location.hash = '#/lineup';

        renderShell();

        expect(screen.getByTestId('section-content')).toHaveTextContent('lineup');
        for (const button of sectionButtons('Lineup')) {
            expect(button).toHaveAttribute('aria-current', 'page');
        }
    });

    it('falls back to the default section when the hash names an unknown section', () => {
        window.location.hash = '#/not-a-real-section';

        renderShell();

        expect(screen.getByTestId('section-content')).toHaveTextContent('draft');
    });

    it('renders the aside alongside a league section', () => {
        window.location.hash = '#/draft';

        renderShell();

        expect(screen.getByTestId('aside-content')).toBeInTheDocument();
    });

    it('drops the aside when Ranks is the active section', () => {
        // Ranks IS the aside's content, so rendering both would put the same
        // panel on screen twice on a wide screen. Whether the aside is visible
        // at a given width is a stylesheet question jsdom cannot answer - this
        // pins the half that is structural.
        window.location.hash = '#/ranks';

        renderShell();

        expect(screen.getByTestId('section-content')).toHaveTextContent('ranks');
        expect(screen.queryByTestId('aside-content')).toBeNull();
    });

    it('honours a defaultSectionId override when the hash is empty', () => {
        renderShell({ defaultSectionId: 'lineup' });

        expect(screen.getByTestId('section-content')).toHaveTextContent('lineup');
        for (const button of sectionButtons('Lineup')) {
            expect(button).toHaveAttribute('aria-current', 'page');
        }
    });

    it('lets an existing hash win over a defaultSectionId override', () => {
        window.location.hash = '#/ranks';

        renderShell({ defaultSectionId: 'lineup' });

        expect(screen.getByTestId('section-content')).toHaveTextContent('ranks');
    });

    it('shows the league pill for a league-scope section', () => {
        window.location.hash = '#/draft';

        renderShell();

        expect(screen.getByRole('combobox', { name: 'League' })).toBeTruthy();
    });

    it('does not render the league pill for a global-scope section', () => {
        // No real global section exists yet - this fixture is the only thing
        // holding the cross-league decision up: a section with scope
        // 'global' must never show the league switcher, since there is no
        // single league to switch.
        const globalSections = [...SECTIONS, { id: 'manager-analytics', label: 'Analytics', scope: 'global' }];
        window.location.hash = '#/manager-analytics';

        renderShell({ sections: globalSections });

        expect(screen.getByTestId('section-content')).toHaveTextContent('manager-analytics');
        expect(screen.queryByRole('combobox', { name: 'League' })).toBeNull();
    });

    it('passes identity through to the top bar and the sidebar', () => {
        renderShell({ identity: { signedIn: true, signedInEmail: 'someone@example.test', myDisplayName: 'a b' } });

        // The top bar's avatar, and the sidebar's signed-in row.
        expect(screen.getAllByText('AB')).toHaveLength(2);
        expect(screen.getByText('someone@example.test')).toBeInTheDocument();
    });

    describe('grouped navigation', () => {
        const tabBar = () => screen.queryByRole('navigation', { name: 'Sections' });
        const tabNames = () =>
            within(tabBar())
                .getAllByRole('button')
                .map((button) => button.textContent);

        it("shows only the active section's group in the tab bar", () => {
            window.location.hash = '#/lineup';

            renderShell();

            expect(tabNames()).toEqual(['Draft', 'Lineup', 'Ranks']);
        });

        it('swaps the tab bar to the new group when navigating across groups', async () => {
            const user = userEvent.setup();
            window.location.hash = '#/draft';
            renderShell();

            await user.click(within(sidebar()).getByRole('button', { name: 'Trades' }));

            expect(screen.getByTestId('section-content')).toHaveTextContent('trades');
            expect(tabNames()).toEqual(['Movers', 'Trades']);
            expect(within(tabBar()).getByRole('button', { name: 'Trades' })).toHaveAttribute('aria-current', 'page');
        });

        it('shows no tab bar for a group with a single live section', () => {
            // No real group is down to one section any more, so the rule is
            // pinned with a fixture group that is.
            const withSolo = [...SECTIONS, { id: 'solo', label: 'Solo', scope: 'league', group: 'solo' }];
            window.location.hash = '#/solo';

            renderShell({ sections: withSolo });

            expect(screen.getByTestId('section-content')).toHaveTextContent('solo');
            expect(tabBar()).toBeNull();
            // The pill row follows the same rule.
            expect(screen.queryByRole('navigation', { name: 'Section switcher' })).toBeNull();
        });

        it('gives League a tab bar now it has two sections', () => {
            window.location.hash = '#/leaguemates';

            renderShell();

            expect(tabNames()).toEqual(['Leaguemates', 'Power rankings']);
        });

        it('names the active group in the top bar', async () => {
            const user = userEvent.setup();
            window.location.hash = '#/ranks';
            renderShell();

            expect(topBarGroupName('Your team')).toBeInTheDocument();

            await user.click(within(sidebar()).getByRole('button', { name: 'Movers' }));

            expect(topBarGroupName('Market')).toBeInTheDocument();
        });

        it('lists every section under its group heading in the sidebar', () => {
            renderShell();

            const groups = within(sidebar()).getAllByRole('group');
            const listing = groups.map((group) => [
                group.getAttribute('aria-labelledby') &&
                    document.getElementById(group.getAttribute('aria-labelledby')).textContent,
                within(group)
                    .queryAllByRole('button')
                    .map((button) => button.getAttribute('aria-label')),
            ]);
            expect(listing).toEqual([
                ['Your team', ['Draft', 'Lineup', 'Ranks']],
                ['Market', ['Movers', 'Trades']],
                ['League', ['Leaguemates', 'Power rankings']],
            ]);
        });
    });

    describe('your leagues', () => {
        const yourLeagues = () => screen.getAllByRole('navigation', { name: 'Your leagues' })[0];

        it('lists every league in the sidebar, and switches league from it', async () => {
            const user = userEvent.setup();
            const updateLeagueID = vi.fn();
            renderShell({ updateLeagueID });

            const list = yourLeagues();
            expect(within(list).getByRole('button', { name: /Test League/ })).toHaveAttribute('aria-current', 'true');

            await user.click(within(list).getByRole('button', { name: /4 QB Madness/ }));

            expect(updateLeagueID).toHaveBeenCalledWith(OTHER_LEAGUE_ID);
        });

        describe('with tiers', () => {
            let originalFetch;
            beforeEach(() => {
                originalFetch = global.fetch;
                clearRankingCache();
            });
            afterEach(() => {
                global.fetch = originalFetch;
            });

            const json = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
            const leagueObject = (league_id, name, status) => ({
                league_id,
                name,
                status,
                season: '2026',
                roster_positions: ['QB', 'BN'],
                settings: { type: 2, draft_rounds: 1 },
                scoring_settings: { rec: 1 },
            });

            it('shows your tier beside each league once it is known', async () => {
                // In the first league you field the better quarterback and
                // hold the only bench player; the second has not drafted.
                global.fetch = vi.fn((url) => {
                    if (url.includes('dynasty-values'))
                        return json({
                            values: [
                                { playerId: 'q1', value: 9000 },
                                { playerId: 'q2', value: 500 },
                                { playerId: 'q3', value: 1000 },
                            ],
                            picks: [],
                        });
                    if (url.includes(`league/${LEAGUE_ID}/rosters`))
                        return json([
                            { roster_id: 1, owner_id: 'me', players: ['q1', 'q2'] },
                            { roster_id: 2, owner_id: 'them', players: ['q3'] },
                        ]);
                    return json([]);
                });

                renderShell({
                    leagueIds: [
                        leagueObject(LEAGUE_ID, 'Test League', 'in_season'),
                        leagueObject(OTHER_LEAGUE_ID, '4 QB Madness', 'pre_draft'),
                    ],
                    updateLeagueID: vi.fn(),
                    sleeperUserId: 'me',
                    playerInfo: {
                        q1: { fantasy_positions: ['QB'] },
                        q2: { fantasy_positions: ['QB'] },
                        q3: { fantasy_positions: ['QB'] },
                    },
                });

                const first = await within(yourLeagues()).findByRole('button', { name: /Test League.*Contender/ });
                expect(first).toBeInTheDocument();
                // No tier for a league that has not drafted - an empty board
                // would tie every team at Middle and say nothing.
                expect(within(yourLeagues()).getByRole('button', { name: '4 QB Madness' })).toBeInTheDocument();
                expect(global.fetch.mock.calls.some(([url]) => url.includes(`league/${OTHER_LEAGUE_ID}/rosters`))).toBe(
                    false,
                );
            });
        });
    });
});
