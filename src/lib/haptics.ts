import type { HapticPattern } from '@haptics/core';
import type { Haptics as HapticsController } from '@haptics/vanilla';

/**
 * Centralized haptics wrapper.
 *
 * Backed by `@haptics/vanilla`, which is the only approach that still produces
 * feedback on an installed iOS PWA: Safari never shipped `navigator.vibrate`,
 * so on iOS the library overlays an invisible `<input type="checkbox" switch>`
 * on each haptic element and lets the *real* tap toggle it — the one path that
 * survived Apple's iOS 26.5 patch. Android keeps using the Vibration API.
 * Everywhere else it is a silent no-op (bar the dev-only desktop audio cue).
 *
 * Coverage: every interactive element gets feedback automatically. A broad
 * `selector` wires the platform handlers, and a MutationObserver stamps a
 * default `data-haptic="nudge"` on any button/link that doesn't opt into a
 * specific preset. Opt a single element out with `data-haptic-skip`, or give
 * it a stronger/weaker feel with an explicit `data-haptic="<preset>"`.
 *
 * Practical limits (platform, not fixable here):
 *  - iOS 26.5+ fires a single tick only; multi-segment patterns lose their tail.
 *  - iOS haptics need a genuine tap, so `triggerHaptic()` fired from a timer
 *    (e.g. a toast) is Android-only in practice.
 *
 * Nothing outside this file should import `@haptics/*` directly.
 */

const STORAGE_KEY = 'smokeless.haptics.enabled';

/** Elements that should buzz on tap unless they opt out with `data-haptic-skip`. */
const TAGGABLE_SELECTOR = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"]';

/** Passed to @haptics so its handlers attach to everything the tagger touches. */
const HAPTIC_SELECTOR = `${TAGGABLE_SELECTOR}, [data-haptic]`;

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
	// Default "you touched a control" feedback — a firm tick with a soft tail.
	nudge: [
		{ duration: 18, intensity: 0.6 },
		{ delay: 40, duration: 10, intensity: 0.25 },
	],
	// One crisp, instant full-power thump — a hard click, not a buzz.
	// Used for the log-smoke button, the one action that should feel weighty.
	'impact-hard': [{ duration: 22, intensity: 1 }],
	// One long vibration for warnings. Android-only in effect; iOS gets one tick.
	buzz: [{ duration: 600, intensity: 1 }],
};

let instance: HapticsController | null = null;
let tagObserver: MutationObserver | null = null;
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
	// Android and any other browser exposing the Vibration API.
	if (typeof navigator.vibrate === 'function') return true;
	// iOS/iPadOS: no Vibration API, but the <input switch> Taptic trick works on
	// Safari 17.4+. iPadOS 13+ reports as a Mac, so also sniff for touch.
	const ua = navigator.userAgent;
	return /iP(hone|ad|od)/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);
}

/** Stamp a default preset on interactive elements that haven't chosen one. */
function tagElement(el: Element): void {
	if (el.hasAttribute('data-haptic') || el.hasAttribute('data-haptic-skip')) return;
	el.setAttribute('data-haptic', 'nudge');
}

function tagSubtree(root: ParentNode): void {
	if (root instanceof Element) tagElement(root);
	root.querySelectorAll(TAGGABLE_SELECTOR).forEach(tagElement);
}

function startAutoTagging(): void {
	if (typeof document === 'undefined' || tagObserver) return;
	tagSubtree(document.body);
	tagObserver = new MutationObserver((mutations) => {
		for (const m of mutations) {
			for (const node of m.addedNodes) {
				if (node.nodeType === 1) tagSubtree(node as Element);
			}
		}
	});
	tagObserver.observe(document.body, { childList: true, subtree: true });
}

function stopAutoTagging(): void {
	tagObserver?.disconnect();
	tagObserver = null;
}

async function ensureInstance(): Promise<void> {
	if (instance || typeof document === 'undefined') return;
	startAutoTagging();
	const { Haptics } = await import('@haptics/vanilla');
	instance = new Haptics({
		selector: HAPTIC_SELECTOR,
		patterns: CUSTOM_PATTERNS,
		// Desktop-only audible cue on haptic elements, for local dev.
		audioFallback: import.meta.env.DEV,
	});
}

function teardownInstance(): void {
	stopAutoTagging();
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
