import { onAuthStateChanged, signInAnonymously, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';

// Thin wrappers so App does not import firebase/auth directly. Each one
// swallows its own error the same way the rest of the app's requests do: a
// failed sign-in leaves the user signed out, which is already the state they
// are in, so there is nothing to recover beyond logging it.

/**
 * Subscribes to auth state. Returns the unsubscribe function - App calls it on
 * unmount, and dropping that is a leak (#102).
 */
export function observeAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * Signs in anonymously, which is what every visitor gets before they choose to
 * sign in with Google. Read access to the player database needs some identity.
 */
export function signInAnonymous() {
    return signInAnonymously(auth).catch((err) => console.error('Error:', err));
}

export function signInWithGoogle() {
    return signInWithPopup(auth, googleProvider).catch((error) => {
        console.error('Sign-in failed:', error);
    });
}

/**
 * Resolves to true only when the sign-out actually happened, so the caller
 * knows whether to clear anything tied to the signed-in user.
 */
export function signOutUser() {
    return signOut(auth)
        .then(() => true)
        .catch((error) => {
            console.error('Sign-out failed:', error);
            return false;
        });
}

/**
 * Whether the signed-in user is a real Google account rather than the
 * anonymous identity everyone starts with, plus the email to show for them.
 */
export function currentUserIdentity() {
    const { currentUser } = auth;
    return {
        signedIn: !currentUser.isAnonymous,
        signedInEmail: currentUser.email ? currentUser.email : null,
    };
}
