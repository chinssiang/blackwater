'use client';

import { useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { cn } from '@/lib/utils';
import type {
	ShopifyProductOption,
	ShopifyVariant,
} from '@/lib/shopify/types';

type Props = {
	options: ShopifyProductOption[];
	variants: ShopifyVariant[];
	selection: Record<string, string>;
	onSelect: (name: string, value: string) => void;
};

// With every other option held at the current selection, is any variant
// carrying this value still purchasable? Drives the struck-through styling —
// unavailable values stay clickable so shoppers can reach the sold-out state
// (and its back-in-stock form) for the exact variant they want.
function valueIsAvailable(
	variants: ShopifyVariant[],
	selection: Record<string, string>,
	name: string,
	value: string
): boolean {
	return variants.some(
		(variant) =>
			variant.availableForSale &&
			variant.selectedOptions.every((o) =>
				o.name === name ? o.value === value : selection[o.name] === o.value
			)
	);
}

export default function VariantPicker({
	options,
	variants,
	selection,
	onSelect,
}: Props) {
	const productText = useTranslations('products');

	// Shopify models option-less products as a lone "Title: Default Title"
	// option; callers hide the whole picker for those, this guard just keeps a
	// stray placeholder group from rendering on mixed data.
	const realOptions = options.filter(
		(o) => !(o.values.length <= 1 && o.values[0] === 'Default Title')
	);
	if (realOptions.length === 0) return null;

	return (
		<div className="flex flex-col gap-5">
			{realOptions.map((option) => (
				<div key={option.name} role="group" aria-label={option.name}>
					<p className="t-l-2 uppercase text-foreground/65">{option.name}</p>
					<div className="mt-2.5 flex flex-wrap gap-2">
						{option.values.map((value) => {
							const selected = selection[option.name] === value;
							const available = valueIsAvailable(
								variants,
								selection,
								option.name,
								value
							);
							return (
								<button
									key={value}
									type="button"
									aria-pressed={selected}
									aria-label={
										available
											? value
											: interpolate(productText.optionUnavailable, { value })
									}
									onClick={() => onSelect(option.name, value)}
									className={cn(
										'inline-flex min-h-11 min-w-11 items-center justify-center border px-3.5 t-l-2 uppercase transition-colors duration-200',
										'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background',
										selected
											? 'border-foreground bg-foreground text-background'
											: 'border-foreground/25 text-foreground/80 hover:border-foreground/60',
										// These stay interactive (not disabled), so they must meet
										// AA text contrast — /35 lands near 3:1 on the dark theme.
										!available &&
											!selected &&
											'border-foreground/30 text-foreground/60 line-through decoration-1'
									)}
								>
									{value}
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}
