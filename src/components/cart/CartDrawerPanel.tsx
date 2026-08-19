'use client';

import { useEffect, useRef, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { Dialog } from 'radix-ui';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CloseIcon } from '@/components/SvgIcons';
import { Button } from '@/components/ui/Button';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { interpolate, pickPlural } from '@/lib/dictionary';
import { cartOverlay, cartPanel } from '@/lib/animate';
import { resolveHref } from '@/lib/routes';
import {
	formatShopifyPrice,
	shopifyCheckoutUrl,
	MAX_LINE_QUANTITY,
	type ShopifyCartResponseLine,
} from '@/lib/shopify/types';
import { useScrollLock } from '@/hooks/useScrollLock';
import ProductCard from '@/app/(frontend)/[locale]/(site)/products/_components/ProductCard';
import CartCountBadge from './CartCountBadge';
import { useCart } from './CartProvider';

// Right-side cart panel. Built on raw Radix Dialog + Motion to match
// MobileMenu (the app's established overlay idiom) rather than ui/Sheet, whose
// CSS-driven animations and hard-coded z-index don't line up with the rest of
// the site.
//
// Split out from CartDrawer so this module — Radix Dialog, Motion, and the whole
// ProductCard → ImageBlock → SanityImage tree behind the empty state — is a
// chunk fetched on first cart open, not part of the shared bundle every route
// pays for. CartDrawer owns the loading; see the note there.

function LineItem({ line }: { line: ShopifyCartResponseLine }) {
	const locale = useLocale();
	const t = useTranslations('cart');
	const { updateLine, removeLine, isPending, stockLimits } = useCart();
	// Shopify silently caps a line at the stock on hand, which read as the number
	// bouncing back a moment after each click. Once we've learned the ceiling,
	// stop at it and say why.
	const stockLimit = stockLimits[line.id];
	const ceiling = Math.min(stockLimit ?? MAX_LINE_QUANTITY, MAX_LINE_QUANTITY);
	const { merchandise } = line;
	// Option-less products are a single variant Shopify names "Default Title";
	// showing that to a shopper would be meaningless.
	const variantLabel =
		merchandise.title === 'Default Title' ? null : merchandise.title;

	// The quantity the shopper has asked for, which runs ahead of the server
	// snapshot. `cartLinesUpdate` takes an absolute quantity, and disabling the
	// buttons on a state flag only takes effect on the *next* render — so a
	// double-click would otherwise send the same value twice off the same stale
	// `line.quantity` and apply one step instead of two. The ref advances
	// synchronously inside the handler so clicks compound within a single frame;
	// the state mirror is what renders.
	const requested = useRef<number | null>(null);
	const inFlight = useRef(false);
	const [optimistic, setOptimistic] = useState<number | null>(null);
	const quantity = optimistic ?? line.quantity;

	// `cartLinesUpdate` sets an absolute quantity, so overlapping requests race:
	// firing 2, 3 and 4 concurrently leaves whichever Shopify happens to apply
	// last, which is how three clicks were observed to land on 2. So exactly one
	// request per line is ever in flight, and clicks that arrive meanwhile are
	// coalesced into the next one — three fast clicks send 2, then 4.
	const flush = async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			while (requested.current !== null) {
				const target = requested.current;
				const ok = await updateLine(line.id, target);
				// Settled on the newest value (or failed): hand the display back to
				// the server snapshot, which is the truth either way.
				if (!ok || requested.current === target) {
					requested.current = null;
					setOptimistic(null);
					return;
				}
				// More clicks landed while this was out — send the newest.
			}
		} finally {
			inFlight.current = false;
		}
	};

	const step = (delta: number) => {
		// The ref advances synchronously, so clicks compound within one frame
		// instead of all reading the same stale `line.quantity`.
		const base = requested.current ?? line.quantity;
		const next = Math.min(Math.max(base + delta, 0), ceiling);
		if (next === base) return;
		requested.current = next;
		setOptimistic(next);
		void flush();
	};

	// Back to the product page. Null whenever the slug lookup came up empty (see
	// the type note on `productSlug`), in which case the thumbnail renders as a
	// plain image rather than a link to nowhere.
	const productHref = merchandise.productSlug
		? resolveHref({
				documentType: 'pProduct',
				slug: merchandise.productSlug,
				locale,
			})
		: undefined;

	// `||`, not `??`: Shopify allows empty alt text, and `??` would pass `''`
	// straight through — leaving the link below with no accessible name, since the
	// image is all it contains.
	const thumbnail = merchandise.imageUrl && (
		<Image
			src={merchandise.imageUrl}
			alt={merchandise.imageAlt || merchandise.productTitle}
			width={90}
			height={90}
			className="shrink-0 rounded object-contain"
		/>
	);

	return (
		<li className="flex gap-3 py-4">
			{thumbnail &&
				(productHref ? (
					// The drawer closes itself on navigation (CartProvider watches the
					// pathname), so no onClick is needed here.
					//
					// prefetch={false}: a full cart would otherwise fire one route
					// prefetch per line the moment it opens, competing with the cart's
					// own request and the checkout the shopper is usually here for.
					<Link
						href={productHref}
						prefetch={false}
						className="shrink-0 rounded focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none"
					>
						{thumbnail}
					</Link>
				) : (
					thumbnail
				))}
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="t-b-2 uppercase font-medium text-balance">
					{merchandise.productTitle}
				</p>
				{variantLabel && (
					<p className="t-b-2 text-muted-foreground uppercase">
						{variantLabel}
					</p>
				)}
				{stockLimit !== undefined && (
					<p className="t-b-2 text-muted-foreground">
						{interpolate(t.stockLimited, { count: stockLimit })}
					</p>
				)}
				<div className="mt-auto flex items-center gap-3">
					<div className="flex items-center gap-2" aria-label={t.quantity}>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={t.decrease}
							onClick={() => step(-1)}
						>
							–
						</Button>
						<span className="t-b-2 min-w-4 text-center">{quantity}</span>
						<Button
							variant="ghost"
							size="icon-xs"
							disabled={quantity >= ceiling}
							aria-label={t.increase}
							onClick={() => step(1)}
						>
							+
						</Button>
					</div>
					<button
						type="button"
						disabled={isPending}
						onClick={() => removeLine(line.id)}
						aria-label={interpolate(t.removeAriaLabel, {
							product: merchandise.productTitle,
						})}
						className="t-b-2 cursor-pointer uppercase underline underline-offset-4 disabled:opacity-50 text-primary/50"
					>
						{t.remove}
					</button>
				</div>
			</div>
			{/* Per unit, not `line.total`: a price that multiplied as the stepper
			    moved read as if the item itself had got more expensive. The quantity
			    is right there, and the figure that grows is the subtotal below.
			    `unitPrice` comes from the line's cost rather than the variant's list
			    price, so a discounted line still adds up to the subtotal. */}
			<p className="t-b-2 shrink-0">
				{formatShopifyPrice(line.unitPrice, locale)}
			</p>
		</li>
	);
}

/**
 * Empty-cart configuration from Sanity (`settingsCart`), via siteData. The
 * document is localized, so these products are already in the visitor's
 * language — no re-resolution needed here.
 */
export type CartSettings = {
	emptyHeading?: string | null;
	recommendedProducts?: unknown[] | null;
} | null;

export default function CartDrawerPanel({
	settings,
}: {
	settings?: CartSettings;
}) {
	const reduce = useReducedMotion() ?? false;
	const locale = useLocale();
	const t = useTranslations('cart');
	const { cart, isOpen, setOpen } = useCart();

	// Rendered without a price. Getting a live one here would mean a Shopify
	// lookup inside getCachedSiteData, i.e. on every page of the site (see the
	// note there), and the manual `price` these cards carry is only a fallback —
	// for a Shopify-linked product it is whatever an editor last typed, so
	// showing it risks quoting a stale figure. The real price is one tap away on
	// the product page; this list is for discovery.
	const recommendations = (settings?.recommendedProducts ?? [])
		.filter(Boolean)
		.map((product) => ({
			...(product as React.ComponentProps<typeof ProductCard>['product']),
			price: null,
		}));

	useScrollLock(isOpen, () => setOpen(false));

	const lines = cart?.lines ?? [];
	const count = cart?.totalQuantity ?? 0;

	return (
		<Dialog.Root open={isOpen} onOpenChange={setOpen} modal={true}>
			<Dialog.Portal forceMount>
				<AnimatePresence>
					{isOpen && (
						<>
							<Dialog.Overlay asChild forceMount key="cart-overlay">
								<motion.div
									className="fixed inset-0 z-popover bg-black/50"
									variants={cartOverlay}
									initial="hide"
									animate="show"
									exit="hide"
								/>
							</Dialog.Overlay>
							<Dialog.Content asChild forceMount key="cart-panel">
								<motion.div
									// `cart-surface` pins the theme tokens this subtree resolves
									// (border, muted-foreground, accent-foreground…) to their
									// :root values. The panel is light in both themes, but it
									// opens on dark routes too, where the inherited dark tokens
									// put white/10% borders and 2.6:1 text on white. See
									// globals.css.
									//
									// Explicit max-width, not max-w-sm: globals.css remaps the
									// container scale (sm is 600px here, xs 300px), so the
									// Tailwind size names don't give a drawer-shaped panel.
									className="cart-surface text-black bg-white fixed inset-y-0 right-0 z-popover flex w-full max-w-104 flex-col border-l border-border"
									variants={cartPanel}
									initial="hide"
									animate="show"
									exit="hide"
									custom={reduce}
								>
									{/* The visible count is a badge, which is aria-hidden — so the
									    item-count phrasing lives here, and screen readers still get
									    it in words. */}
									<Dialog.Description className="sr-only">
										{count > 0
											? `${t.title}, ${interpolate(pickPlural(t.itemCount, count), { count })}`
											: t.title}
									</Dialog.Description>

									<div className="flex shrink-0 items-center justify-between px-4 h-header">
										{/* `relative inline-flex` shrinks the title to its text so
										    the badge hangs off the word, not off the header row. */}
										<Dialog.Title className="t-b-2 relative inline-flex uppercase">
											{t.title}
											{count > 0 && (
												<CartCountBadge
													count={count}
													className="absolute -top-2 -right-4"
												/>
											)}
										</Dialog.Title>
										<Dialog.Close
											aria-label={t.close}
											className="t-b-2 flex cursor-pointer items-center gap-1 uppercase"
										>
											<CloseIcon className="size-4" />
										</Dialog.Close>
									</div>

									{lines.length === 0 ? (
										<div className="px-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
											<p className="t-b-2 py-12 text-center uppercase">
												{t.empty}
											</p>
											{recommendations.length > 0 && (
												<div className="border-t border-border pt-6 pb-8">
													{settings?.emptyHeading && (
														<p className="t-b-2 mb-4 uppercase">
															{settings.emptyHeading}
														</p>
													)}
													<div className="grid grid-cols-2 gap-4">
														{recommendations.map((product, i) => (
															<ProductCard
																key={product._id}
																product={product}
																index={i}
															/>
														))}
													</div>
												</div>
											)}
										</div>
									) : (
										<ul className="px-4 min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
											{lines.map((line) => (
												<LineItem key={line.id} line={line} />
											))}
										</ul>
									)}

									{cart && lines.length > 0 && (
										<div className="px-4 flex shrink-0 flex-col gap-3 border-t border-border py-5">
											<div className="t-b-2 flex items-center justify-between uppercase">
												<span>{t.subtotal}</span>
												<span>{formatShopifyPrice(cart.subtotal, locale)}</span>
											</div>
											<p className="t-b-2 text-muted-foreground">
												{t.shippingNote}
											</p>
											{/* A link, not a form: the site's `form-action 'self'` CSP
											    would block a cross-origin form submit. */}
											<Button asChild size="xl" className="w-full uppercase">
												<a href={shopifyCheckoutUrl(cart.checkoutUrl, locale)}>
													{t.checkout}
												</a>
											</Button>
										</div>
									)}
								</motion.div>
							</Dialog.Content>
						</>
					)}
				</AnimatePresence>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
