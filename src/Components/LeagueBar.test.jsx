import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeagueBar from './LeagueBar';

const LEAGUE_ID = '1312088290526003200';
const OTHER_LEAGUE_ID = '9999999999999999999';

function renderLeagueBar(overrides = {}) {
    const updateLeagueID = vi.fn();
    const props = {
        leagueName: 'Test League',
        leagueID: LEAGUE_ID,
        leagueIds: [
            { league_id: LEAGUE_ID, name: 'Test League' },
            { league_id: OTHER_LEAGUE_ID, name: '4 QB Madness' },
        ],
        updateLeagueID,
        ...overrides,
    };
    render(<LeagueBar {...props} />);
    return { updateLeagueID };
}

describe('LeagueBar', () => {
    it('renders the current league name', () => {
        renderLeagueBar();

        // The current league's name also appears as an option in the dropdown
        // below, so this is scoped to the option roles rather than matching
        // both.
        expect(screen.getAllByText('Test League')).toHaveLength(2);
        expect(screen.getByRole('option', { name: 'Test League' })).toBeTruthy();
    });

    it('lists every league in the dropdown', () => {
        renderLeagueBar();

        expect(screen.getByRole('option', { name: 'Test League' })).toBeTruthy();
        expect(screen.getByRole('option', { name: '4 QB Madness' })).toBeTruthy();
    });

    it('reports a league change up by league id', async () => {
        const user = userEvent.setup();
        const { updateLeagueID } = renderLeagueBar();

        await user.selectOptions(screen.getByRole('combobox'), OTHER_LEAGUE_ID);

        // The dropdown shows names but has to report ids: switching leagues by
        // display name would break the moment two leagues shared one.
        expect(updateLeagueID).toHaveBeenCalledWith(OTHER_LEAGUE_ID);
    });
});
