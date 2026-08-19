'use client';

import { useMemo, useState } from 'react';
import {
	findVariantForSelection,
	formatShopifyPrice,
	hasOnlyDefaultVariant,
	pickInitialVariant,
	type ProductCommerce,
} from '@/lib/shopify/types';
import { useCartActions } from '@/components/cart/CartProvider';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { appendReferralParams, REFERRAL_SOURCE } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import VariantPicker from './VariantPicker';
import BackInStockForm from './BackInStockForm';

// Everything on the product page that depends on live Shopify data: price,
// variant selection, and the buy button. Split out from PageProductSingle so
// the Storefront round trip sits behind its own Suspense boundary and the
// Sanity-sourced image and copy — including the LCP image — paint without
// waiting on it.
//
// These reveals carry no `--reveal-delay`, unlike the Sanity-driven blocks
// around them. The stagger was tuned for everything landing in one paint;
// behind a boundary that resolves separately there is nothing left to stagger
// against, and the delay would hold this column blank for a further ~250ms
// *after* the skeleton is torn down — visibly worse than no placeholder.

type Props = {
	/** Live Shopify data; null for unlinked products or when Shopify is unreachable. */
	commerce: ProductCommerce | null;
	/** Manual Sanity price, used when there's no Shopify link. */
	price?: string | null;
	purchaseLink?: string | null;
	soldOut?: boolean | null;
	title?: string | null;
	slug?: string | null;
};

export default function BuyColumn({
	commerce,
	price,
	purchaseLink,
	soldOut,
	title,
	slug,
}: Props) {
	const locale = useLocale();
	const productText = useTranslations('products');
	const cartText = useTranslations('cart');
	// Actions only: this dispatches into the cart but renders none of its state,
	// so a drawer stepper flipping `isPending` must not re-render it.
	const { addLine, setOpen: setCartOpen } = useCartActions();
	// Local rather than the cart's global `isPending`: that also fires for the
	// drawer's own quantity steppers, which must not put this button in a
	// loading state.
	const [isAdding, setIsAdding] = useState(false);

	const initialVariant = useMemo(
		() => (commerce ? pickInitialVariant(commerce.variants) : null),
		[commerce]
	);
	const initialSelection = useMemo(
		() =>
			Object.fromEntries(
				(initialVariant?.selectedOptions ?? []).map((o) => [o.name, o.value])
			),
		[initialVariant]
	);
	const [selection, setSelection] =
		useState<Record<string, string>>(initialSelection);
	// The picker is seeded from `commerce`, which arrives as a prop — so when a
	// refresh swaps in a different product (or fills in commerce that was null
	// because Shopify was unreachable on first render), the seed has to be
	// re-applied or the picker keeps a selection belonging to the old payload.
	// Keyed on the handle so an ordinary re-render never clobbers the shopper's
	// in-progress choice.
	const [selectionKey, setSelectionKey] = useState(commerce?.handle ?? null);
	if (selectionKey !== (commerce?.handle ?? null)) {
		setSelectionKey(commerce?.handle ?? null);
		setSelection(initialSelection);
	}

	const selectedVariant = commerce
		? findVariantForSelection(commerce.variants, selection)
		: null;
	const showVariantPicker = commerce && !hasOnlyDefaultVariant(commerce);
	// Shopify catalogs are routinely sparse (Sand/M may simply not exist), and
	// the picker deliberately keeps such values clickable. Falling back to
	// another variant here would price, stock-check and — worst — deep-link
	// `?variant=` for an item the shopper never chose, so an unmatched
	// combination resolves to no variant at all and reads as unavailable.
	const unmatchedSelection = Boolean(showVariantPicker) && !selectedVariant;
	const activeVariant = unmatchedSelection
		? null
		: (selectedVariant ?? initialVariant);

	const displayPrice = commerce
		? formatShopifyPrice(activeVariant?.price ?? commerce.minPrice, locale)
		: price;
	const compareAtPrice = activeVariant?.compareAtPrice;
	const displayCompareAt =
		commerce &&
		compareAtPrice &&
		Number(compareAtPrice.amount) > Number(activeVariant?.price.amount)
			? formatShopifyPrice(compareAtPrice, locale)
			: null;

	const liveUnavailable = commerce
		? unmatchedSelection
			? true
			: selectedVariant
				? !selectedVariant.availableForSale
				: !commerce.availableForSale
		: false;
	// Manual soldOut is the editorial override and always wins; live Shopify
	// stock drives the state otherwise. `liveUnavailable` is already false
	// whenever there's no commerce, so an unlinked product is unaffected.
	const isSoldOut = Boolean(soldOut) || liveUnavailable;

	const handleAddToCart = async () => {
		if (!activeVariant) return;
		setIsAdding(true);
		const added = await addLine(activeVariant.gid);
		setIsAdding(false);
		if (added) setCartOpen(true);
	};

	// Carried into the Klaviyo back-in-stock event so restock campaigns can
	// segment by the exact variant requested.
	const backInStockTitle =
		selectedVariant && selectedVariant.title !== 'Default Title'
			? `${title ?? ''} — ${selectedVariant.title}`
			: (title ?? '');

	return (
		<>
			{displayPrice && (
				<p className="reveal t-spec font-semibold mt-5 text-foreground/75">
					{displayPrice}
					{displayCompareAt && (
						<s className="ml-2 font-normal text-foreground/45">
							{displayCompareAt}
						</s>
					)}
				</p>
			)}

			{showVariantPicker && (
				<div className="reveal mt-6">
					<VariantPicker
						options={commerce.options}
						variants={commerce.variants}
						selection={selection}
						onSelect={(name, value) =>
							setSelection((prev) => ({ ...prev, [name]: value }))
						}
					/>
				</div>
			)}

			{/* Buy-button precedence: manual soldOut, then the on-site cart, then
			    purchaseLink. Linking a Shopify product moves the sale here — the
			    shopper only leaves at checkout — so a leftover purchaseLink must not
			    send them back out. It stays a fallback rather than being ignored
			    outright because `commerce` is also null when Shopify is simply
			    unreachable, and in that case the outbound link is the only buy path
			    left. */}
			{isSoldOut ? (
				<div className="reveal mt-6">
					<Button
						aria-disabled="true"
						tabIndex={-1}
						variant="outline"
						className="w-full uppercase lg:w-112 h-14"
					>
						{productText.soldOut}
					</Button>
					<BackInStockForm
						productTitle={backInStockTitle}
						productSlug={slug ?? ''}
					/>
				</div>
			) : (
				(purchaseLink || commerce) && (
					<div className="reveal mt-6">
						{commerce ? (
							<Button
								onClick={handleAddToCart}
								disabled={isAdding || !activeVariant}
								className="w-full uppercase lg:w-112 h-14"
							>
								{isAdding ? cartText.adding : cartText.addToCart}
							</Button>
						) : purchaseLink ? (
							<Button asChild>
								<a
									href={appendReferralParams(purchaseLink, {
										source: REFERRAL_SOURCE,
										medium: 'referral',
										campaign: 'curated-products',
										content: slug ?? undefined,
									})}
									target="_blank"
									rel="noopener"
									aria-label={interpolate(productText.buyAriaLabel, {
										product: title ?? productText.thisProduct,
									})}
									className="group sm:max-w-112 uppercase w-full h-14"
								>
									{productText.buyIt}
									<span
										aria-hidden
										className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
									>
										↗
									</span>
								</a>
							</Button>
						) : null}
					</div>
				)
			)}
		</>
	);
}

/**
 * Placeholder while the Storefront request is in flight.
 *
 * Deliberately mirrors the settled column's box model rather than guessing at
 * pixel heights — same `mt-*` rhythm, same `t-spec`/`t-l-2` line boxes, same
 * `min-h-11` wrap row as VariantPicker, same `h-9` button. Reproducing the
 * structure means it reflows at the same breakpoints the real column does, so
 * the swap doesn't shift the copy below it.
 *
 * The one thing it can't know is how many options and values Shopify will
 * return — that *is* the data being awaited. Five values in one group is the
 * apparel common case; a product with more can still shift by a row.
 */
export function BuyColumnSkeleton() {
	return (
		<div aria-hidden className="animate-pulse">
			<p className="t-spec mt-5">
				<span className="inline-block w-24 rounded bg-foreground/10">
					&nbsp;
				</span>
			</p>
			<div className="mt-6">
				<p className="t-l-2 uppercase">
					<span className="inline-block w-8 rounded bg-foreground/10">
						&nbsp;
					</span>
				</p>
				<div className="mt-2.5 flex flex-wrap gap-2">
					{Array.from({ length: 5 }, (_, i) => (
						<span
							key={i}
							className="min-h-11 min-w-11 rounded-md bg-foreground/10"
						/>
					))}
				</div>
			</div>
			<div className="mt-6">
				<span className="block h-9 w-full rounded-md bg-foreground/10 lg:w-60" />
			</div>
		</div>
	);
}
