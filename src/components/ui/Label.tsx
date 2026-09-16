import * as React from 'react';

import { cn } from '@/lib/utils';

// A plain <label>: Base UI has no standalone Label primitive (its labels live
// inside Field), and the only thing the Radix one added was a mousedown guard
// against double-click text selection.
function Label({ className, ...props }: React.ComponentProps<'label'>) {
	return (
		// This is the generic primitive; callers pass htmlFor (or nest a control),
		// which the rule cannot see through a wrapper component.
		// eslint-disable-next-line jsx-a11y/label-has-associated-control
		<label
			data-slot="label"
			className={cn(
				'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

export { Label };
