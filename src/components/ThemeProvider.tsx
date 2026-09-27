'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { usePathname } from 'next/navigation';
import { isLightThemePath } from '@/lib/routes';

// next-themes (0.4.6, latest) injects its anti-flash theme <script> via
// React.createElement. React 19 logs "Encountered a script tag while rendering
// React component" whenever that script is re-committed during a client render —
// which happens on a locale switch, since the [locale] layout owns <html> and the
// whole shell re-renders client-side. The script still runs server-side on every
// fresh load, so it's a known false positive with no upstream fix.
// See https://github.com/shadcn-ui/ui/issues/10104. Drop only this exact message
// (dev only — the warning is stripped from production builds) and let every other
// console.error through.
//
// Patched once at module scope, not in an effect: an effect installs after the
// first client render and its cleanup restores the original whenever this
// provider remounts (a locale switch replaces the [locale] layout), so the very
// render that re-creates the script ran unpatched and the warning got through.
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
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
}

function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	const pathname = usePathname();
	const isLight = isLightThemePath(pathname);

	// `forcedTheme` is a ternary, so it is ALWAYS set: dark everywhere except the
	// forced-light routes, and no user-facing theme switch by design (DESIGN.md,
	// Theme and surfaces). next-themes ignores `setTheme` entirely while it is
	// present, so `defaultTheme`/`enableSystem` would be inert here and are
	// deliberately not passed. `disableTransitionOnChange` is NOT inert — the
	// forced theme really does flip when navigating between a light and a dark
	// route.
	return (
		<NextThemesProvider
			attribute="class"
			disableTransitionOnChange
			forcedTheme={isLight ? 'light' : 'dark'}
			{...props}
		>
			{children}
		</NextThemesProvider>
	);
}

export { ThemeProvider };
