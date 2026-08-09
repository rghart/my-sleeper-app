import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectSleeper from './ConnectSleeper';

const ACCOUNT = { userId: '521035584588267520', username: 'ryangh' };

const renderConnect = (overrides = {}) => {
    const props = {
        onConnect: vi.fn(),
        resolveUsername: vi.fn().mockResolvedValue(ACCOUNT),
        signedIn: false,
        signedInEmail: null,
        syncFailed: false,
        onSignIn: vi.fn(),
        ...overrides,
    };
    render(<ConnectSleeper {...props} />);
    return props;
};

const typeAndSubmit = async (username) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/sleeper username/i), username);
    await user.click(screen.getByRole('button', { name: /^connect$/i }));
};

describe('ConnectSleeper', () => {
    it('connects the account the username resolves to', async () => {
        const { onConnect, resolveUsername } = renderConnect();

        await typeAndSubmit('ryangh');

        expect(resolveUsername).toHaveBeenCalledWith('ryangh');
        expect(onConnect).toHaveBeenCalledWith(ACCOUNT);
    });

    // Leading/trailing whitespace is what you get from a paste or a phone
    // keyboard's autocomplete, and Sleeper 404s on it.
    it('trims the typed username before looking it up', async () => {
        const { resolveUsername } = renderConnect();

        await typeAndSubmit('  ryangh  ');

        expect(resolveUsername).toHaveBeenCalledWith('ryangh');
    });

    // The two failure modes have to read differently. A typo is the common
    // case and retrying it fails identically, so the message says to check the
    // spelling; an unreachable API is the one worth trying again.
    it('says to check the spelling when nobody owns the username', async () => {
        const { onConnect } = renderConnect({ resolveUsername: vi.fn().mockResolvedValue(null) });

        await typeAndSubmit('nobdy');

        expect(await screen.findByRole('alert')).toHaveTextContent(/check the spelling/i);
        expect(onConnect).not.toHaveBeenCalled();
    });

    it('reports an unreachable Sleeper as a retryable problem instead', async () => {
        const { onConnect } = renderConnect({ resolveUsername: vi.fn().mockResolvedValue(undefined) });

        await typeAndSubmit('ryangh');

        expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach sleeper/i);
        expect(onConnect).not.toHaveBeenCalled();
    });

    it('does not look anything up for an empty username', async () => {
        const { resolveUsername } = renderConnect();

        await userEvent.setup().click(screen.getByRole('button', { name: /^connect$/i }));

        expect(resolveUsername).not.toHaveBeenCalled();
    });

    // Sign-in is genuinely optional here - connecting a Sleeper account works
    // signed out - so the offer is an aside, and it goes away once taken.
    it('offers Google sign-in to a signed-out visitor', async () => {
        const { onSignIn } = renderConnect();

        await userEvent.setup().click(screen.getByRole('button', { name: /sign in with google/i }));

        expect(onSignIn).toHaveBeenCalled();
    });

    it('does not offer sign-in to someone already signed in', () => {
        renderConnect({ signedIn: true });

        expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
    });
    // Signing in here produces no account and cannot - there is nothing saved
    // for a first-time user to load - so the screen has to say why it is still
    // asking. Left unexplained it reads as the sign-in having failed.
    describe('once signed in', () => {
        it('explains that nothing is saved yet rather than going silent', () => {
            renderConnect({ signedIn: true, signedInEmail: 'ryan@example.com' });

            expect(screen.getByText(/no sleeper account saved yet/i)).toBeInTheDocument();
            expect(screen.getByText(/ryan@example.com/)).toBeInTheDocument();
        });

        // The distinction the whole flag exists for: "nothing saved" and
        // "could not read what is saved" look identical from this screen, and
        // only the second one means connecting will not roam.
        it('says so when the saved account could not be read at all', () => {
            renderConnect({ signedIn: true, signedInEmail: 'ryan@example.com', syncFailed: true });

            expect(screen.getByRole('status')).toHaveTextContent(/couldn.t be read/i);
            expect(screen.queryByText(/no sleeper account saved yet/i)).not.toBeInTheDocument();
        });

        it('still connects normally in that state, since this device works', async () => {
            const { onConnect } = renderConnect({ signedIn: true, syncFailed: true });

            await typeAndSubmit('ryangh');

            expect(onConnect).toHaveBeenCalledWith(ACCOUNT);
        });

        it('names no email when the account has none to show', () => {
            renderConnect({ signedIn: true, signedInEmail: null });

            expect(screen.getByText(/^Signed in\. No Sleeper account saved yet/)).toBeInTheDocument();
        });
    });
});
