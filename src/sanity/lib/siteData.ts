import { cache } from 'react';
import { sanityFetch } from '@/sanity/lib/live';
import { siteDataQuery } from '@/sanity/lib/queries';
import type { SiteDataQueryResult } from 'sanity.types';

export const SITE_DATA_TAGS = [
	'gAnnouncement',
	'gHeader',
	'gFooter',
	'gMobileMenu',
	'gNewsletter',
	'gToolbar',
	'settingsMenu',
	'settingsGeneral',
	'settingsIntegration',
	'settingsConsent',
	'settingsCart',
	'settingsBrandColors',
	'pProductIndex',
	// Menu labels fall back to internalLink->title, so renaming a linked page
	// must refresh the chrome; the cart's recommendedProducts embed the full
	// productCardFields (pProduct, categories[]->, brands[]->).
	'pGeneral',
	'pEvent',
	'pProduct',
	'pProductCategory',
	'pBrand',
] as const;

// Deliberately Sanity-only. This runs for every page that renders the site
// chrome — including generateMetadata, /email-signature, /events-crew and the
// 404 — so nothing here may depend on Shopify: `revalidateTag('shopify')` fires
// on every product and inventory webhook, and a Storefront lookup in this path
// would make the next render of an unrelated page block on it.
export const getCachedSiteData = cache((locale: string) =>
	sanityFetch({
		query: siteDataQuery,
		params: { locale },
		tags: [...SITE_DATA_TAGS, `locale:${locale}`],
	})
);

/**
 * The only parts of siteData the (client) `<Layout>` tree actually renders.
 *
 * The six chrome slices are plainly `any`, and the *keys* are what this type
 * enforces: a `pickLayoutData` that forgot `toolbar` fails to compile, and the
 * wide query result is not assignable here because it has no top-level
 * `siteTitle`. That key list is the boundary.
 *
 * The value types are `any` because `Menu` declares `data: SettingsMenu` — the
 * whole document type — while `menuFields` projects a structurally different
 * shape (localized titles, `link` resolved through `resolvedHrefGroq`, no
 * `_id`/`_rev`); `Header`, `Footer` and `ToolBar` inherit that same wrong type.
 * Typing these slices precisely (a `Pick<SiteDataQueryResult, …>`) requires
 * fixing those four declarations first. Until then `any` is the honest
 * spelling — an earlier version wrote `Projected | any`, which TypeScript
 * collapses to `any` anyway while reading like precision it did not have.
 */
export type LayoutData = {
	header: any;
	footer: any;
	// Not `any`, unlike its neighbours: <Newsletter> derives its prop type from
	// this same projection, so typing the slice is what makes a dropped or
	// renamed field a compile error on the footer path too.
	newsletter: SiteDataQueryResult['newsletter'];
	mobileMenu: any;
	toolbar: any;
	cart: any;
	// `undefined` rather than `null`: Header and Footer declare
	// `siteTitle?: string`, so this stays assignable the day the `any` slices
	// above become precise types.
	siteTitle: string | undefined;
};

/**
 * Narrow siteData to what `<Layout>` renders, before it crosses the server →
 * client boundary.
 *
 * `<Layout>` is a client component, so every property handed to it is
 * serialized into the RSC payload of every page. The full query result also
 * carries `announcement`, `productSubmissionEmail` (read only by the products
 * layout), all of `sharing` except `siteTitle` (address, geo, socialLinks,
 * logos, favicons — all consumed server-side by
 * defineSiteJsonLd/defineBaseMetadata), plus `consent`, which HtmlShell passes
 * separately to ConsentBanner from a `stegaClean` *copy* — a different object
 * reference, so it was genuinely serialized twice per page. (`integrations` is
 * also passed separately but read raw, so it deduped by reference and only ever
 * shipped once.)
 *
 * Note this only stops `announcement` reaching the client; `siteDataQuery`
 * still fetches it, and nothing renders it. That is a query-level cleanup.
 *
 * This builds one new object holding the *same* sub-object references, so RSC
 * reference-deduplication still applies to header/footer/menus.
 */
export function pickLayoutData(
	data: SiteDataQueryResult | null | undefined
): LayoutData {
	return {
		header: data?.header ?? null,
		footer: data?.footer ?? null,
		newsletter: data?.newsletter ?? null,
		mobileMenu: data?.mobileMenu ?? null,
		toolbar: data?.toolbar ?? null,
		cart: data?.cart ?? null,
		siteTitle: data?.sharing?.siteTitle ?? undefined,
	};
}
