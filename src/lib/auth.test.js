import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { onAuthStateChanged, signInAnonymously, signInWithPopup, signOut } from 'firebase/auth';
import { currentUserIdentity, observeAuthState, signInAnonymous, signInWithGoogle, signOutUser } from './auth.js';

const authMock = vi.hoisted(() => ({ currentUser: {} }));

vi.mock('../firebase.js', () => ({
    auth: authMock,
    googleProvider: { providerId: 'google.com' },
}));

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn(),
    signInAnonymously: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
}));

describe('currentUserIdentity', () => {
    it('treats the anonymous identity everyone starts with as signed out', () => {
        authMock.currentUser = { isAnonymous: true, email: null };

        expect(currentUserIdentity()).toEqual({ signedIn: false, signedInEmail: null });
    });

    it('reports a real account as signed in, with its email', () => {
        authMock.currentUser = { isAnonymous: false, email: 'someone@example.test' };

        expect(currentUserIdentity()).toEqual({ signedIn: true, signedInEmail: 'someone@example.test' });
    });

    it('normalises a missing email to null rather than undefined', () => {
        // The email renders directly, so undefined would reach the DOM.
        authMock.currentUser = { isAnonymous: false, email: undefined };

        expect(currentUserIdentity().signedInEmail).toBeNull();
    });
});

describe('observeAuthState', () => {
    it('hands back the unsubscribe function, which App needs on unmount', () => {
        // Losing this is the leak fixed in #102.
        const unsubscribe = vi.fn();
        onAuthStateChanged.mockReturnValue(unsubscribe);

        expect(observeAuthState(vi.fn())).toBe(unsubscribe);
    });
});

describe('the sign-in and sign-out wrappers', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('signOutUser resolves true when the sign-out succeeded', async () => {
        signOut.mockResolvedValue(undefined);

        await expect(signOutUser()).resolves.toBe(true);
    });

    it('signOutUser resolves false rather than rejecting when it failed', async () => {
        // App clears the signed-in user's rank list on the strength of this
        // answer, so a failure has to be distinguishable from a success -
        // dropping their list while they are still signed in is worse than the
        // failed sign-out itself.
        signOut.mockRejectedValue(new Error('network'));

        await expect(signOutUser()).resolves.toBe(false);
    });

    it('signInWithGoogle swallows a cancelled or failed popup', async () => {
        signInWithPopup.mockRejectedValue(new Error('popup closed'));

        await expect(signInWithGoogle()).resolves.toBeUndefined();
    });

    it('signInAnonymous swallows its own failure', async () => {
        signInAnonymously.mockRejectedValue(new Error('offline'));

        await expect(signInAnonymous()).resolves.toBeUndefined();
    });
});
