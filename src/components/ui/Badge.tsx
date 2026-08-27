import type { ReactNode } from 'react';

type Variant = 'accent' | 'negative';

const VARIANT_CLASS: Record<Variant, string> = {
	accent: 'bg-positive-alpha text-positive',
	negative: 'bg-negative-alpha text-negative',
};

export function Badge({ children, variant = 'accent' }: { children: ReactNode; variant?: Variant }) {
	return (
		<span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold ${VARIANT_CLASS[variant]}`}>
			{children}
		</span>
	);
}
