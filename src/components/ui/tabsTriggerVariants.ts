import { cva } from 'class-variance-authority';

export const tabsTriggerVariants = cva(
	'cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				// Unstyled, as this primitive shipped: the default stays a bare
				// passthrough so existing call sites are unaffected.
				default: '',
				pill: 'border-foreground data-active:bg-foreground data-active:text-background not-data-active:hover:bg-foreground/5 rounded-full border uppercase whitespace-nowrap not-data-active:bg-transparent',
			},
			size: {
				default: '',
				sm: 't-l-2 px-2.5 py-1.5',
				md: 't-l-1 px-3.5 py-1.5',
			},
		},
		defaultVariants: { variant: 'default', size: 'default' },
	}
);
