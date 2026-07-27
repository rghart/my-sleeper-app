import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from './Header';

// The top bar is the only place the signed-in/signed-out distinction is
// visible. App.test.jsx runs entirely as an anonymous user, so the signed-in
// half of this had no coverage at all before it was a component of its own.

const LAST_UPDATE = '2026-01-01T00:00:00.000Z';

function renderHeader(overrides = {}) {
    const props = {
        signedIn: false,
        signedInEmail: null,
        lastUpdate: LAST_UPDATE,
        onSignIn: vi.fn(),
        onSignOut: vi.fn(),
        ...overrides,
    };
    render(<Header {...props} />);
    return props;
}

describe('Header', () => {
    it('offers sign in, and shows no identity, when signed out', () => {
        renderHeader();

        expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    });

    it('shows the signed-in email and offers sign out', () => {
        renderHeader({ signedIn: true, signedInEmail: 'someone@example.test' });

        expect(screen.getByText('someone@example.test')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    });

    it('reports sign in and sign out to its caller rather than acting itself', async () => {
        const user = userEvent.setup();
        const { onSignIn } = renderHeader();

        await user.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(onSignIn).toHaveBeenCalledTimes(1);

        const { onSignOut } = renderHeader({ signedIn: true, signedInEmail: 'someone@example.test' });
        await user.click(screen.getByRole('button', { name: 'Sign out' }));
        expect(onSignOut).toHaveBeenCalledTimes(1);
    });

    it('renders the player database timestamp', () => {
        renderHeader();

        expect(screen.getByText(/Latest player DB update attempt:/)).toHaveTextContent(
            new Date(LAST_UPDATE).toString(),
        );
    });
});
