export function Loading({ size = 18 }: { size?: number }) {
	return (
		<svg
			className="animate-spin text-text-dim"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M21 12a9 9 0 1 1-6.219-8.56" />
		</svg>
	);
}
