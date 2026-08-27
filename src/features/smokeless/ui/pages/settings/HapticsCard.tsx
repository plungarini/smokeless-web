import { useState } from 'react';
import { Card } from '../../../../../components/ui/Card';
import { isHapticsEnabled, isHapticsSupported, setHapticsEnabled } from '../../../../../lib/haptics';
import { glassCardClass, sectionLabelClass } from '../../styles';

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
			<div className="flex items-center justify-between gap-4">
				<div>
					<div className={sectionLabelClass}>Haptics</div>
					<p className="mt-2 text-[13px] leading-relaxed text-text-dim">
						{supported ? 'A firm buzz when you log a smoke.' : 'Not supported on this device/browser.'}
					</p>
				</div>
				<button
					type="button"
					role="switch"
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
		</Card>
	);
}
