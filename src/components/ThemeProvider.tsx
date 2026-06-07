'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { stripLocaleFromPath } from '@/lib/i18n';

function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	const pathname = usePathname();
	const { path } = stripLocaleFromPath(pathname);
	const isLight = path === '/curated' || path.startsWith('/curated/');

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

			if (event.key.toLowerCase() !== 'd') {
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
