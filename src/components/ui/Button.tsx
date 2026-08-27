import type { ButtonHTMLAttributes } from 'react';

type Variant = 'highlight' | 'secondary' | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
	highlight: 'bg-white text-black hover:bg-white/90',
	secondary: 'bg-white/[0.08] text-text border border-white/[0.1] hover:bg-white/[0.12]',
	danger: 'bg-negative/[0.14] text-negative border border-negative/[0.3] hover:bg-negative/[0.2]',
};

export function Button({
	variant = 'secondary',
	className = '',
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
	return (
		<button
			type="button"
			{...props}
			className={`inline-flex items-center justify-center px-5 py-3 text-[15px] font-semibold tracking-[-0.01em] transition disabled:opacity-40 disabled:pointer-events-none ${VARIANT_CLASS[variant]} ${className}`}
		/>
	);
}
