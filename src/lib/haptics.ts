import type { HapticPattern } from '@haptics/core';
import type { Haptics as HapticsController } from '@haptics/vanilla';

/**
 * Centralized haptics wrapper around `@haptics/vanilla`. Explicit opt-in only:
 * an element gets feedback if and only if it carries `data-haptic`. On iOS the
 * library overlays a real `<input type="checkbox" switch">` on each tagged
 * element so the user's actual finger taps it — that's the only way to get
 * WebKit's native Taptic tick; a script-triggered `.click()` is untrusted and
 * produces no feedback. Nothing outside this file should import `@haptics/*`
 * directly.
 */

const STORAGE_KEY = 'smokeless.haptics.enabled';

const HAPTIC_SELECTOR = '[data-haptic]';

export type HapticName =
	| 'selection'
	| 'impact-light'
	| 'impact-medium'
	| 'impact-heavy'
	| 'impact-hard'
	| 'success'
	| 'warning'
	| 'error'
	| 'nudge'
	| 'buzz';

/**
 * Legacy preset names this app already uses that aren't in `@haptics`' built-in
 * set (selection, impact-light/medium/heavy, success, warning, error). Registered
 * as custom patterns so existing call sites keep working unchanged.
 */
const CUSTOM_PATTERNS: Record<string, HapticPattern> = {
	nudge: [
		{ duration: 18, intensity: 0.6 },
		{ delay: 40, duration: 10, intensity: 0.25 },
	],
	'impact-hard': [{ duration: 22, intensity: 1 }],
	buzz: [{ duration: 600, intensity: 1 }],
};

let instance: HapticsController | null = null;
let initPromise: Promise<void> | null = null;
let enabled = true;

function readEnabled(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== 'false';
	} catch {
		return true;
	}
}

function detectSupport(): boolean {
	if (typeof navigator === 'undefined') return false;
	if (typeof navigator.vibrate === 'function') return true;
	const ua = navigator.userAgent;
	return /iP(hone|ad|od)/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);
}

async function ensureInstance(): Promise<void> {
	if (instance || typeof document === 'undefined') return;
	const { Haptics } = await import('@haptics/vanilla');
	instance = new Haptics({
		selector: HAPTIC_SELECTOR,
		patterns: CUSTOM_PATTERNS,
	});
}

function teardownInstance(): void {
	instance?.destroy();
	instance = null;
}

export async function initHaptics(): Promise<void> {
	if (initPromise) return initPromise;
	initPromise = (async () => {
		enabled = readEnabled();
		if (enabled) await ensureInstance();
	})();
	return initPromise;
}

export function triggerHaptic(input: HapticName = 'nudge', options?: { repeat?: boolean }): void {
	if (!enabled || !instance) return;
	instance.trigger(input, options);
}

export function isHapticsSupported(): boolean {
	return detectSupport();
}

export function isHapticsEnabled(): boolean {
	return enabled;
}

export function setHapticsEnabled(next: boolean): void {
	enabled = next;
	try {
		localStorage.setItem(STORAGE_KEY, String(next));
	} catch {
		// Storage unavailable (private browsing, etc.) — applies for this session only.
	}
	if (next) void ensureInstance();
	else teardownInstance();
}
