import * as React from 'react';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

function Badge({
	className,
	asChild = false,
	...props
}: React.ComponentProps<'span'> & {
	asChild?: boolean;
}) {
	const Comp = asChild ? Slot.Root : 'span';

	return (
		<Comp
			data-slot="badge"
			className={cn(
				't-l-2 inline-flex w-fit items-center px-3 py-1.5 uppercase bg-primary/20 text-primary',
				className
			)}
			{...props}
		/>
	);
}

export { Badge };
