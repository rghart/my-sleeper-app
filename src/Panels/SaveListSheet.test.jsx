import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveListSheet from './SaveListSheet';

// The three-action half of the sheet - update, fork, delete - only appears
// once a saved list is selected, and `currentListVal` reaches RanksPanel
// through the selector it publishes to the top bar. So the branch is driven
// here, off the prop that decides it, rather than through the panel.

const renderSheet = (overrides = {}) => {
    const props = {
        savedListName: 'My Rankings',
        playerCount: 48,
        onSaveNew: vi.fn().mockResolvedValue(true),
        onUpdate: vi.fn().mockResolvedValue(true),
        onDelete: vi.fn().mockResolvedValue(true),
        onClose: vi.fn(),
        ...overrides,
    };
    render(<SaveListSheet {...props} />);
    return props;
};

describe('SaveListSheet', () => {
    it('overwrites the selected list without asking for its name again', async () => {
        const user = userEvent.setup();
        const { onUpdate, onSaveNew, onClose } = renderSheet();

        await user.click(screen.getByRole('button', { name: 'Update' }));

        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onSaveNew).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('forks it under a new name, trimming what was typed', async () => {
        const user = userEvent.setup();
        const { onSaveNew, onUpdate } = renderSheet();

        await user.type(screen.getByLabelText('SAVE AS A NEW LIST'), '  Superflex  ');
        await user.click(screen.getByRole('button', { name: 'Save as new' }));

        expect(onSaveNew).toHaveBeenCalledWith('Superflex');
        expect(onUpdate).not.toHaveBeenCalled();
    });

    it('will not save a name too short to make a key from', async () => {
        const user = userEvent.setup();
        const { onSaveNew } = renderSheet();

        await user.type(screen.getByLabelText('SAVE AS A NEW LIST'), 'SF');
        expect(screen.getByRole('button', { name: 'Save as new' })).toBeDisabled();
        expect(onSaveNew).not.toHaveBeenCalled();
    });

    it('asks before deleting, because nothing else in the app undoes it', async () => {
        const user = userEvent.setup();
        const { onDelete, onClose } = renderSheet();

        await user.click(screen.getByRole('button', { name: 'Delete list' }));
        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.getByText(/Delete “My Rankings”/)).toBeVisible();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onDelete).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Delete list' }));
        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('reports a failed write instead of closing on it', async () => {
        const user = userEvent.setup();
        const { onClose } = renderSheet({ onUpdate: vi.fn().mockResolvedValue(false) });

        await user.click(screen.getByRole('button', { name: 'Update' }));

        expect(screen.getByRole('alert')).toBeVisible();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('shows only the name field when nothing is saved yet', () => {
        renderSheet({ savedListName: null });

        expect(screen.getByLabelText('LIST NAME')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save list' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Delete list' })).toBeNull();
    });
});
