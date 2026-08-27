import {
	createUserWithEmailAndPassword,
	GoogleAuthProvider,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut as firebaseSignOut,
	updateProfile,
} from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

export async function signInWithEmail(email: string, password: string): Promise<void> {
	await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signUpWithEmail(email: string, password: string, displayName: string): Promise<void> {
	const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
	if (displayName.trim()) {
		// The auth-state listener that drives bootstrap can fire before this
		// resolves, so bootstrap re-syncs from `auth.currentUser` afterwards
		// (see `syncAccountAndUserDoc` in app/bootstrap.ts).
		await updateProfile(credential.user, { displayName: displayName.trim() });
	}
}

/**
 * Popup (not redirect) flow: `authDomain` (smokeless-eu.firebaseapp.com)
 * differs from this app's own origin, and `signInWithRedirect` relies on a
 * cross-origin storage relay between the two to hand back the result — one
 * that modern Chrome's third-party storage partitioning silently breaks
 * (getRedirectResult() resolves to null, no error, no sign-in). The popup
 * flow instead uses a live postMessage channel while the popup is open, so
 * it isn't affected by that partitioning.
 */
export async function signInWithGoogle(): Promise<void> {
	const provider = new GoogleAuthProvider();
	await signInWithPopup(getFirebaseAuth(), provider);
}

export async function resetPassword(email: string): Promise<void> {
	await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function signOut(): Promise<void> {
	await firebaseSignOut(getFirebaseAuth());
}

export function authErrorMessage(error: unknown): string {
	const code = (error as { code?: string })?.code ?? '';
	switch (code) {
		case 'auth/invalid-email':
			return 'That email address looks invalid.';
		case 'auth/user-disabled':
			return 'This account has been disabled.';
		case 'auth/user-not-found':
		case 'auth/wrong-password':
		case 'auth/invalid-credential':
			return 'Incorrect email or password.';
		case 'auth/email-already-in-use':
			return 'An account already exists with this email.';
		case 'auth/weak-password':
			return 'Password should be at least 6 characters.';
		case 'auth/popup-closed-by-user':
			return 'Google sign-in was cancelled.';
		case 'auth/network-request-failed':
			return 'Network error — check your connection and try again.';
		default:
			return 'Something went wrong. Please try again.';
	}
}
