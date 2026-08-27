const REQUIRED_VARS = [
	'VITE_FIREBASE_API_KEY',
	'VITE_FIREBASE_AUTH_DOMAIN',
	'VITE_FIREBASE_PROJECT_ID',
	'VITE_FIREBASE_STORAGE_BUCKET',
	'VITE_FIREBASE_MESSAGING_SENDER_ID',
	'VITE_FIREBASE_APP_ID',
] as const;

function readEnv() {
	const values = import.meta.env;
	const missing = REQUIRED_VARS.filter((key) => !values[key]);
	if (missing.length > 0) {
		throw new Error(`Missing required env vars: ${missing.join(', ')}`);
	}
	return values;
}

const values = readEnv();

export const env = {
	firebaseConfig: {
		apiKey: values.VITE_FIREBASE_API_KEY as string,
		authDomain: values.VITE_FIREBASE_AUTH_DOMAIN as string,
		projectId: values.VITE_FIREBASE_PROJECT_ID as string,
		storageBucket: values.VITE_FIREBASE_STORAGE_BUCKET as string,
		messagingSenderId: values.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
		appId: values.VITE_FIREBASE_APP_ID as string,
	},
};
