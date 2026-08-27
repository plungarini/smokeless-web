import { Button } from '../../../../components/ui/Button';
import { circleIconButtonClass } from '../styles';

export function ConfirmDialog({
	open,
	title,
	body,
	confirmLabel = 'Delete',
	cancelLabel = 'Cancel',
	busy = false,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	title: string;
	body: string;
	confirmLabel?: string;
	cancelLabel?: string;
	busy?: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<div
			className={[
				'fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 pt-10',
				'backdrop-blur-sm',
				'transition-[opacity,background-color] duration-300 ease-out',
				open ? 'bg-black/65 pointer-events-auto opacity-100' : 'pointer-events-none bg-black/0 opacity-0',
			].join(' ')}
			onClick={onCancel}
		>
			<div
				className={[
					'smoke-modal-panel w-full max-w-md rounded-[32px] p-6',
					'transition-[opacity,transform] duration-300 ease-out',
					open ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
				].join(' ')}
				onClick={(event) => event.stopPropagation()}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="confirm-dialog-title"
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 id="confirm-dialog-title" className="font-[DM_Serif_Display] text-[2.1rem] leading-none text-text">
							{title}
						</h2>
						<p className="mt-2 text-[15px] text-text-dim">{body}</p>
					</div>
					<button type="button" className={circleIconButtonClass} onClick={onCancel} aria-label="Close">
						×
					</button>
				</div>

				<div className="mt-6 flex gap-3">
					<Button variant="secondary" className="flex-1 rounded-[20px]" onClick={onCancel} disabled={busy}>
						{cancelLabel}
					</Button>
					<Button variant="danger" className="flex-1 rounded-[20px]" onClick={onConfirm} disabled={busy}>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
