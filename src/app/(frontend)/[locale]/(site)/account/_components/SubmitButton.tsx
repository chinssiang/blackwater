import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/**
 * The account forms' submit button, reading `pendingLabel` while a request is
 * in flight. aria-disabled rather than disabled, which would drop keyboard
 * focus to <body>; the form's handler must ignore a submit while pending.
 */
export function SubmitButton({
	label,
	pendingLabel,
	pending,
	className,
}: {
	label: string;
	pendingLabel: string;
	pending: boolean;
	className?: string;
}) {
	return (
		<Button
			type="submit"
			variant="outline"
			size="lg"
			aria-disabled={pending || undefined}
			className={cn(
				'min-w-22 bg-black text-white aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
				className
			)}
		>
			{/* Both labels share one grid cell, so the button is always as wide as
			    the longer one and nothing beside it shifts. `invisible` also drops
			    the idle one from the accessible name. */}
			<span className="grid text-center">
				<span className={cn('col-start-1 row-start-1', pending && 'invisible')}>
					{label}
				</span>
				<span
					className={cn('col-start-1 row-start-1', !pending && 'invisible')}
				>
					{pendingLabel}
				</span>
			</span>
		</Button>
	);
}
