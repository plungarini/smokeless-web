import { useMemo } from 'react';
import { appStore } from '../store';
import type { SmokeLogEntry } from '../../domain/types';
import type { ToastType } from './useToast';

export function useSmokeActions(pushToast: (message: string, type?: ToastType) => void) {
	return useMemo(
		() => ({
			async addSmoke() {
				const result = await appStore.logSmoke();
				if (!result.ok) pushToast(result.errorMessage ?? 'Could not log smoke.', 'danger');
				return result.ok;
			},
			async addPastEntry(dateInputValue: string, timeInputValue: string) {
				const ok = await appStore.addPastEntry(dateInputValue, timeInputValue);
				if (!ok) pushToast('Could not save that entry.', 'danger');
				return ok;
			},
			async deleteEntry(entry: SmokeLogEntry) {
				const ok = await appStore.deleteEntry(entry.id);
				if (!ok) pushToast('Could not delete that entry.', 'danger');
				return ok;
			},
			async exportLogs() {
				const data = await appStore.exportLogs();
				if (!data) {
					pushToast('Could not export logs.', 'danger');
					return;
				}
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = `smokeless-export-${new Date().toISOString().slice(0, 10)}.json`;
				link.click();
				URL.revokeObjectURL(url);
				pushToast('Export downloaded.', 'success');
			},
			async deleteAll() {
				const ok = await appStore.deleteAllData();
				pushToast(ok ? 'All data deleted.' : 'Could not delete your data.', ok ? 'success' : 'danger');
				return ok;
			},
		}),
		[pushToast],
	);
}
