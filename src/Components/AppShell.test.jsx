import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppShell from './AppShell';
import { SECTIONS } from '../sections.js';

const renderShell = (overrides = {}) =>
    render(
        <AppShell
            sections={SECTIONS}
            renderSection={(activeId) => <div data-testid="section-content">{activeId}</div>}
            renderAside={() => <div data-testid="aside-content">aside</div>}
            leagueBar={<div data-testid="league-bar">league bar</div>}
            {...overrides}
        />,
    );

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
        expect(screen.getByRole('button', { name: 'Draft' })).toHaveAttribute('aria-current', 'page');
    });

    it('changes the rendered section and the hash when a tab is clicked', async () => {
        const user = userEvent.setup();
        renderShell();

        await user.click(screen.getByRole('button', { name: 'Lineup' }));

        expect(screen.getByTestId('section-content')).toHaveTextContent('lineup');
        expect(window.location.hash).toBe('#/lineup');
        expect(screen.getByRole('button', { name: 'Lineup' })).toHaveAttribute('aria-current', 'page');
    });

    it('selects the section named by an existing hash on first render', () => {
        window.location.hash = '#/lineup';

        renderShell();

        expect(screen.getByTestId('section-content')).toHaveTextContent('lineup');
        expect(screen.getByRole('button', { name: 'Lineup' })).toHaveAttribute('aria-current', 'page');
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

    it('does not render the leagueBar for a global-scope section', () => {
        // No real global section exists yet - this fixture is the only thing
        // holding the cross-league decision up: a section with scope
        // 'global' must never show the league switcher, since there is no
        // single league to switch.
        const globalSections = [...SECTIONS, { id: 'manager-analytics', label: 'Analytics', scope: 'global' }];
        window.location.hash = '#/manager-analytics';

        renderShell({ sections: globalSections });

        expect(screen.getByTestId('section-content')).toHaveTextContent('manager-analytics');
        expect(screen.queryByTestId('league-bar')).toBeNull();
    });
});
