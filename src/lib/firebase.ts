/**
 * Firebase bootstrap.
 *
 * Unlike the Even Hub glasses app (which forces memory-only persistence to
 * work around a WebView that wipes IndexedDB on every restart), this is a
 * real installable PWA running in a normal browser — so we use Firebase's
 * standard durable persistence for both Auth and Firestore, and turn on
 * Firestore's offline cache so the app keeps working (reads + queued
 * writes) without a network connection.
 */

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import {
	type Firestore,
	getFirestore,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from 'firebase/firestore';
import { env } from '../config/env';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
	if (appInstance) return appInstance;
	// On App Hosting, env.firebaseConfig is undefined and initializeApp() with
	// no args picks up the FIREBASE_WEBAPP_CONFIG the SDK's postinstall script
	// injected at build time.
	appInstance = getApps().length > 0 ? getApps()[0]! : env.firebaseConfig ? initializeApp(env.firebaseConfig) : initializeApp();
	return appInstance;
}

export function getFirebaseAuth(): Auth {
	if (authInstance) return authInstance;
	// getAuth() already defaults to durable browserLocalPersistence and wires
	// up the default popup/redirect resolver — initializeAuth() with a custom
	// config is only needed to override those, which we don't need to here.
	authInstance = getAuth(ensureApp());
	return authInstance;
}

export function getFirebaseDb(): Firestore {
	if (firestoreInstance) return firestoreInstance;
	const app = ensureApp();
	try {
		// Persistent, multi-tab IndexedDB cache: reads work offline and
		// writes queue locally until connectivity returns.
		firestoreInstance = initializeFirestore(app, {
			localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
		});
	} catch {
		firestoreInstance = getFirestore(app);
	}
	return firestoreInstance;
}

export async function waitForInitialAuthState(): Promise<void> {
	await new Promise<void>((resolve) => {
		const unsubscribe = onAuthStateChanged(getFirebaseAuth(), () => {
			unsubscribe();
			resolve();
		});
	});
}

export function subscribeToAuthState(onValue: (user: User | null) => void): () => void {
	return onAuthStateChanged(getFirebaseAuth(), onValue);
}
