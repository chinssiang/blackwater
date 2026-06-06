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
				't-l-2 inline-flex w-fit items-center py-2 px-3 uppercase bg-primary/25 text-primary rounded',
				className
			)}
			{...props}
		/>
	);
}

export { Badge };
