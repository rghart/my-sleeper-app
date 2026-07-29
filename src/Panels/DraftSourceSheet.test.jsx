import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftSourceSheet, { mockStorageKey, readLastMock, writeLastMock } from './DraftSourceSheet';

// The sheet that replaced the panel's raw "Draft ID" input. What matters here
// is that every route to a new id ends in one `onSelect` with that id, and
// that a typo never becomes one: the poll starts against whatever this hands
// back, so an invalid id is a sync that quietly fetches nothing.

const LEAGUE_DRAFT = {
    draft_id: '1312088290526003200',
    season: '2026',
    player_pool: 'Rookie',
    status: 'drafting',
};

const MOCK_ID = '9999999999999998847';

function renderSheet(overrides = {}) {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
        <DraftSourceSheet
            leagueDraft={LEAGUE_DRAFT}
            currentDraftId={LEAGUE_DRAFT.draft_id}
            lastMockId={null}
            onSelect={onSelect}
            onClose={onClose}
            {...overrides}
        />,
    );
    return { onSelect, onClose };
}

describe('DraftSourceSheet', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('marks the league draft as the live source when that is what sync is reading', () => {
        renderSheet();

        const leagueRow = screen.getByRole('button', { name: /League draft/ });
        expect(leagueRow).toHaveTextContent('2026 Rookie');
        // Last four only - the full id is 19 digits and says nothing at a glance.
        expect(leagueRow).toHaveTextContent('…3200');
        expect(leagueRow).toHaveTextContent('LIVE');
    });

    it('switches back to the league draft in one tap from a mock', async () => {
        const user = userEvent.setup();
        const { onSelect } = renderSheet({ currentDraftId: MOCK_ID, lastMockId: MOCK_ID });

        await user.click(screen.getByRole('button', { name: /League draft/ }));

        expect(onSelect).toHaveBeenCalledWith(LEAGUE_DRAFT.draft_id);
    });

    it('offers the last mock used as its own row', async () => {
        const user = userEvent.setup();
        const { onSelect } = renderSheet({ lastMockId: MOCK_ID });

        await user.click(screen.getByRole('button', { name: /Mock · last used/ }));

        expect(onSelect).toHaveBeenCalledWith(MOCK_ID);
    });

    it('accepts a pasted numeric id, trimming it', async () => {
        const user = userEvent.setup();
        const { onSelect } = renderSheet();

        await user.type(screen.getByLabelText('Mock draft ID'), '  1234567890  ');
        await user.click(screen.getByRole('button', { name: 'Use' }));

        expect(onSelect).toHaveBeenCalledWith('1234567890');
    });

    it('refuses a non-numeric id and says why rather than syncing against it', async () => {
        const user = userEvent.setup();
        const { onSelect } = renderSheet();

        await user.type(screen.getByLabelText('Mock draft ID'), 'https://sleeper.com/draft/nfl/123');
        await user.click(screen.getByRole('button', { name: 'Use' }));

        expect(onSelect).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/digits only/);
    });

    it('will not submit an empty field at all', () => {
        renderSheet();

        expect(screen.getByRole('button', { name: 'Use' })).toBeDisabled();
    });
});

describe('last mock persistence', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('round-trips per league draft, so two leagues do not share a mock', () => {
        writeLastMock('leagueA', '111');
        writeLastMock('leagueB', '222');

        expect(readLastMock('leagueA')).toBe('111');
        expect(readLastMock('leagueB')).toBe('222');
        expect(readLastMock('leagueC')).toBeNull();
        expect(localStorage.getItem(mockStorageKey('leagueA'))).toBe('111');
    });

    it('survives a storage backend that throws instead of returning null', () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError: private mode');
        });
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('SecurityError: private mode');
        });

        // Losing the remembered mock is a shrug; taking the draft screen down
        // over it is not.
        expect(() => writeLastMock('leagueA', '111')).not.toThrow();
        expect(readLastMock('leagueA')).toBeNull();

        getItem.mockRestore();
        setItem.mockRestore();
    });
});
