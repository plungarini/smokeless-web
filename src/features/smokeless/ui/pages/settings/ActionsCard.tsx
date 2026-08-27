import { Button } from '../../../../../components/ui/Button';
import { Card } from '../../../../../components/ui/Card';
import { glassCardClass, sectionLabelClass } from '../../styles';

interface Props {
	onExport: () => void;
	onSignOut: () => void;
	onDeleteAll: () => void;
}

export function ActionsCard({ onExport, onSignOut, onDeleteAll }: Props) {
	return (
		<Card className={`${glassCardClass} rounded-[32px]`}>
			<div className="flex flex-col gap-4">
				<div className={sectionLabelClass}>Actions</div>
				<Button variant="secondary" className="rounded-[20px]" onClick={onExport}>
					Export JSON
				</Button>
				<div className="flex flex-col gap-1">
					<Button variant="secondary" className="rounded-[20px]" onClick={onSignOut}>
						Sign out
					</Button>
					<p className="px-1 text-[12px] leading-relaxed text-text-dim">
						Your data stays synced to your account — sign back in any time to pick up where you left off.
					</p>
				</div>
				<Button variant="danger" className="rounded-[20px]" onClick={onDeleteAll}>
					Delete all data
				</Button>
			</div>
		</Card>
	);
}
