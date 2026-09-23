/**
 * One module type, rendered live from preset data — the page the Studio's
 * "Add item" picker iframes per card
 * (src/sanity/schemaTypes/components/PageModulesInput.tsx).
 *
 * Renders through the real `PageModules` dispatcher rather than importing a
 * renderer directly, so a preview can never drift from what the page ships.
 * None of `headingLevel`, `ownsWeatherWidget` or `isPageOpener` is passed: the
 * card should show the module as a section, without the homepage-only h1
 * underlay or the weather widget.
 *
 * Prerendered per locale × type, with hourly ISR for the reason `/` and
 * `/[slug]` carry it: `eventsBlock` decides what to show from the wall clock.
 * That cache only serves editors WITHOUT the draft-mode cookie. Anyone who has
 * opened Presentation carries it, so their cards render on demand and
 * `eventsBlock` reads the drafts perspective uncached — which can list an
 * unpublished event. Accepted: it is an editor-only preview, and draft content
 * is what those editors are working on.
 */
import { notFound } from 'next/navigation';
import { LOCALES, isLocale } from '@/lib/i18n';
import PageModules from '@/components/PageModules';
import { MODULE_PREVIEWS, isModuleType } from '../../_presets';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
	return LOCALES.flatMap((locale) =>
		Object.keys(MODULE_PREVIEWS[locale]).map((type) => ({ locale, type }))
	);
}

export default async function ModulePreviewPage({
	params,
}: {
	params: Promise<{ locale: string; type: string }>;
}) {
	const { locale, type } = await params;

	if (!isLocale(locale) || !isModuleType(type)) notFound();

	return (
		<PageModules
			module={{ _type: type, ...MODULE_PREVIEWS[locale][type] }}
			locale={locale}
		/>
	);
}
