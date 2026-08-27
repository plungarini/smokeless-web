import type { HapticInput, TriggerOptions, WebHaptics } from 'web-haptics';

/**
 * Centralized haptics wrapper — mirrors the HapticsService pattern from
 * janus-gambit-ng, ported to a plain module singleton (matching this app's
 * existing AppStore/clock style) instead of an Angular service.
 *
 * Nothing outside this file should import `web-haptics` directly.
 */

const STORAGE_KEY = 'smokeless.haptics.enabled';
const INTERACTIVE_SELECTOR = 'button, a, [role="button"], [tabindex], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"]';

let instance: WebHaptics | null = null;
let initPromise: Promise<void> | null = null;

function readEnabled(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'false';
	} catch {
		return true;
	}
}

let enabled = true;

function attachGlobalTapFeedback(): void {
	document.body.addEventListener(
		'click',
		(event) => {
			if (!event.isTrusted || !instance || !enabled) return;
			const target = event.target as Element | null;
			// Skip clicks on the library's own injected debug-switch DOM nodes.
			if (target?.closest('[id^="web-haptics-"]')) return;
			if (target?.closest(INTERACTIVE_SELECTOR)) {
				void instance.trigger('nudge');
			}
		},
		{ capture: true },
	);
}

export async function initHaptics(): Promise<void> {
	if (initPromise) return initPromise;
	initPromise = (async () => {
		enabled = readEnabled();
		const { WebHaptics } = await import('web-haptics');
		instance = new WebHaptics({ debug: import.meta.env.DEV });
		attachGlobalTapFeedback();
	})();
	return initPromise;
}

export function triggerHaptic(input: HapticInput = 'nudge', options?: TriggerOptions): void {
	if (!enabled || !instance) return;
	void instance.trigger(input, options);
}

export function isHapticsSupported(): boolean {
	return instance ? (instance.constructor as typeof WebHaptics).isSupported : false;
}

export function isHapticsEnabled(): boolean {
	return enabled;
}

export function setHapticsEnabled(next: boolean): void {
	enabled = next;
	try {
		localStorage.setItem(STORAGE_KEY, String(next));
	} catch {
		// Storage unavailable (private browsing, etc.) — enabled still applies for this session.
	}
}
