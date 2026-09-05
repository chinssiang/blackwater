import * as React from 'react';

import { cn } from '@/lib/utils';

// A plain <span>, not Base UI's `useRender`: nothing composes a Badge with
// another element, and the hook costs a ref merge and a props merge on every
// one -- /products/all renders 24 cards, each with a badge per tag. `ui/Label`
// is a plain element for the same reason.
function Badge({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot="badge"
			className={cn(
				't-l-2 inline-flex w-fit items-center py-2 px-3 uppercase bg-primary/25 text-primary rounded',
				className
			)}
			{...props}
		/>
	);
}

export { Badge };
