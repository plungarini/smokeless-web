import { appStore } from './store';
import { ensureUserDocument, subscribeToLastLogEntry, subscribeToTodayEntries, subscribeToUserDocument } from '../services/firestore';
import { signOut as firebaseSignOut } from '../services/auth';
import { getFirebaseAuth, subscribeToAuthState } from '../lib/firebase';

let unsubscribeUserDoc: (() => void) | null = null;
let unsubscribeTodayEntries: (() => void) | null = null;
let unsubscribeLastLog: (() => void) | null = null;
let started = false;

function teardownUserSubscriptions(): void {
	unsubscribeUserDoc?.();
	unsubscribeUserDoc = null;
	unsubscribeTodayEntries?.();
	unsubscribeTodayEntries = null;
	unsubscribeLastLog?.();
	unsubscribeLastLog = null;
}

async function bootForUid(uid: string, email: string, displayName: string): Promise<void> {
	teardownUserSubscriptions();

	try {
		await ensureUserDocument(uid, email, displayName);

		unsubscribeUserDoc = subscribeToUserDocument(uid, (doc) => appStore.setUserDocument(doc));
		unsubscribeTodayEntries = subscribeToTodayEntries(uid, (entries) => {
			appStore.setTodayEntries(entries);
			appStore.setTodayCount(entries.length);
		});
		unsubscribeLastLog = subscribeToLastLogEntry(uid, (entry) => appStore.setLastSmokeAt(entry?.timestamp ?? null));

		appStore.setPhase('ready');
	} catch (error) {
		console.error('[Smokeless] boot failed', error);
		appStore.setPhase('blocked', 'Smokeless could not load your data. Check your connection and try again.');
	}
}

export async function startBootstrap(): Promise<void> {
	if (started) return;
	started = true;

	subscribeToAuthState((user) => {
		if (user) {
			appStore.setAccount({
				uid: user.uid,
				email: user.email ?? '',
				displayName: user.displayName ?? '',
				isAnonymous: user.isAnonymous,
			});
			appStore.setCanonicalUid(user.uid);
			void bootForUid(user.uid, user.email ?? '', user.displayName ?? '');
		} else {
			teardownUserSubscriptions();
			appStore.setAccount(null);
			appStore.setCanonicalUid(null);
			appStore.setUserDocument(null);
			appStore.setPhase('auth');
		}
	});
}

/**
 * Re-reads `auth.currentUser` and re-syncs the account + Firestore doc.
 *
 * `updateProfile` (used right after sign-up) mutates the current user object
 * but does not re-fire `onAuthStateChanged`, and that listener may already
 * have run with a stale (empty) displayName. Call this after any profile
 * change so the store and the user's Firestore doc reflect the real name.
 */
export async function syncAccountAndUserDoc(): Promise<void> {
	const user = getFirebaseAuth().currentUser;
	if (!user) return;
	appStore.setAccount({
		uid: user.uid,
		email: user.email ?? '',
		displayName: user.displayName ?? '',
		isAnonymous: user.isAnonymous,
	});
	await ensureUserDocument(user.uid, user.email ?? '', user.displayName ?? '');
}

export async function signOutAndReset(): Promise<void> {
	teardownUserSubscriptions();
	await firebaseSignOut();
	appStore.resetForSignOut();
}
