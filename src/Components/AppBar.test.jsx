import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppBar from './AppBar';
import { SyncStatusProvider, usePublishSyncStatus } from '../SyncStatus.jsx';

// The top bar is the only place the signed-in/signed-out distinction used to
// be visible directly; it now lives in the drawer the hamburger opens, so
// most of this file opens the drawer first. App.test.jsx runs entirely as an
// anonymous user, so the signed-in half of this had no coverage at all
// before it was a component of its own.

function renderAppBar(overrides = {}) {
    const props = {
        signedIn: false,
        signedInEmail: null,
        myDisplayName: null,
        onSignIn: vi.fn(),
        onSignOut: vi.fn(),
        sleeperUsername: null,
        onDisconnectSleeper: vi.fn(),
        ...overrides,
    };
    const result = render(<AppBar {...props} />);
    return { ...props, ...result };
}

async function openDrawer(user) {
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
}

describe('AppBar', () => {
    it('offers sign in, and shows no identity, when signed out', async () => {
        const user = userEvent.setup();
        renderAppBar();
        await openDrawer(user);

        expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'sign out' })).toBeNull();
    });

    it('shows the signed-in email and offers sign out', async () => {
        const user = userEvent.setup();
        renderAppBar({ signedIn: true, signedInEmail: 'someone@example.test' });
        await openDrawer(user);

        expect(screen.getByText('someone@example.test')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'sign out' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
    });

    it('reports sign in to its caller rather than acting itself', async () => {
        const user = userEvent.setup();
        const { onSignIn } = renderAppBar();
        await openDrawer(user);

        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(onSignIn).toHaveBeenCalledTimes(1);
    });

    it('reports sign out to its caller rather than acting itself', async () => {
        const user = userEvent.setup();
        const { onSignOut } = renderAppBar({ signedIn: true, signedInEmail: 'someone@example.test' });
        await openDrawer(user);

        await user.click(screen.getByRole('button', { name: 'sign out' }));

        expect(onSignOut).toHaveBeenCalledTimes(1);
    });

    it('does not render the player database timestamp any more', () => {
        // The timestamp and fetchLatestUpdateAttempt were deleted outright,
        // not moved - there is nothing left that could render this line.
        renderAppBar();

        expect(screen.queryByText(/Latest player DB update attempt:/)).toBeNull();
    });

    describe('the hamburger', () => {
        it('is closed by default and opens the drawer on click', async () => {
            const user = userEvent.setup();
            renderAppBar();

            const hamburger = screen.getByRole('button', { name: 'Open menu' });
            expect(hamburger).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryByRole('dialog')).toBeNull();

            await user.click(hamburger);

            expect(hamburger).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByRole('dialog')).toBeTruthy();
            expect(hamburger.getAttribute('aria-controls')).toBe(screen.getByRole('dialog').id);
        });

        it('closes the drawer on a scrim click and returns focus to the hamburger', async () => {
            const user = userEvent.setup();
            const { container } = renderAppBar();
            const hamburger = screen.getByRole('button', { name: 'Open menu' });

            await user.click(hamburger);
            expect(screen.getByRole('dialog')).toBeTruthy();

            const scrim = container.querySelector('[aria-hidden="true"]');
            await user.click(scrim);

            expect(screen.queryByRole('dialog')).toBeNull();
            expect(hamburger).toHaveAttribute('aria-expanded', 'false');
            expect(document.activeElement).toBe(hamburger);
        });

        it('closes the drawer on Escape', async () => {
            const user = userEvent.setup();
            renderAppBar();

            await user.click(screen.getByRole('button', { name: 'Open menu' }));
            expect(screen.getByRole('dialog')).toBeTruthy();

            await user.keyboard('{Escape}');

            expect(screen.queryByRole('dialog')).toBeNull();
        });
    });

    describe('the avatar', () => {
        it('shows the first two initials of a multi-word display name, uppercased', () => {
            renderAppBar({ myDisplayName: 'ryan hart' });

            expect(screen.getByText('RH')).toBeTruthy();
        });

        it('falls back to the first two characters of a single-word name', () => {
            renderAppBar({ myDisplayName: 'ryangh' });

            expect(screen.getByText('RY')).toBeTruthy();
        });

        it('renders nothing rather than "undefined" when there is no display name', () => {
            renderAppBar({ myDisplayName: null });

            expect(screen.queryByText('undefined')).toBeNull();
        });
    });

    describe('the league pill', () => {
        const leagueProps = {
            leagueID: '1',
            leagueIds: [
                { league_id: '1', name: 'Test League' },
                { league_id: '2', name: '4 QB Madness' },
            ],
            updateLeagueID: vi.fn(),
        };

        it('renders when league props are given', () => {
            renderAppBar(leagueProps);

            expect(screen.getByRole('combobox', { name: 'League' })).toBeTruthy();
        });

        it('is absent when there is no league to switch between', () => {
            renderAppBar();

            expect(screen.queryByRole('combobox', { name: 'League' })).toBeNull();
        });
    });

    describe('the live-sync pill', () => {
        const Publisher = ({ isSyncing }) => {
            usePublishSyncStatus(isSyncing);
            return null;
        };

        const renderWithSync = (isSyncing) =>
            render(
                <SyncStatusProvider>
                    <Publisher isSyncing={isSyncing} />
                    <AppBar
                        signedIn={false}
                        signedInEmail={null}
                        myDisplayName={null}
                        onSignIn={vi.fn()}
                        onSignOut={vi.fn()}
                    />
                </SyncStatusProvider>,
            );

        it('is hidden when sync is off', () => {
            renderWithSync(false);

            expect(screen.queryByText('SYNC')).toBeNull();
        });

        it('shows when sync is on', () => {
            renderWithSync(true);

            expect(screen.getByText('SYNC')).toBeTruthy();
            expect(screen.getByText('SYNCING')).toBeTruthy();
        });
    });
    // The connected Sleeper account is a second identity from the Google one:
    // it decides whose leagues you see, not where your rank lists are saved.
    // The drawer shows both, and they have to stay tellable apart.
    describe('the connected Sleeper account', () => {
        it('shows the connected username', async () => {
            const user = userEvent.setup();
            renderAppBar({ sleeperUsername: 'ryangh' });
            await openDrawer(user);

            expect(screen.getByText('ryangh')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
        });

        it('offers nothing to disconnect when no account is connected', async () => {
            const user = userEvent.setup();
            renderAppBar();
            await openDrawer(user);

            expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument();
        });

        // Disconnecting clears the account for the signed-in user everywhere,
        // not just on this device, so a stray tap must not do it.
        it('asks before disconnecting rather than acting on the first tap', async () => {
            const user = userEvent.setup();
            const { onDisconnectSleeper } = renderAppBar({ sleeperUsername: 'ryangh' });
            await openDrawer(user);

            await user.click(screen.getByRole('button', { name: /disconnect/i }));

            expect(onDisconnectSleeper).not.toHaveBeenCalled();
            expect(screen.getByText(/disconnect .ryangh./i)).toBeInTheDocument();
        });

        it('reports the disconnect to its caller once confirmed', async () => {
            const user = userEvent.setup();
            const { onDisconnectSleeper } = renderAppBar({ sleeperUsername: 'ryangh' });
            await openDrawer(user);

            await user.click(screen.getByRole('button', { name: /disconnect/i }));
            await user.click(screen.getByRole('button', { name: 'Disconnect' }));

            expect(onDisconnectSleeper).toHaveBeenCalledTimes(1);
        });

        it('backs out of the confirmation without disconnecting', async () => {
            const user = userEvent.setup();
            const { onDisconnectSleeper } = renderAppBar({ sleeperUsername: 'ryangh' });
            await openDrawer(user);

            await user.click(screen.getByRole('button', { name: /disconnect/i }));
            await user.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(onDisconnectSleeper).not.toHaveBeenCalled();
            expect(screen.getByText('ryangh')).toBeInTheDocument();
        });
    });
});
