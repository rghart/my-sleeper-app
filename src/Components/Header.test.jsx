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

    it('shows no timestamp line at all until there is a timestamp', () => {
        // lastUpdate starts null and its request is deliberately not awaited,
        // so this state is on screen during every load. `new Date(null)` is the
        // epoch, which rendered as a confident "Wed Dec 31 1969".
        renderHeader({ lastUpdate: null });

        expect(screen.queryByText(/Latest player DB update attempt:/)).toBeNull();
        expect(screen.queryByText(/1969/)).toBeNull();
        // The rest of the header still renders - the missing timestamp costs
        // one line, not the sign-in control.
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    });
});
