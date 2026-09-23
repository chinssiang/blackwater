import localFont from 'next/font/local';

// The two brand faces, declared once for every root layout that renders site
// markup: HtmlShell, and the Studio's module-preview frames
// (src/app/module-preview/[locale]/layout.tsx). The `t-*` type utilities resolve these
// variables, so a layout that renders modules without them falls back silently.

export const fontABCDisplay = localFont({
	src: [
		{
			path: '../app/fonts/abc-display-regular.woff2',
			weight: '400',
			style: 'normal',
		},
	],
	variable: '--font-ABC-Display',
	display: 'swap',
});

export const baselTypewriter = localFont({
	src: [
		{
			path: '../app/fonts/basel-typewriter.woff2',
			weight: '400',
			style: 'normal',
		},
	],
	variable: '--font-basel-typewriter',
	display: 'swap',
});
