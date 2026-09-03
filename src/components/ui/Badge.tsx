import * as React from 'react';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

import { cn } from '@/lib/utils';

function Badge({
	className,
	render,
	...props
}: useRender.ComponentProps<'span'>) {
	return useRender({
		defaultTagName: 'span',
		render,
		props: mergeProps<'span'>(
			{
				className: cn(
					't-l-2 inline-flex w-fit items-center py-2 px-3 uppercase bg-primary/25 text-primary rounded',
					className
				),
			},
			props
		),
		state: { slot: 'badge' },
	});
}

export { Badge };
