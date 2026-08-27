import { useState } from 'react';
import { Card } from '../../../../../components/ui/Card';
import type { AuthAccountInfo, UserDocument } from '../../../../../domain/types';
import { circleIconButtonClass, glassCardClass, sectionLabelClass } from '../../styles';

export function AccountCard({ account, userDocument }: { account: AuthAccountInfo; userDocument: UserDocument }) {
	const [copied, setCopied] = useState(false);
	const name = account.displayName || userDocument.displayName || account.email.split('@')[0] || 'You';
	const initial = name.trim().charAt(0).toUpperCase() || '•';

	async function copyUid() {
		try {
			await navigator.clipboard.writeText(account.uid);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard API unavailable — the UID is still visible to copy manually.
		}
	}

	return (
		<Card className={`${glassCardClass} rounded-[32px]`}>
			<div className="flex items-center gap-4">
				<div className={`${circleIconButtonClass} h-16 w-16 text-[1.6rem]`}>{initial}</div>
				<div className="min-w-0">
					<div className="truncate text-[1.9rem] font-medium leading-none tracking-[-0.03em] text-text">{name}</div>
					<div className="mt-2 truncate text-[15px] text-text-dim">{account.email || 'No email on file'}</div>
				</div>
			</div>
			<button
				type="button"
				onClick={copyUid}
				className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left"
			>
				<div className="min-w-0">
					<div className={sectionLabelClass}>User ID</div>
					<div className="mt-1 truncate font-mono text-[13px] text-text-dim">{account.uid}</div>
				</div>
				<span className="shrink-0 text-[13px] text-text-dim">{copied ? 'Copied' : 'Copy'}</span>
			</button>
		</Card>
	);
}
