'use client';

import { Component, type ReactNode, Suspense, lazy, useState } from 'react';
import type { CartSettings } from './CartDrawerPanel';
import { useCart } from './CartProvider';

// The drawer mounts in the site Layout, so whatever it imports is in the shared
// bundle on every route — including pages with no commerce on them at all. Its
// contents are heavy (Base UI Dialog, Motion, and ProductCard → ImageBlock →
// SanityImage for the empty state), so the panel lives in its own chunk and is
// fetched the first time a shopper opens the cart.
//
// A plain React.lazy rather than next/dynamic, and made per attempt: both cache
// a rejected import forever, and next/dynamic's lazy is created once at module
// scope, so after one failed chunk fetch every later tap rethrew immediately and
// the cart could never open again in that tab. A fresh lazy per attempt is what
// lets the boundary below actually retry. No `ssr: false` is needed: nothing
// renders until a shopper has opened the cart, which only happens client-side.
const createCartDrawerPanel = () => lazy(() => import('./CartDrawerPanel'));

// Without this the tap does nothing at all until the chunk lands — no backdrop,
// and no scroll lock either, since that lives inside the panel. Matches the
// panel's own overlay so the real drawer slides in over the same surface rather
// than a flash of a second one.
//
// `pointer-events-none` on purpose: if the chunk is slow or never arrives, this
// must not become a modal the shopper can't dismiss. It reads as "the cart is
// opening" while leaving the page underneath fully usable.
const panelFallback = (
	<div
		aria-hidden
		className="z-popover pointer-events-none fixed inset-0 bg-black/50"
	/>
);

/**
 * A failed chunk fetch — the usual cause being a deploy rotating build assets
 * under an already-open tab — would otherwise leave `isOpen` stuck true behind a
 * component that never resolves, with no drawer and no way to reach the cart
 * short of a reload. Resetting both flags, and swapping in a fresh lazy, puts the
 * trigger back in a state where the next tap retries the import.
 */
class CartPanelBoundary extends Component<
	{ onError: () => void; children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.error('[cart] drawer panel failed to load', error);
		this.props.onError();
	}

	render() {
		return this.state.failed ? null : this.props.children;
	}
}

export default function CartDrawer({ settings }: { settings?: CartSettings }) {
	const { isOpen, setOpen } = useCart();
	// Latched, not `isOpen` directly: unmounting on close would throw away the
	// panel's exit animation and leave every reopen re-mounting a fresh Dialog.
	// Once opened, the panel stays mounted and handles its own open state.
	const [everOpened, setEverOpened] = useState(false);
	const [CartDrawerPanel, setCartDrawerPanel] = useState(createCartDrawerPanel);
	if (isOpen && !everOpened) setEverOpened(true);

	if (!everOpened) return null;
	return (
		<CartPanelBoundary
			onError={() => {
				setOpen(false);
				setEverOpened(false);
				setCartDrawerPanel(createCartDrawerPanel);
			}}
		>
			<Suspense fallback={panelFallback}>
				<CartDrawerPanel settings={settings} />
			</Suspense>
		</CartPanelBoundary>
	);
}
