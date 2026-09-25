'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

// Like RadioGroupItem: Base UI renders a <span role="switch"> beside a hidden
// <input>, so `inline-flex` and `data-disabled:` rather than `disabled:`, and a
// `<label htmlFor>` still works because the `id` lands on the input.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				'peer border-input bg-input/30 data-checked:bg-primary data-checked:border-primary focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-5 w-8 shrink-0 cursor-pointer items-center rounded-full border shadow-xs transition-[background-color,border-color,box-shadow] outline-none focus-visible:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50',
				className
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="bg-foreground data-checked:bg-primary-foreground pointer-events-none block size-3.5 translate-x-0.5 rounded-full transition-transform duration-200 ease-out data-checked:translate-x-3.5 motion-reduce:transition-none"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
