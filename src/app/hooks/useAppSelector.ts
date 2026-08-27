import { useSyncExternalStore } from 'react';
import { appStore, type AppState } from '../store';

export function useAppSelector<T>(selector: (state: AppState) => T): T {
	return useSyncExternalStore(
		(listener) => appStore.subscribe(listener),
		() => selector(appStore.getState()),
	);
}
