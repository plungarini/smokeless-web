import type { AuthAccountInfo, SmokeLogEntry, UserDocument } from '../domain/types';
import { monthStart } from '../features/smokeless/lib/history-calendar';
import type { AppTab, StatsPeriod } from '../features/smokeless/ui/types';
import { combineDateAndTime, toDayKey } from '../lib/time';
import {
	addSmokeEntry as dbAddSmoke,
	deleteAllUserData as dbDeleteAll,
	deleteLogEntry as dbDeleteEntry,
	exportLogs as dbExportLogs,
} from '../services/firestore';

export type AppPhase = 'booting' | 'auth' | 'ready' | 'blocked';

export interface AppState {
	phase: AppPhase;
	statusMessage: string | null;

	account: AuthAccountInfo | null;
	canonicalUid: string | null;
	userDocument: UserDocument | null;

	todayEntries: SmokeLogEntry[];
	dailyStats: Record<string, number>;
	monthlyStats: Record<string, number>;
	statsPeriodEntries: SmokeLogEntry[];
	statsPeriodLoading: boolean;
	historyDayEntries: SmokeLogEntry[];
	monthDayKeys: string[];
	historyLoading: boolean;
	todayCount: number;

	tab: AppTab;
	statsPeriod: StatsPeriod;
	selectedHistoryDay: string;
	historyMonth: Date;

	mutating: boolean;
	lastSmokeAt: Date | null;
}

const initialState: AppState = {
	phase: 'booting',
	statusMessage: null,

	account: null,
	canonicalUid: null,
	userDocument: null,

	todayEntries: [],
	dailyStats: {},
	monthlyStats: {},
	statsPeriodEntries: [],
	statsPeriodLoading: false,
	historyDayEntries: [],
	monthDayKeys: [],
	historyLoading: false,
	todayCount: 0,

	tab: 'home',
	statsPeriod: 'week',
	selectedHistoryDay: toDayKey(new Date()),
	historyMonth: monthStart(new Date()),

	mutating: false,
	lastSmokeAt: null,
};

type Listener = () => void;

export interface LogSmokeResult {
	ok: boolean;
	loggedAt?: Date;
	errorMessage?: string;
}

export class AppStore {
	private state: AppState = initialState;
	private readonly listeners = new Set<Listener>();

	getState(): AppState {
		return this.state;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private commit(next: AppState): void {
		if (next === this.state) return;
		this.state = next;
		this.notify();
	}

	private notify(): void {
		for (const listener of this.listeners) {
			try {
				listener();
			} catch (error) {
				console.error('[AppStore] listener error', error);
			}
		}
	}

	// ── Phase / status ────────────────────────────────────────────────

	setPhase(phase: AppPhase, statusMessage: string | null = null): void {
		this.commit({ ...this.state, phase, statusMessage });
	}

	// ── Identity ──────────────────────────────────────────────────────

	setAccount(account: AuthAccountInfo | null): void {
		this.commit({ ...this.state, account });
	}

	setCanonicalUid(uid: string | null): void {
		this.commit({ ...this.state, canonicalUid: uid });
	}

	setUserDocument(doc: UserDocument | null): void {
		this.commit({ ...this.state, userDocument: doc });
	}

	// ── Data — page-specific setters ──────────────────────────────────

	setTodayEntries(entries: SmokeLogEntry[]): void {
		this.commit({ ...this.state, todayEntries: entries });
	}

	setDailyStats(stats: Record<string, number>): void {
		this.commit({ ...this.state, dailyStats: stats });
	}

	setMonthlyStats(stats: Record<string, number>): void {
		this.commit({ ...this.state, monthlyStats: stats });
	}

	setStatsPeriodEntries(entries: SmokeLogEntry[]): void {
		this.commit({ ...this.state, statsPeriodEntries: entries, statsPeriodLoading: false });
	}

	setStatsPeriodLoading(loading: boolean): void {
		if (this.state.statsPeriodLoading === loading) return;
		this.commit({ ...this.state, statsPeriodLoading: loading });
	}

	setHistoryDayEntries(entries: SmokeLogEntry[]): void {
		this.commit({ ...this.state, historyDayEntries: entries });
	}

	setMonthDayKeys(keys: string[]): void {
		this.commit({ ...this.state, monthDayKeys: keys });
	}

	setTodayCount(count: number): void {
		this.commit({ ...this.state, todayCount: count });
	}

	setHistoryLoading(loading: boolean): void {
		if (this.state.historyLoading === loading) return;
		this.commit({ ...this.state, historyLoading: loading });
	}

	// ── UX navigation ─────────────────────────────────────────────────

	setTab(tab: AppTab): void {
		if (this.state.tab === tab) return;
		const next: AppState = { ...this.state, tab };
		if (tab === 'history' && this.state.selectedHistoryDay === '') {
			next.selectedHistoryDay = toDayKey(new Date());
		}
		this.commit(next);
	}

	setStatsPeriod(period: StatsPeriod): void {
		if (this.state.statsPeriod === period) return;
		this.commit({ ...this.state, statsPeriod: period });
	}

	setHistoryDay(dayKey: string): void {
		if (this.state.selectedHistoryDay === dayKey) return;
		this.commit({ ...this.state, selectedHistoryDay: dayKey });
	}

	setHistoryMonth(month: Date): void {
		this.commit({ ...this.state, historyMonth: monthStart(month) });
	}

	// ── Mutation flags ───────────────────────────────────────────────

	setMutating(mutating: boolean): void {
		if (this.state.mutating === mutating) return;
		this.commit({ ...this.state, mutating });
	}

	setLastSmokeAt(at: Date | null): void {
		if (this.state.lastSmokeAt === at) return;
		this.commit({ ...this.state, lastSmokeAt: at });
	}

	// ── Async actions ─────────────────────────────────────────────────
	//
	// These only perform the write. Every read the UI needs (today's count,
	// the history day list, month dots, ...) comes from the real-time
	// subscriptions wired up in bootstrap.ts / App.tsx, which reflect writes
	// almost instantly via Firestore's local write cache — no manual
	// re-fetch needed here.

	private smokeInFlight = false;

	async logSmoke(): Promise<LogSmokeResult> {
		const { canonicalUid, mutating } = this.state;
		if (!canonicalUid) {
			return { ok: false, errorMessage: 'Smokeless is still syncing your account.' };
		}
		if (mutating || this.smokeInFlight) {
			return { ok: false, errorMessage: 'A smoke is already being logged.' };
		}

		this.smokeInFlight = true;
		this.setMutating(true);
		const now = new Date();

		try {
			await dbAddSmoke(canonicalUid, now);
			return { ok: true, loggedAt: now };
		} catch (error) {
			console.error('[Smokeless] add smoke failed', error);
			return { ok: false, errorMessage: 'Could not log smoke.' };
		} finally {
			this.smokeInFlight = false;
			this.setMutating(false);
		}
	}

	async addPastEntry(dateInputValue: string, timeInputValue: string): Promise<boolean> {
		const { canonicalUid, mutating } = this.state;
		if (!canonicalUid || mutating) return false;
		this.setMutating(true);
		try {
			const entryDate = combineDateAndTime(dateInputValue, timeInputValue);
			await dbAddSmoke(canonicalUid, entryDate);
			this.setHistoryDay(dateInputValue);
			return true;
		} catch (error) {
			console.error('[Smokeless] add past entry failed', error);
			return false;
		} finally {
			this.setMutating(false);
		}
	}

	async deleteEntry(id: string): Promise<boolean> {
		const { canonicalUid, mutating } = this.state;
		if (!canonicalUid || mutating) return false;
		this.setMutating(true);
		try {
			await dbDeleteEntry(canonicalUid, id);
			return true;
		} catch (error) {
			console.error('[Smokeless] delete entry failed', error);
			return false;
		} finally {
			this.setMutating(false);
		}
	}

	async exportLogs(): Promise<unknown | null> {
		const { canonicalUid } = this.state;
		if (!canonicalUid) return null;
		try {
			return await dbExportLogs(canonicalUid);
		} catch (error) {
			console.error('[Smokeless] export failed', error);
			return null;
		}
	}

	async deleteAllData(): Promise<boolean> {
		const { canonicalUid } = this.state;
		if (!canonicalUid) return false;
		this.setMutating(true);
		try {
			await dbDeleteAll(canonicalUid);
			this.commit({
				...this.state,
				todayEntries: [],
				dailyStats: {},
				monthlyStats: {},
				statsPeriodEntries: [],
				historyDayEntries: [],
				monthDayKeys: [],
				todayCount: 0,
				userDocument: null,
			});
			return true;
		} catch (error) {
			console.error('[Smokeless] delete-all failed', error);
			return false;
		} finally {
			this.setMutating(false);
		}
	}

	resetForSignOut(): void {
		this.commit({
			...initialState,
			// The auth-state listener already flips phase to 'auth' as soon as
			// signOut() completes (often before this runs) — reusing
			// initialState's 'booting' here would clobber that back.
			phase: 'auth',
			selectedHistoryDay: toDayKey(new Date()),
			historyMonth: monthStart(new Date()),
		});
	}
}

export const appStore = new AppStore();
