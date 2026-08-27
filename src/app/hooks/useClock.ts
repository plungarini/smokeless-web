import { useSyncExternalStore } from 'react';
import { getNowMs, subscribeClock } from '../clock';

export function useClockMs(): number {
	return useSyncExternalStore(subscribeClock, getNowMs, getNowMs);
}

export function useClock(): Date {
	const ms = useClockMs();
	return new Date(ms);
}
