'use client';

import { Component, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useCart } from './CartProvider';
import type { CartSettings } from './CartDrawerPanel';

// The drawer mounts in the site Layout, so whatever it imports is in the shared
// bundle on every route — including pages with no commerce on them at all. Its
// contents are heavy (Radix Dialog, Motion, and ProductCard → ImageBlock →
// SanityImage for the empty state), so the panel lives in its own chunk and is
// fetched the first time a shopper opens the cart.
//
// `ssr: false` because the drawer renders nothing until opened: there is no
// server markup to hydrate, and the cart itself only exists after CartProvider
// hydrates from the cookie.
const CartDrawerPanel = dynamic(() => import('./CartDrawerPanel'), {
	ssr: false,
	// Without this the tap does nothing at all until the chunk lands — no
	// backdrop, and no scroll lock either, since that lives inside the panel.
	// Matches the panel's own overlay so the real drawer slides in over the same
	// surface rather than a flash of a second one.
	//
	// `pointer-events-none` on purpose: if the chunk is slow or never arrives,
	// this must not become a modal the shopper can't dismiss. It reads as "the
	// cart is opening" while leaving the page underneath fully usable.
	loading: () => (
		<div
			aria-hidden
			className="fixed inset-0 z-popover bg-black/50 pointer-events-none"
		/>
	),
});

/**
 * A failed chunk fetch — the usual cause being a deploy rotating build assets
 * under an already-open tab — would otherwise leave `isOpen` stuck true behind a
 * component that never resolves, with no drawer and no way to reach the cart
 * short of a reload. Resetting both flags puts the trigger back in a state where
 * the next tap retries the import.
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
	if (isOpen && !everOpened) setEverOpened(true);

	if (!everOpened) return null;
	return (
		<CartPanelBoundary
			onError={() => {
				setOpen(false);
				setEverOpened(false);
			}}
		>
			<CartDrawerPanel settings={settings} />
		</CartPanelBoundary>
	);
}
