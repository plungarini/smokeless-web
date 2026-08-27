import { useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../lib/haptics';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface ToastApi {
	toast: string;
	push: (message: string, type?: ToastType) => void;
	dismiss: () => void;
}

const TOAST_DURATION_MS = 3600;

// Mirrors the alert-severity → haptic-preset mapping from janus-gambit-ng's
// AlertService, so every toast gets a matching tap-of-feedback for free.
const HAPTIC_BY_TOAST_TYPE: Record<ToastType, Parameters<typeof triggerHaptic>[0]> = {
	success: 'success',
	danger: 'error',
	warning: 'buzz',
	info: 'nudge',
};

export function useToast(): ToastApi {
	const [toast, setToast] = useState('');
	const timerRef = useRef<number | null>(null);

	const push = useCallback((message: string, type: ToastType = 'danger') => {
		triggerHaptic(HAPTIC_BY_TOAST_TYPE[type]);
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		setToast(message);
		timerRef.current = window.setTimeout(() => {
			setToast((current) => (current === message ? '' : current));
			timerRef.current = null;
		}, TOAST_DURATION_MS);
	}, []);

	const dismiss = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		setToast('');
	}, []);

	useEffect(() => {
		return () => {
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		};
	}, []);

	return { toast, push, dismiss };
}
