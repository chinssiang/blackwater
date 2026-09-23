/**
 * Root layout for the module-type previews the Studio's "Add item" picker
 * iframes (src/sanity/schemaTypes/components/PageModulesInput.tsx).
 *
 * Its own root beside `(frontend)` and `sanity` rather than a page under
 * `[locale]`: that subtree renders the site header and footer, `<SanityLive>`,
 * tracking, the consent banner and a `siteDataQuery` fetch — all noise inside a
 * 280px picker card, and a Sanity round-trip per iframe.
 *
 * What it DOES keep is what the modules render against: `globals.css`, the two
 * brand fonts (the `t-*` utilities resolve their variables), the theme class
 * the tokens are keyed on, and `LocaleProvider` (`ProductCard` reads its
 * strings from it). Drop any of them and the previews break silently.
 *
 * The theme class is set directly rather than through `ThemeProvider`, which
 * would mount next-themes in every card to produce a constant — but it is
 * still read off `isLightThemePath`, so the picker follows the same rule the
 * site does. The locale is the editing document's, passed by the picker, so a
 * zh_tw page previews its modules in Chinese.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '@/globals.css';
import type { Dictionary } from '@/lib/dictionary';
import { getDictionary } from '@/lib/dictionary.server';
import { baselTypewriter, fontABCDisplay } from '@/lib/fonts';
import { LOCALES, htmlLangFor, isLocale } from '@/lib/i18n';
import { isLightThemePath } from '@/lib/routes';
import { LocaleProvider } from '@/components/LocaleProvider';

export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

export const dynamicParams = false;

export function generateStaticParams() {
	return LOCALES.map((locale) => ({ locale }));
}

const themeClass = isLightThemePath('/module-preview') ? 'light' : 'dark';

export default async function ModulePreviewLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const { products, cart } = await getDictionary(locale);
	// Only the namespaces a module reads on the CLIENT: ProductCard's `products`,
	// and `cart` for its quick-add control. Everything handed to LocaleProvider
	// is serialized into each frame's RSC payload, five frames per picker open,
	// and the server modules resolve their own strings. The cast is the price of
	// LocaleProvider typing the whole dictionary; a module that starts reading
	// another namespace client-side must be added here or it reads undefined.
	const dictionary = { products, cart } as Dictionary;

	return (
		<html
			lang={htmlLangFor(locale)}
			className={`${fontABCDisplay.variable} ${baselTypewriter.variable} ${themeClass} bg-background`}
		>
			{/* `inert` because this document only ever exists to be LOOKED at,
			    inside an iframe the picker marks `aria-hidden`: without it the
			    modules' links and accordion triggers stay focusable inside a subtree
			    assistive tech has been told is not there. `pointer-events: none` on
			    the frame stops the mouse only.

			    Centred with `my-auto` on the child rather than `justify-center`
			    here: a centred flex container overflows symmetrically and the part
			    past the start edge cannot be scrolled to, so a preview taller than
			    the frame would lose its top. Auto margins yield to overflow. */}
			<body
				inert
				className="flex min-h-screen flex-col antialiased [&>*]:my-auto"
			>
				<LocaleProvider locale={locale} dictionary={dictionary}>
					{children}
				</LocaleProvider>
			</body>
		</html>
	);
}
