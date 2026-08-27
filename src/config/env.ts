const REQUIRED_VARS = [
	'VITE_FIREBASE_API_KEY',
	'VITE_FIREBASE_AUTH_DOMAIN',
	'VITE_FIREBASE_PROJECT_ID',
	'VITE_FIREBASE_STORAGE_BUCKET',
	'VITE_FIREBASE_MESSAGING_SENDER_ID',
	'VITE_FIREBASE_APP_ID',
] as const;

/**
 * Local dev/build reads Firebase config from `.env` (VITE_FIREBASE_*). On
 * Firebase App Hosting we deliberately don't set those — App Hosting injects
 * FIREBASE_WEBAPP_CONFIG at build time and Firebase JS SDK's postinstall
 * script picks it up automatically, so `initializeApp()` can be called with
 * no arguments there instead. `firebaseConfig` is `undefined` in that case.
 */
function readFirebaseConfig() {
	const values = import.meta.env;
	const missing = REQUIRED_VARS.filter((key) => !values[key]);
	if (missing.length === REQUIRED_VARS.length) return undefined;
	if (missing.length > 0) {
		throw new Error(`Missing required env vars: ${missing.join(', ')}`);
	}
	return {
		apiKey: values.VITE_FIREBASE_API_KEY as string,
		authDomain: values.VITE_FIREBASE_AUTH_DOMAIN as string,
		projectId: values.VITE_FIREBASE_PROJECT_ID as string,
		storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET as string,
		messagingSenderId: values.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
		appId: values.VITE_FIREBASE_APP_ID as string,
	};
}

export const env = {
	firebaseConfig: readFirebaseConfig(),
};
