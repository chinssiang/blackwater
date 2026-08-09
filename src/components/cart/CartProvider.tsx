'use client';

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import type { ShopifyCart } from '@/lib/shopify/types';

// Single source of cart state for the whole site. The cart itself lives in
// Shopify and is addressed by an httpOnly cookie, so this holds only the last
// snapshot the server returned — every mutation replaces it wholesale rather
// than adjusting quantities locally, which keeps totals and per-line discounts
// exactly what Shopify will charge.

type CartContextValue = {
	cart: ShopifyCart | null;
	/** True while a cart request is in flight (initial load or a mutation). */
	isPending: boolean;
	/**
	 * Per-line stock ceilings learned from Shopify capping a request, keyed by
	 * cart-line id. Held here rather than in the line component so it survives
	 * closing and reopening the drawer — a plain re-read of the cart cannot
	 * rediscover it.
	 */
	stockLimits: Record<string, number>;
	isOpen: boolean;
	setOpen: (open: boolean) => void;
	addLine: (merchandiseId: string, quantity?: number) => Promise<boolean>;
	updateLine: (lineId: string, quantity: number) => Promise<boolean>;
	removeLine: (lineId: string) => Promise<boolean>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
	const value = useContext(CartContext);
	if (!value) throw new Error('useCart must be used within CartProvider');
	return value;
}

type CartResponse = { ok: boolean; cart: ShopifyCart | null };

export function CartProvider({ children }: { children: ReactNode }) {
	const locale = useLocale();
	const t = useTranslations('cart');
	const [cart, setCart] = useState<ShopifyCart | null>(null);
	const [isPending, setIsPending] = useState(false);
	const [stockLimits, setStockLimits] = useState<Record<string, number>>({});
	const [isOpen, setOpen] = useState(false);

	// A response can still be in flight when the provider goes away; applying it
	// then would write state into a torn-down tree.
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	// A capped response tells us the real ceiling for that line: whatever
	// quantity came back.
	//
	// A ceiling is only forgotten when the line is gone, or when its quantity has
	// somehow risen past it (stock was replenished). It deliberately survives an
	// uncapped response, because every mutation returns *all* lines: updating one
	// line would otherwise clear the ceiling learned for another and re-enable a
	// stepper that is still at its limit.
	const applyCart = useCallback((next: ShopifyCart | null) => {
		if (!mounted.current) return;
		setCart(next);
		setStockLimits((prev) => {
			const updated: Record<string, number> = {};
			for (const line of next?.lines ?? []) {
				if (line.atStockLimit) updated[line.id] = line.quantity;
				// `<=`, not `<`: a line resting *exactly* on its ceiling is the normal
				// state after a cap, and it comes back uncapped on every later
				// response. Using `<` dropped the ceiling the moment any other line
				// was touched, which is the case this whole branch exists to prevent.
				else if (prev[line.id] !== undefined && line.quantity <= prev[line.id])
					updated[line.id] = prev[line.id];
			}
			return updated;
		});
	}, []);

	// Close on navigation. The drawer's recommendations are links, and this
	// provider sits in Layout, so it survives a client-side navigation — without
	// this the shopper lands on the product page with the drawer still covering
	// it and the page still scroll-locked. Keyed on the pathname rather than on
	// link clicks so it holds however the navigation was triggered.
	const pathname = usePathname();
	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	// Every cart request — mutations *and* plain reads — runs strictly one at a
	// time, chained onto this tail. Each response replaces the whole snapshot, so
	// two in flight at once would apply in arrival order: removing line B while
	// stepping line A could land A's older snapshot last and resurrect B, and a
	// bfcache-restore refresh landing after a quantity bump would revert the line
	// to its pre-bump state. Per-line guards can't fix that — the race is *across*
	// lines and actions — so the ordering belongs here.
	const queue = useRef<Promise<unknown>>(Promise.resolve());
	// Counts requests rather than flagging one, so the first response to land
	// doesn't clear `isPending` while its successors are still out.
	const inFlight = useRef(0);

	const enqueue = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
		inFlight.current += 1;
		setIsPending(true);
		const tracked = async (): Promise<T> => {
			try {
				return await run();
			} finally {
				inFlight.current -= 1;
				if (inFlight.current === 0) setIsPending(false);
			}
		};
		// `catch` keeps one rejection from poisoning the tail for every later
		// request; the callers already resolve rather than throw.
		const next = queue.current.then(tracked, tracked);
		queue.current = next.catch(() => {});
		return next;
	}, []);

	const refreshCart = useCallback(
		() =>
			enqueue(async () => {
				try {
					const res = await fetch('/api/shopify/cart');
					if (!res.ok) return;
					const data = (await res.json()) as CartResponse;
					applyCart(data.cart);
				} catch {
					// No cart on screen yet, so a failed read has nothing to report —
					// the next mutation surfaces the error itself.
				}
			}),
		[enqueue, applyCart]
	);

	// Hydrate after mount rather than on the server. Reading the cart cookie
	// during render would make the cart part of the cached HTML for every page
	// that renders the header, which is the whole site — and one shopper's lines
	// must never be served to another. Fetching client-side keeps the cart out of
	// any shared render entirely.
	useEffect(() => {
		refreshCart();
	}, [refreshCart]);

	// Checkout is a cross-origin link, so the shopper leaves mid-state and React
	// effect cleanups never run on unload. On a back/forward-cache restore the
	// cart snapshot predates whatever happened at Shopify — an order they just
	// placed would still be sitting in the drawer — so re-read it. The drawer's
	// own restore (closing it, releasing the scroll lock) belongs to
	// `useScrollLock`, which every overlay shares.
	useEffect(() => {
		const onShow = (event: PageTransitionEvent) => {
			if (event.persisted) refreshCart();
		};
		window.addEventListener('pageshow', onShow);
		return () => window.removeEventListener('pageshow', onShow);
	}, [refreshCart]);

	const mutate = useCallback(
		(body: Record<string, unknown>): Promise<boolean> =>
			enqueue(async (): Promise<boolean> => {
				try {
					const res = await fetch('/api/shopify/cart', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ ...body, locale }),
					});
					if (!res.ok) {
						toast.error(t.errorHeading, { description: t.errorBody });
						return false;
					}
					const data = (await res.json()) as CartResponse;
					applyCart(data.cart);
					return true;
				} catch {
					toast.error(t.errorHeading, { description: t.errorBody });
					return false;
				}
			}),
		[enqueue, applyCart, locale, t.errorBody, t.errorHeading]
	);

	const addLine = useCallback(
		(merchandiseId: string, quantity = 1) =>
			mutate({ action: 'add', merchandiseId, quantity }),
		[mutate]
	);

	const updateLine = useCallback(
		(lineId: string, quantity: number) =>
			mutate({ action: 'update', lineId, quantity }),
		[mutate]
	);

	const removeLine = useCallback(
		(lineId: string) => mutate({ action: 'remove', lineId }),
		[mutate]
	);

	return (
		<CartContext.Provider
			value={{
				cart,
				isPending,
				stockLimits,
				isOpen,
				setOpen,
				addLine,
				updateLine,
				removeLine,
			}}
		>
			{children}
		</CartContext.Provider>
	);
}
