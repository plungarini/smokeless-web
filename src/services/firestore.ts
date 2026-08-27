import {
	type DocumentSnapshot,
	type QueryDocumentSnapshot,
	type Timestamp,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	limit,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	startAfter,
	where,
	writeBatch,
} from 'firebase/firestore';
import { computeLongestCessation } from '../domain/calculations';
import type { HistoryDayGroup, SmokeLogEntry, UserDocument, UserPreferences } from '../domain/types';
import { getFirebaseDb } from '../lib/firebase';
import { addDays, parseDayKey, startOfDay, toDayKey, toMonthKey } from '../lib/time';

export type HistoryCursor = QueryDocumentSnapshot | null;

const DEFAULT_PREFERENCES: UserPreferences = {
	locale: 'en',
	themeMode: 'dark',
	weekStart: 'Monday',
};

function userRef(uid: string) {
	return doc(getFirebaseDb(), 'users', uid);
}

function logsRef(uid: string) {
	return collection(getFirebaseDb(), 'users', uid, 'logs');
}

function toDate(value: unknown): Date | null {
	if (!value) return null;
	if (
		typeof value === 'object' &&
		value !== null &&
		'toDate' in value &&
		typeof (value as Timestamp).toDate === 'function'
	) {
		return (value as Timestamp).toDate();
	}
	return null;
}

function mapUserDocument(snapshot: DocumentSnapshot): UserDocument | null {
	if (!snapshot.exists()) return null;

	const data = snapshot.data({ serverTimestamps: 'estimate' }) ?? {};
	const preferences = (data.preferences as Record<string, unknown> | undefined) ?? {};

	return {
		createdAt: toDate(data.createdAt),
		updatedAt: toDate(data.updatedAt),
		longestEverCessation: Number(data.longestEverCessation ?? 0),
		todayMaxCessation:
			data.todayMaxCessation && typeof data.todayMaxCessation === 'object'
				? {
						value: Number((data.todayMaxCessation as Record<string, unknown>).value ?? 0),
						lastUpdated: toDate((data.todayMaxCessation as Record<string, unknown>).lastUpdated),
					}
				: null,
		preferences: {
			locale: String(preferences.locale ?? DEFAULT_PREFERENCES.locale),
			themeMode: String(preferences.themeMode ?? DEFAULT_PREFERENCES.themeMode),
			weekStart: String(preferences.weekStart ?? DEFAULT_PREFERENCES.weekStart),
		},
		displayName: String(data.displayName ?? ''),
		email: String(data.email ?? ''),
	};
}

function mapLogSnapshot(snapshot: DocumentSnapshot | QueryDocumentSnapshot): SmokeLogEntry {
	const data = snapshot.data() ?? {};
	return {
		id: snapshot.id,
		timestamp: toDate(data.timestamp) ?? new Date(),
		intervalSincePrevious:
			typeof data.intervalSincePrevious === 'number'
				? data.intervalSincePrevious
				: data.intervalSincePrevious === null || data.intervalSincePrevious === undefined
					? null
					: Number(data.intervalSincePrevious),
	};
}

function buildTodayMaxCessation(
	entries: SmokeLogEntry[],
	now = new Date(),
): { value: number; lastUpdated: Date } | null {
	const dayStart = startOfDay(now);
	const sorted = [...entries].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
	let maxSeconds = 0;
	let hasSmokesToday = false;
	let previousTimestamp: Date | null = null;

	for (const entry of sorted) {
		if (entry.timestamp < dayStart) {
			previousTimestamp = entry.timestamp;
			continue;
		}
		hasSmokesToday = true;
		if (previousTimestamp !== null) {
			const gapSeconds = Math.max(0, Math.round((entry.timestamp.getTime() - previousTimestamp.getTime()) / 1000));
			maxSeconds = Math.max(maxSeconds, gapSeconds);
		}
		previousTimestamp = entry.timestamp;
	}

	if (!hasSmokesToday) return null;

	return {
		value: maxSeconds,
		lastUpdated: now,
	};
}

function buildDailyCounts(entries: SmokeLogEntry[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const entry of entries) {
		const dayKey = toDayKey(entry.timestamp);
		counts[dayKey] = (counts[dayKey] ?? 0) + 1;
	}
	return counts;
}

function buildMonthlyCounts(entries: SmokeLogEntry[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const entry of entries) {
		const monthKey = toMonthKey(entry.timestamp);
		counts[monthKey] = (counts[monthKey] ?? 0) + 1;
	}
	return counts;
}

export function deriveStatsFromLogs(entries: SmokeLogEntry[]): {
	daily: Record<string, number>;
	monthly: Record<string, number>;
	lastSmokeAt: Date | null;
} {
	const sorted = [...entries].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
	return {
		daily: buildDailyCounts(sorted),
		monthly: buildMonthlyCounts(sorted),
		lastSmokeAt: sorted[sorted.length - 1]?.timestamp ?? null,
	};
}

async function getLogPage(uid: string, pageSize: number, cursor: QueryDocumentSnapshot | null) {
	return cursor
		? getDocs(query(logsRef(uid), orderBy('timestamp', 'desc'), startAfter(cursor), limit(pageSize)))
		: getDocs(query(logsRef(uid), orderBy('timestamp', 'desc'), limit(pageSize)));
}

async function clearLogs(uid: string): Promise<void> {
	while (true) {
		const snapshot = await getDocs(query(logsRef(uid), orderBy('timestamp'), limit(200)));
		if (snapshot.empty) break;

		const batch = writeBatch(getFirebaseDb());
		snapshot.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
		await batch.commit();

		if (snapshot.size < 200) break;
	}
}

export async function fetchUserDocument(uid: string): Promise<UserDocument | null> {
	const snapshot = await getDoc(userRef(uid));
	return mapUserDocument(snapshot);
}

export function subscribeToUserDocument(uid: string, onValue: (document: UserDocument | null) => void): () => void {
	return onSnapshot(userRef(uid), (snapshot) => {
		onValue(mapUserDocument(snapshot));
	});
}

/**
 * Real-time subscriptions.
 *
 * Firestore's local write cache means these fire almost instantly on writes
 * — including "optimistic" updates for the tab that made the write, before
 * the server round-trip completes — so the UI reflects add/delete actions
 * without any manual re-fetch, and picks up changes made from other tabs
 * or devices too.
 */

export function subscribeToTodayEntries(uid: string, onValue: (entries: SmokeLogEntry[]) => void): () => void {
	const now = new Date();
	const dayStart = startOfDay(now);
	const dayEnd = addDays(dayStart, 1);
	return onSnapshot(
		query(logsRef(uid), where('timestamp', '>=', dayStart), where('timestamp', '<', dayEnd), orderBy('timestamp', 'asc')),
		(snapshot) => {
			onValue(snapshot.docs.map(mapLogSnapshot));
		},
	);
}

export function subscribeToLastLogEntry(uid: string, onValue: (entry: SmokeLogEntry | null) => void): () => void {
	return onSnapshot(query(logsRef(uid), orderBy('timestamp', 'desc'), limit(1)), (snapshot) => {
		onValue(snapshot.empty ? null : mapLogSnapshot(snapshot.docs[0]!));
	});
}

export function subscribeToEntriesInRange(
	uid: string,
	from: Date,
	to: Date,
	onValue: (entries: SmokeLogEntry[]) => void,
): () => void {
	return onSnapshot(
		query(logsRef(uid), where('timestamp', '>=', from), where('timestamp', '<=', to), orderBy('timestamp', 'asc')),
		(snapshot) => {
			onValue(snapshot.docs.map(mapLogSnapshot));
		},
	);
}

export function subscribeToEntriesForDay(uid: string, dayKey: string, onValue: (entries: SmokeLogEntry[]) => void): () => void {
	const dayStart = parseDayKey(dayKey);
	const dayEnd = addDays(dayStart, 1);
	return onSnapshot(
		query(logsRef(uid), where('timestamp', '>=', dayStart), where('timestamp', '<', dayEnd), orderBy('timestamp', 'desc')),
		(snapshot) => {
			onValue(snapshot.docs.map(mapLogSnapshot));
		},
	);
}

export function subscribeToDailyCounts(uid: string, daysBack: number, onValue: (counts: Record<string, number>) => void): () => void {
	const start = addDays(new Date(), -daysBack);
	return onSnapshot(query(logsRef(uid), where('timestamp', '>=', start), orderBy('timestamp', 'asc')), (snapshot) => {
		onValue(buildDailyCounts(snapshot.docs.map(mapLogSnapshot)));
	});
}

export function subscribeToMonthlyCounts(uid: string, monthsBack: number, onValue: (counts: Record<string, number>) => void): () => void {
	const start = new Date(new Date().getFullYear(), new Date().getMonth() - (monthsBack - 1), 1);
	return onSnapshot(query(logsRef(uid), where('timestamp', '>=', start), orderBy('timestamp', 'asc')), (snapshot) => {
		onValue(buildMonthlyCounts(snapshot.docs.map(mapLogSnapshot)));
	});
}

export function subscribeToMonthDayKeys(uid: string, monthDate: Date, onValue: (dayKeys: string[]) => void): () => void {
	const monthStartDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
	return onSnapshot(
		query(logsRef(uid), where('timestamp', '>=', monthStartDate), where('timestamp', '<', monthEnd), orderBy('timestamp', 'asc')),
		(snapshot) => {
			const seen = new Set<string>();
			for (const docSnapshot of snapshot.docs) {
				seen.add(toDayKey(mapLogSnapshot(docSnapshot).timestamp));
			}
			onValue([...seen]);
		},
	);
}

export async function fetchAllLogEntries(uid: string): Promise<SmokeLogEntry[]> {
	const entries: SmokeLogEntry[] = [];
	let cursor: QueryDocumentSnapshot | null = null;

	while (true) {
		const snapshot = await getLogPage(uid, 200, cursor);
		if (snapshot.empty) break;

		snapshot.forEach((docSnapshot) => {
			entries.push(mapLogSnapshot(docSnapshot));
		});

		cursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
		if (snapshot.size < 200) break;
	}

	return entries.sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
}

export async function ensureUserDocument(uid: string, email: string, displayName: string): Promise<void> {
	// Only include displayName/email when non-empty: the boot flow can call
	// this with a stale (empty) name before a just-created account's
	// updateProfile call has resolved, and a merge write would otherwise be
	// able to clobber a correct name written moments later, or vice versa,
	// depending on which write lands last.
	await setDoc(
		userRef(uid),
		{
			...(email ? { email } : {}),
			...(displayName ? { displayName } : {}),
			preferences: DEFAULT_PREFERENCES,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		},
		{ merge: true },
	);
}

async function updateUserMetricsFast(uid: string, newTimestamp: Date, newInterval: number | null): Promise<void> {
	const now = new Date();
	const dayStart = startOfDay(now);
	const newEntryIsToday = newTimestamp >= dayStart;

	const [userDocSnap, todaySnap] = await Promise.all([
		getDoc(userRef(uid)),
		newEntryIsToday
			? getDocs(query(logsRef(uid), where('timestamp', '>=', dayStart), orderBy('timestamp', 'asc')))
			: Promise.resolve(null),
	]);

	const data = userDocSnap.exists() ? userDocSnap.data()! : {};
	const currentLongest = Number(data.longestEverCessation ?? 0);

	let newLongest = currentLongest;
	if (newInterval !== null && newInterval > currentLongest) {
		newLongest = newInterval;
	}

	let newTodayMax: { value: number; lastUpdated: Date } | null = null;
	if (newEntryIsToday && todaySnap) {
		const todayEntries = todaySnap.docs.map(mapLogSnapshot);
		newTodayMax = buildTodayMaxCessation(todayEntries, now);
	}

	const currentTodayMax = (data as Record<string, unknown>).todayMaxCessation;
	const currentTodayMaxValue =
		currentTodayMax && typeof currentTodayMax === 'object' && 'value' in currentTodayMax
			? Number((currentTodayMax as Record<string, unknown>).value ?? 0)
			: 0;
	const newTodayMaxValue = newTodayMax?.value ?? 0;

	const shouldUpdateLongest = newLongest !== currentLongest;
	const shouldUpdateToday = newEntryIsToday && newTodayMaxValue !== currentTodayMaxValue;

	if (shouldUpdateLongest || shouldUpdateToday) {
		await setDoc(
			userRef(uid),
			{
				...(shouldUpdateLongest ? { longestEverCessation: newLongest } : {}),
				...(shouldUpdateToday ? { todayMaxCessation: newTodayMax } : {}),
				updatedAt: serverTimestamp(),
			},
			{ merge: true },
		);
	}
}

export async function addSmokeEntry(uid: string, timestamp = new Date()): Promise<string> {
	const [previousSnap, nextSnap] = await Promise.all([
		getDocs(query(logsRef(uid), where('timestamp', '<=', timestamp), orderBy('timestamp', 'desc'), limit(1))),
		getDocs(query(logsRef(uid), where('timestamp', '>', timestamp), orderBy('timestamp', 'asc'), limit(1))),
	]);

	const previous = previousSnap.empty ? null : mapLogSnapshot(previousSnap.docs[0]!);
	const next = nextSnap.empty ? null : mapLogSnapshot(nextSnap.docs[0]!);

	const intervalSincePrevious = previous
		? Math.max(0, Math.round((timestamp.getTime() - previous.timestamp.getTime()) / 1000))
		: null;

	const logDoc = doc(logsRef(uid));

	const batch = writeBatch(getFirebaseDb());
	batch.set(logDoc, { timestamp, intervalSincePrevious });
	if (next) {
		batch.update(doc(getFirebaseDb(), 'users', uid, 'logs', next.id), {
			intervalSincePrevious: Math.max(0, Math.round((next.timestamp.getTime() - timestamp.getTime()) / 1000)),
		});
	}
	await batch.commit();

	void updateUserMetricsFast(uid, timestamp, intervalSincePrevious).catch((err) => {
		console.warn('[firestore] background metrics update failed', err);
	});

	return logDoc.id;
}

export async function deleteLogEntry(uid: string, logId: string): Promise<void> {
	const entrySnap = await getDoc(doc(getFirebaseDb(), 'users', uid, 'logs', logId));
	if (!entrySnap.exists()) return;
	const entry = mapLogSnapshot(entrySnap);

	const [previousSnap, nextSnap] = await Promise.all([
		getDocs(query(logsRef(uid), where('timestamp', '<', entry.timestamp), orderBy('timestamp', 'desc'), limit(1))),
		getDocs(query(logsRef(uid), where('timestamp', '>=', entry.timestamp), orderBy('timestamp', 'asc'), limit(2))),
	]);

	const previous = previousSnap.empty ? null : mapLogSnapshot(previousSnap.docs[0]!);
	const next = nextSnap.docs.map(mapLogSnapshot).filter((d) => d.id !== entry.id)[0] ?? null;

	const batch = writeBatch(getFirebaseDb());
	batch.delete(doc(getFirebaseDb(), 'users', uid, 'logs', logId));

	if (next) {
		batch.update(doc(getFirebaseDb(), 'users', uid, 'logs', next.id), {
			intervalSincePrevious: previous
				? Math.max(0, Math.round((next.timestamp.getTime() - previous.timestamp.getTime()) / 1000))
				: null,
		});
	}

	await batch.commit();
}

export async function fetchHistoryPage(
	uid: string,
	cursor: HistoryCursor,
): Promise<{ groups: HistoryDayGroup[]; cursor: HistoryCursor; hasMore: boolean }> {
	const groups: HistoryDayGroup[] = [];
	let lastProcessed: QueryDocumentSnapshot | null = cursor;
	let nextCursor: QueryDocumentSnapshot | null = cursor;
	let hasMore = false;
	let pendingCursor = cursor;

	while (groups.length < 30) {
		const snapshot = await getLogPage(uid, 200, pendingCursor);
		if (snapshot.empty) {
			nextCursor = null;
			hasMore = false;
			break;
		}

		let reachedLimit = false;

		for (const docSnapshot of snapshot.docs) {
			const log = mapLogSnapshot(docSnapshot);
			lastProcessed = docSnapshot;
			const dayKey = toDayKey(log.timestamp);
			const lastGroup = groups[groups.length - 1];

			if (!lastGroup || lastGroup.dayKey !== dayKey) {
				if (groups.length === 30) {
					reachedLimit = true;
					break;
				}
				groups.push({
					dayKey,
					date: parseDayKey(dayKey),
					count: 0,
					entries: [],
				});
			}

			const currentGroup = groups[groups.length - 1]!;
			currentGroup.entries.push(log);
			currentGroup.count += 1;
		}

		if (reachedLimit) {
			nextCursor = lastProcessed;
			hasMore = true;
			break;
		}

		pendingCursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
		nextCursor = pendingCursor;
		hasMore = snapshot.size === 200;
		if (snapshot.size < 200) break;
	}

	return { groups, cursor: nextCursor, hasMore };
}

export async function exportLogs(
	uid: string,
): Promise<{ exportedAt: string; logs: Array<Record<string, string | number | null>> }> {
	const entries = await fetchAllLogEntries(uid);
	return {
		exportedAt: new Date().toISOString(),
		logs: entries
			.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
			.map((entry) => ({
				id: entry.id,
				timestamp: entry.timestamp.toISOString(),
				intervalSincePrevious: entry.intervalSincePrevious,
			})),
	};
}

export async function deleteAllUserData(uid: string): Promise<void> {
	await clearLogs(uid);
	await deleteDoc(userRef(uid));
}

export function deriveHistoryGroupsFromLogs(entries: SmokeLogEntry[]): HistoryDayGroup[] {
	const groups: HistoryDayGroup[] = [];
	const descending = [...entries].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());

	for (const entry of descending) {
		const dayKey = toDayKey(entry.timestamp);
		const existing = groups[groups.length - 1];
		if (!existing || existing.dayKey !== dayKey) {
			groups.push({ dayKey, date: parseDayKey(dayKey), count: 0, entries: [] });
		}
		const group = groups[groups.length - 1]!;
		group.entries.push(entry);
		group.count += 1;
	}

	return groups;
}

