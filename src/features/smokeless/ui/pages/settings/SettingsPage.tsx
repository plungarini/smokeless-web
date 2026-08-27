import type { AuthAccountInfo, UserDocument } from '../../../../../domain/types';
import { AccountCard } from './AccountCard';
import { ActionsCard } from './ActionsCard';
import { HapticsCard } from './HapticsCard';

interface Props {
	account: AuthAccountInfo;
	userDocument: UserDocument;
	onExport: () => void;
	onSignOut: () => void;
	onDeleteAll: () => void;
}

export function SettingsPage({ account, userDocument, onExport, onSignOut, onDeleteAll }: Props) {
	return (
		<div className="flex flex-col gap-4 pb-4">
			<AccountCard account={account} userDocument={userDocument} />
			<HapticsCard />
			<ActionsCard onExport={onExport} onSignOut={onSignOut} onDeleteAll={onDeleteAll} />
		</div>
	);
}
