type Listener = () => void;

let nowMs = Date.now();
const listeners = new Set<Listener>();
let intervalId: number | null = null;

function tick(): void {
	nowMs = Date.now();
	for (const listener of listeners) {
		try {
			listener();
		} catch (error) {
			console.error('[clock] listener error', error);
		}
	}
}

export function subscribeClock(listener: Listener): () => void {
	listeners.add(listener);
	if (intervalId === null) {
		intervalId = window.setInterval(tick, 1000);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && intervalId !== null) {
			window.clearInterval(intervalId);
			intervalId = null;
		}
	};
}

export function getNowMs(): number {
	return nowMs;
}
