'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { stripLocaleFromPath } from '@/lib/i18n';

// next-themes (0.4.6, latest) injects its anti-flash theme <script> via
// React.createElement. React 19 logs "Encountered a script tag while rendering
// React component" whenever that script is re-committed during a client render —
// which happens on a locale switch, since the [locale] layout owns <html> and the
// whole shell re-renders client-side. The script still runs server-side on every
// fresh load, so it's a known false positive with no upstream fix.
// See https://github.com/shadcn-ui/ui/issues/10104. Drop only this exact message
// (dev only — the warning is stripped from production builds) and let every other
// console.error through.
function useSilenceNextThemesScriptWarning() {
	React.useEffect(() => {
		if (process.env.NODE_ENV === 'production') return;
		const original = console.error;
		console.error = (...args: unknown[]) => {
			if (
				typeof args[0] === 'string' &&
				args[0].includes('Encountered a script tag while rendering')
			) {
				return;
			}
			original(...args);
		};
		return () => {
			console.error = original;
		};
	}, []);
}

function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	const pathname = usePathname();
	const { path } = stripLocaleFromPath(pathname);
	const isLight = path === '/products' || path.startsWith('/products/');

	useSilenceNextThemesScriptWarning();

	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			forcedTheme={isLight ? 'light' : 'dark'}
			{...props}
		>
			<ThemeHotkey />
			{children}
		</NextThemesProvider>
	);
}

function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	return (
		target.isContentEditable ||
		target.tagName === 'INPUT' ||
		target.tagName === 'TEXTAREA' ||
		target.tagName === 'SELECT'
	);
}

function ThemeHotkey() {
	const { resolvedTheme, setTheme } = useTheme();

	React.useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.defaultPrevented || event.repeat) {
				return;
			}

			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}

			if (event.key?.toLowerCase() !== 'd') {
				return;
			}

			if (isTypingTarget(event.target)) {
				return;
			}

			setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
		}

		window.addEventListener('keydown', onKeyDown);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	}, [resolvedTheme, setTheme]);

	return null;
}

export { ThemeProvider };
