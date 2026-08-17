'use client';

import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
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
					{/* t-l-1 (12px), not t-l-2 (10px): this heads a primary purchase
					    control, and at 10px it was the smallest label in the column —
					    below "Why we chose it" and the other section labels beside it,
					    which all use t-l-1. */}
					<p className="t-l-1 uppercase text-foreground/65">{option.name}</p>
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
								<Button
									key={value}
									type="button"
									variant={selected ? 'default' : 'outline'}
									size="lg"
									aria-pressed={selected}
									aria-label={
										available
											? value
											: interpolate(productText.optionUnavailable, { value })
									}
									onClick={() => onSelect(option.name, value)}
									className={cn(
										// `t-l-2` supplies the family, weight and tracking, but NOT
										// the size: it lives in @layer components while Button's
										// base `text-sm` is a utility, and utilities win the
										// cascade regardless of order — tailwind-merge can't see
										// the conflict either. The explicit size class is what
										// actually sets the size, so don't "tidy it away" as a
										// duplicate of t-l-2.
										//
										// text-xs (12px), not the previous 10px: these are 44×44
										// boxes, and 10px left the value adrift in the middle of
										// one while being the smallest text on a page whose whole
										// job is choosing between these values.
										't-l-2 text-xs uppercase',
										// 44×44 minimum touch target. min-height beats the size
										// variant's h-10, and px-3.5 replaces its px-2.5.
										'min-h-11 min-w-11 px-3.5',
										// Unavailable values stay interactive (never disabled), so
										// they must still meet AA text contrast — /60 clears it.
										// The hover: pairing is required, not redundant: the
										// `outline` variant ships `hover:text-foreground`, and a
										// :hover rule outranks a plain class, so without it a
										// sold-out size brightens to look available the moment
										// the pointer touches it.
										!available &&
											!selected &&
											'text-foreground/60 hover:text-foreground/60 line-through decoration-1'
									)}
								>
									{value}
								</Button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}
