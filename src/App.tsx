import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { appStore } from './app/store';
import { signOutAndReset, startBootstrap } from './app/bootstrap';
import { useAppSelector } from './app/hooks/useAppSelector';
import { useClock } from './app/hooks/useClock';
import { useCountBump } from './app/hooks/useCountBump';
import { useSmokeActions } from './app/hooks/useSmokeActions';
import { useToast } from './app/hooks/useToast';
import { formatShortDate, monthStart } from './features/smokeless/lib/history-calendar';
import {
	buildStatsSeries,
	formatStatsIntervalLabel,
	getPeriodComparisonLabel,
	getSelectedPeriodRange,
	getSelectedPeriodTotal,
} from './features/smokeless/lib/stats-series';
import {
	subscribeToDailyCounts,
	subscribeToEntriesForDay,
	subscribeToEntriesInRange,
	subscribeToMonthDayKeys,
	subscribeToMonthlyCounts,
} from './services/firestore';
import { computeWeightedDailyAverage, computeWeightedDailyAverageForPeriod, computeWeightedIntervalForPeriod } from './domain/calculations';
import { AddSmokeModal } from './features/smokeless/ui/components/AddSmokeModal';
import { BottomTabBar } from './features/smokeless/ui/components/BottomTabBar';
import { ConfirmDialog } from './features/smokeless/ui/components/ConfirmDialog';
import { PageHeader } from './features/smokeless/ui/components/PageHeader';
import { AuthPage } from './features/smokeless/ui/pages/AuthPage';
import { HistoryPage } from './features/smokeless/ui/pages/HistoryPage';
import { HomePage } from './features/smokeless/ui/pages/HomePage';
import { SettingsPage } from './features/smokeless/ui/pages/settings/SettingsPage';
import { StatsPage } from './features/smokeless/ui/pages/StatsPage';
import type { StatsPeriod } from './features/smokeless/ui/types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import type { SmokeLogEntry } from './domain/types';
import { formatDurationClock, formatTime, formatTimerClock, parseDayKey, toDateInputValue, toDayKey, toTimeInputValue } from './lib/time';

export default function App() {
	useEffect(() => {
		void startBootstrap();
	}, []);

	// ── Data from the store ───────────────────────────────────────────
	const phase = useAppSelector((s) => s.phase);
	const blockedMessage = useAppSelector((s) => s.statusMessage);
	const account = useAppSelector((s) => s.account);
	const canonicalUid = useAppSelector((s) => s.canonicalUid);
	const userDocument = useAppSelector((s) => s.userDocument);
	const todayCount = useAppSelector((s) => s.todayCount);
	const todayEntries = useAppSelector((s) => s.todayEntries);
	const dailyStats = useAppSelector((s) => s.dailyStats);
	const monthlyStats = useAppSelector((s) => s.monthlyStats);
	const statsPeriodEntries = useAppSelector((s) => s.statsPeriodEntries);
	const historyDayEntries = useAppSelector((s) => s.historyDayEntries);
	const monthDayKeys = useAppSelector((s) => s.monthDayKeys);
	const historyLoading = useAppSelector((s) => s.historyLoading);
	const tab = useAppSelector((s) => s.tab);
	const statsPeriod = useAppSelector((s) => s.statsPeriod);
	const selectedHistoryDay = useAppSelector((s) => s.selectedHistoryDay);
	const historyMonth = useAppSelector((s) => s.historyMonth);
	const mutating = useAppSelector((s) => s.mutating);
	const lastSmokeAtState = useAppSelector((s) => s.lastSmokeAt);

	// ── Hooks that own their own React state ──────────────────────────
	const { toast, push: pushToast, dismiss: dismissToast } = useToast();
	const countBump = useCountBump(todayCount);
	const now = useClock();
	const smokeActions = useSmokeActions(pushToast);

	// ── Transient React-local state ───────────────────────────────────
	const [selectedStatsBucketKey, setSelectedStatsBucketKey] = useState<string | null>(null);
	const [historyModalOpen, setHistoryModalOpen] = useState(false);
	const [modalEntryDate, setModalEntryDate] = useState(() => toDateInputValue(new Date()));
	const [modalEntryTime, setModalEntryTime] = useState(() => toTimeInputValue(new Date()));
	const [pendingDeleteEntry, setPendingDeleteEntry] = useState<SmokeLogEntry | null>(null);
	const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

	// ── Targeted page-specific subscriptions ──────────────────────────
	//
	// Real-time listeners, scoped to whichever tab is active, torn down on
	// tab/period/day change. Firestore's local write cache means these
	// reflect a just-made write almost instantly (including from the write
	// itself, before the server round-trip), so no manual re-fetch is
	// needed after add/delete actions.
	// Keyed on the day-key STRING, not a Date instance: `now` (from useClock)
	// gets a new object every second, and depending the effect below on a
	// Date derived from it would tear down and rebuild these listeners every
	// second — never letting a subscription live long enough to see its
	// first snapshot.
	const referenceDayKey = toDayKey(now);
	useEffect(() => {
		if (!canonicalUid || tab !== 'stats') return;
		appStore.setStatsPeriodLoading(true);
		const { start, end } = getSelectedPeriodRange(statsPeriod, parseDayKey(referenceDayKey));
		const unsubEntries = subscribeToEntriesInRange(canonicalUid, start, end, (entries) => {
			appStore.setStatsPeriodEntries(entries);
		});
		const unsubDaily = subscribeToDailyCounts(canonicalUid, 365, (daily) => appStore.setDailyStats(daily));
		const unsubMonthly = subscribeToMonthlyCounts(canonicalUid, 18, (monthly) => appStore.setMonthlyStats(monthly));
		return () => {
			unsubEntries();
			unsubDaily();
			unsubMonthly();
		};
	}, [tab, statsPeriod, canonicalUid, referenceDayKey]);

	useEffect(() => {
		if (!canonicalUid || tab !== 'history') return;
		return subscribeToMonthDayKeys(canonicalUid, historyMonth, (keys) => appStore.setMonthDayKeys(keys));
	}, [tab, historyMonth, canonicalUid]);

	useEffect(() => {
		if (!canonicalUid || tab !== 'history' || !selectedHistoryDay) return;
		appStore.setHistoryLoading(true);
		return subscribeToEntriesForDay(canonicalUid, selectedHistoryDay, (entries) => {
			appStore.setHistoryDayEntries(entries);
			appStore.setHistoryLoading(false);
		});
	}, [tab, selectedHistoryDay, canonicalUid]);

	// ── Derived display values ────────────────────────────────────────
	const lastSmokeAt = lastSmokeAtState ?? todayEntries[todayEntries.length - 1]?.timestamp ?? null;
	const weightedAverage = useMemo(
		() => computeWeightedDailyAverage(dailyStats, userDocument?.createdAt ?? null, now),
		[dailyStats, userDocument, now],
	);
	const statsSeries = useMemo(() => buildStatsSeries(statsPeriod, dailyStats, monthlyStats, now), [statsPeriod, dailyStats, monthlyStats, now]);
	const selectedPeriodTotal = getSelectedPeriodTotal(statsPeriod, dailyStats, monthlyStats, now);
	const comparisonLabel = getPeriodComparisonLabel(statsPeriod, selectedPeriodTotal, weightedAverage, now);
	const selectedStatsBucket = useMemo(
		() => (selectedStatsBucketKey ? (statsSeries.find((item) => item.key === selectedStatsBucketKey) ?? null) : null),
		[selectedStatsBucketKey, statsSeries],
	);
	const displayedStatsTotal = selectedStatsBucket?.count ?? selectedPeriodTotal;
	const statsAverageCigs = useMemo(() => {
		const { start } = getSelectedPeriodRange(statsPeriod, now);
		return computeWeightedDailyAverageForPeriod(dailyStats, start, now);
	}, [dailyStats, statsPeriod, now]);
	const statsAverageIntervalLabel = useMemo(() => {
		const entries = statsPeriodEntries.length > 0 ? statsPeriodEntries : todayEntries;
		return formatStatsIntervalLabel(computeWeightedIntervalForPeriod(entries, now));
	}, [statsPeriodEntries, todayEntries, now]);
	const statsTotalLabel = selectedStatsBucket
		? selectedStatsBucket.label
		: statsPeriod === 'week'
			? 'This week'
			: statsPeriod === 'month'
				? 'This month'
				: 'This year';
	const selectedHistoryEntries = historyDayEntries;
	const historyDaysWithEntries = useMemo(() => new Set(monthDayKeys), [monthDayKeys]);
	const timerLabel = formatTimerClock(lastSmokeAt, now);

	const timeSinceLastSmokeSeconds = lastSmokeAt ? Math.max(0, Math.floor((now.getTime() - lastSmokeAt.getTime()) / 1000)) : 0;
	const lastSmokeWasToday = lastSmokeAt ? toDayKey(lastSmokeAt) === toDayKey(now) : false;
	const longestEverCessationSeconds = Math.max(userDocument?.longestEverCessation ?? 0, timeSinceLastSmokeSeconds);
	const todayLongestCessationSeconds = (() => {
		const metric = userDocument?.todayMaxCessation;
		const storedToday = metric?.lastUpdated && toDayKey(metric.lastUpdated) === toDayKey(now) ? metric.value : 0;
		if (!lastSmokeWasToday) return timeSinceLastSmokeSeconds;
		return Math.max(storedToday, timeSinceLastSmokeSeconds);
	})();
	const todayLongestCessationLabel = formatDurationClock(todayLongestCessationSeconds * 1000);
	const longestEverCessationLabel = formatDurationClock(longestEverCessationSeconds * 1000);

	// ── Modal plumbing ────────────────────────────────────────────────
	const openHistoryModal = useCallback(() => {
		const baseDate = parseDayKey(selectedHistoryDay);
		setModalEntryDate(toDateInputValue(baseDate));
		setModalEntryTime(toTimeInputValue(new Date()));
		setHistoryModalOpen(true);
	}, [selectedHistoryDay]);

	const submitPastEntry = useCallback(async () => {
		const ok = await smokeActions.addPastEntry(modalEntryDate, modalEntryTime);
		if (ok) setHistoryModalOpen(false);
	}, [modalEntryDate, modalEntryTime, smokeActions]);

	const confirmDeleteEntry = useCallback(async () => {
		if (!pendingDeleteEntry) return;
		await smokeActions.deleteEntry(pendingDeleteEntry);
		setPendingDeleteEntry(null);
	}, [pendingDeleteEntry, smokeActions]);

	const confirmDeleteAll = useCallback(async () => {
		await smokeActions.deleteAll();
		setDeleteAllConfirmOpen(false);
	}, [smokeActions]);

	return (
		<>
			{phase === 'booting' ? (
				// Bare branded splash — no spinner/status text, matching the
				// Flutter app's native splash screen — so a fast (cached) auth
				// check feels like going straight into the app, not a load screen.
				<div className="flex h-dvh items-center justify-center bg-bg">
					<h1 className="font-[DM_Serif_Display] text-4xl tracking-[-0.04em] text-text">Smokeless</h1>
				</div>
			) : phase === 'auth' ? (
				<AuthPage />
			) : phase === 'blocked' ? (
				<div className="mx-auto flex h-dvh max-w-md items-center px-4 py-10">
					<Card className="w-full rounded-[20px] border border-border-light bg-surface">
						<div className="flex flex-col gap-4">
							<h1 className="font-[DM_Serif_Display] text-4xl tracking-[-0.04em] text-text">Smokeless</h1>
							<p className="text-normal-body leading-relaxed text-text-dim">
								{blockedMessage || 'Smokeless could not finish startup. Please try again.'}
							</p>
							<Button variant="highlight" className="w-full rounded-[20px]" onClick={() => window.location.reload()}>
								Retry
							</Button>
						</div>
					</Card>
				</div>
			) : !account || !canonicalUid || !userDocument ? null : (
				<ErrorBoundary>
					<>
						<div className="smoke-app-shell h-full">
							<div className="smoke-app-ornament smoke-app-ornament-top" />
							<div className="smoke-app-ornament smoke-app-ornament-bottom" />

							<div className="relative mx-auto flex h-full max-w-md flex-col overflow-x-visible overflow-y-hidden">
								{tab === 'home' ? <PageHeader title="Today's record" subtitle={formatShortDate(now)} /> : null}
								{tab === 'stats' ? <PageHeader title="Stats" subtitle="Weighted view of your smoking trend" /> : null}
								{tab === 'history' ? <PageHeader title="History" subtitle="Select a date to view logs" /> : null}
								{tab === 'settings' ? <PageHeader title="Settings" subtitle="Account and app actions" /> : null}

								<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible overscroll-contain px-4 smoke-app-content">
									{tab === 'home' ? (
										<HomePage
											todayCount={todayCount}
											todayLongestCessationLabel={todayLongestCessationLabel}
											longestEverCessationLabel={longestEverCessationLabel}
											timerLabel={timerLabel}
											countBump={countBump}
											mutating={mutating}
											onAddSmoke={() => void smokeActions.addSmoke()}
										/>
									) : null}

									{tab === 'stats' ? (
										<StatsPage
											statsPeriod={statsPeriod}
											onStatsPeriodChange={(period: StatsPeriod) => appStore.setStatsPeriod(period)}
											statsSeries={statsSeries}
											selectedStatsBucketKey={selectedStatsBucketKey}
											onStatsBucketSelect={(key) => setSelectedStatsBucketKey((current) => (current === key ? null : key))}
											totalSmoked={displayedStatsTotal}
											totalLabel={statsTotalLabel}
											comparisonLabel={comparisonLabel}
											weightedAverage={statsAverageCigs}
											averageIntervalLabel={statsAverageIntervalLabel}
										/>
									) : null}

									{tab === 'history' ? (
										<HistoryPage
											historyMonth={historyMonth}
											selectedHistoryDay={selectedHistoryDay}
											historyDaysWithEntries={historyDaysWithEntries}
											selectedHistoryEntries={selectedHistoryEntries}
											historyLoading={historyLoading}
											onHistoryMonthChange={(date) => appStore.setHistoryMonth(date)}
											onHistoryDaySelect={(dayKey, date) => {
												appStore.setHistoryDay(dayKey);
												appStore.setHistoryMonth(monthStart(date));
											}}
											onOpenHistoryModal={openHistoryModal}
											onDeleteEntry={(entry) => setPendingDeleteEntry(entry)}
										/>
									) : null}

									{tab === 'settings' ? (
										<SettingsPage
											account={account}
											userDocument={userDocument}
											onExport={() => void smokeActions.exportLogs()}
											onSignOut={() => void signOutAndReset()}
											onDeleteAll={() => setDeleteAllConfirmOpen(true)}
										/>
									) : null}
								</div>

								<BottomTabBar
									activeTab={tab}
									onChange={(next) => {
										startTransition(() => {
											appStore.setTab(next);
										});
									}}
								/>
							</div>
						</div>

						<AddSmokeModal
							open={historyModalOpen}
							date={modalEntryDate}
							time={modalEntryTime}
							mutating={mutating}
							onClose={() => setHistoryModalOpen(false)}
							onDateChange={setModalEntryDate}
							onTimeChange={setModalEntryTime}
							onSave={() => void submitPastEntry()}
						/>

						<ConfirmDialog
							open={pendingDeleteEntry !== null}
							title="Delete this smoke?"
							body={pendingDeleteEntry ? `The ${formatTime(pendingDeleteEntry.timestamp)} entry will be removed for good.` : ''}
							confirmLabel="Delete"
							busy={mutating}
							onCancel={() => setPendingDeleteEntry(null)}
							onConfirm={() => void confirmDeleteEntry()}
						/>

						<ConfirmDialog
							open={deleteAllConfirmOpen}
							title="Delete all data?"
							body="Every logged smoke and your cessation records will be permanently deleted. This can't be undone."
							confirmLabel="Delete everything"
							busy={mutating}
							onCancel={() => setDeleteAllConfirmOpen(false)}
							onConfirm={() => void confirmDeleteAll()}
						/>

						{toast ? (
							<div className="pointer-events-none fixed bottom-28 left-4 right-4 z-[9999] flex justify-center">
								<button
									type="button"
									className="smokeless-toast pointer-events-auto w-full max-w-md text-left"
									onClick={dismissToast}
									aria-label="Dismiss notification"
								>
									<div className="smokeless-toast__message">{toast}</div>
								</button>
							</div>
						) : null}
					</>
				</ErrorBoundary>
			)}
		</>
	);
}
