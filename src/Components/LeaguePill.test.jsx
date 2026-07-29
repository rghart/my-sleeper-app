import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaguePill from './LeaguePill';

const LEAGUE_ID = '1312088290526003200';
const OTHER_LEAGUE_ID = '9999999999999999999';

function renderLeaguePill(overrides = {}) {
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
    render(<LeaguePill {...props} />);
    return { updateLeagueID };
}

describe('LeaguePill', () => {
    it('has an accessible name distinct from any league name', () => {
        renderLeaguePill();

        expect(screen.getByRole('combobox', { name: 'League' })).toBeTruthy();
    });

    it('shows the current league as the selected value', () => {
        renderLeaguePill();

        expect(screen.getByRole('combobox', { name: 'League' })).toHaveValue(LEAGUE_ID);
        expect(screen.getByRole('option', { name: 'Test League' })).toBeTruthy();
    });

    it('lists every league in the dropdown', () => {
        renderLeaguePill();

        expect(screen.getByRole('option', { name: 'Test League' })).toBeTruthy();
        expect(screen.getByRole('option', { name: '4 QB Madness' })).toBeTruthy();
    });

    it('reports a league change up by league id, not by display name', async () => {
        const user = userEvent.setup();
        const { updateLeagueID } = renderLeaguePill();

        await user.selectOptions(screen.getByRole('combobox', { name: 'League' }), OTHER_LEAGUE_ID);

        // Two leagues can share a name, so switching has to report the id -
        // this is the one assertion carried over unchanged from LeagueBar.
        expect(updateLeagueID).toHaveBeenCalledWith(OTHER_LEAGUE_ID);
    });
});
