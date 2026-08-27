import { useState } from 'react';
import { Card } from '../../../../../components/ui/Card';
import { isHapticsEnabled, isHapticsSupported, setHapticsEnabled, type HapticName } from '../../../../../lib/haptics';
import { glassCardClass, sectionLabelClass, segmentedButtonBaseClass } from '../../styles';

const TEST_PRESETS: readonly HapticName[] = ['success', 'error', 'nudge', 'buzz'];

export function HapticsCard() {
	const [enabled, setEnabled] = useState(() => isHapticsEnabled());
	const supported = isHapticsSupported();

	function toggle() {
		const next = !enabled;
		setHapticsEnabled(next);
		setEnabled(next);
	}

	return (
		<Card className={`${glassCardClass} rounded-[32px]`}>
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-4">
					<div>
						<div className={sectionLabelClass}>Haptics</div>
						<p className="mt-2 text-[13px] leading-relaxed text-text-dim">
							{supported ? 'A light tap on every button, plus a distinct buzz for logging and deleting.' : 'Not supported on this device/browser.'}
						</p>
					</div>
					<button
						type="button"
						role="switch"
						data-haptic="selection"
						aria-checked={enabled}
						aria-label="Toggle haptic feedback"
						onClick={toggle}
						className={`relative h-8 w-14 shrink-0 rounded-full border border-white/[0.1] transition-colors ${enabled ? 'bg-white/[0.28]' : 'bg-white/[0.06]'}`}
					>
						<span
							className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-white shadow transition-[left] ${enabled ? 'left-[calc(100%-1.75rem)]' : 'left-1'}`}
						/>
					</button>
				</div>

				{enabled ? (
					<div className="grid grid-cols-4 gap-1 rounded-full bg-white/[0.04] p-1.5">
						{TEST_PRESETS.map((preset) => (
							// data-haptic drives the real (iOS-accurate) playback; no imperative
							// call here or the pattern would fire twice on Android / iOS < 26.5.
							<button key={preset} type="button" data-haptic={preset} className={segmentedButtonBaseClass}>
								{preset}
							</button>
						))}
					</div>
				) : null}
			</div>
		</Card>
	);
}
