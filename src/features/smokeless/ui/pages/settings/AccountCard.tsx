import { Card } from '../../../../../components/ui/Card';
import type { AuthAccountInfo, UserDocument } from '../../../../../domain/types';
import { circleIconButtonClass, glassCardClass } from '../../styles';

export function AccountCard({ account, userDocument }: { account: AuthAccountInfo; userDocument: UserDocument }) {
	const name = account.displayName || userDocument.displayName || account.email.split('@')[0] || 'You';
	const initial = name.trim().charAt(0).toUpperCase() || '•';

	return (
		<Card className={`${glassCardClass} rounded-[32px]`}>
			<div className="flex items-center gap-4">
				<div className={`${circleIconButtonClass} h-16 w-16 text-[1.6rem]`}>{initial}</div>
				<div className="min-w-0">
					<div className="truncate text-[1.9rem] font-medium leading-none tracking-[-0.03em] text-text">{name}</div>
					<div className="mt-2 truncate text-[15px] text-text-dim">{account.email || 'No email on file'}</div>
				</div>
			</div>
		</Card>
	);
}
