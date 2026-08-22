import { defineQuery } from 'next-sanity';
import { resolvedHrefGroq } from '@/lib/routes';
import { LOCALES } from '@/lib/i18n';

// Every locale, as a GROQ array literal. Spelled out rather than derived from
// LOCALES because the extractor substitutes syntax instead of executing JS:
// arrow-function calls with a concise body resolve fine (see `locString` below),
// but `LOCALES.map(...).join(...)` does not — same constraint as
// `resolvedHrefGroq`. The assignment below is a compile-time guard: adding a
// locale to LOCALES breaks the build here until this literal is updated, rather
// than silently dropping that locale from the sitemap.
const ALL_LOCALES_GROQ = '["en", "zh_tw"]';
const _localesCovered: typeof LOCALES = ['en', 'zh_tw'] as const;
void _localesCovered;
export const homeID = defineQuery(`*[_type == "pHome"][0]._id`);

export const SITEMAP_PAGES_QUERY = defineQuery(`
	*[_type in ["pHome", "pGeneral", "pContact", "pFaq", "pSizeGuide"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)] {
		_type,
		"slug": slug.current,
		_updatedAt,
		language
	}
`);

// Which locales a field-level i18n array actually carries copy for.
//
// `defined(value)` is load-bearing: the internationalizedArray plugin is
// configured with defaultLanguages: ['en'], and it patches a valueless
// `{_key, language: 'en'}` item into any i18n array it mounts that lacks the
// default language. So merely opening a zh-only product in the Studio would
// otherwise make it advertise an `en` hreflang + sitemap URL that 404s, because
// `productTitleVisible` (correctly) requires an actual value.
//
// Declared here, above its first use in SITEMAP_PRODUCTS_QUERY, so the sitemap
// and the hreflang projection below share one definition of "translated into".
export const localesWithValue = (field: string) =>
	`${field}[defined(value)].language`;

// `locales` carries which locales each entry exists in, because the four types
// signal it differently: document-level types (pProductIndex, and un-merged
// product docs during the transition) carry `language`; field-level types
// (pProduct/pProductCollection post-merge) signal per-locale presence via
// title[].language; pProductCategory has an i18n-array title too but its pages
// render an English fallback for every locale, so it advertises all of them.
// Without this, field-level types' zh_tw URLs silently vanish from the sitemap
// — categories had exactly that bug.
export const SITEMAP_PRODUCTS_QUERY = defineQuery(`
	*[_type in ["pProductIndex", "pProduct", "pProductCategory", "pProductCollection"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)
		&& (disableIndex != true)] {
		_type,
		"slug": slug.current,
		_updatedAt,
		"locales": select(
			defined(language) => [language],
			_type == "pProductCategory" => ${ALL_LOCALES_GROQ},
			${localesWithValue('title')}
		)
	}
`);

// Both event types are field-level localized, so neither carries `language` —
// `locales` is what tells sitemap.ts which URLs to emit. pEvent derives it from
// title[].language, so a zh-only event contributes only its zh_tw URL; pEvents
// is the index page, which renders an English fallback in every locale and so
// advertises all of them (same reasoning as pProductCategory above). Reading
// `language` here instead would silently drop every zh_tw event URL.
export const SITEMAP_EVENTS_QUERY = defineQuery(`
	*[_type in ["pEvents", "pEvent"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)
		&& (disableIndex != true)] {
		_type,
		"slug": slug.current,
		_updatedAt,
		"locales": select(
			_type == "pEvents" => ${ALL_LOCALES_GROQ},
			${localesWithValue('title')}
		)
	}
`);

const baseFields = `
	_id,
	_type,
	title,
	"slug": slug.current,
	"sharing":{
		...sharing,
		"shareGraphic": coalesce(
			sharing.shareGraphic,
			*[_type == "settingsGeneral"][0].shareGraphic
		),
		"siteTitle": coalesce(
			*[_type == "settingsGeneral"][0].siteTitle[language == $locale][0].value,
			*[_type == "settingsGeneral"][0].siteTitle[language == "en"][0].value
		),
	}
`;

const linkFields = `
	_type,
	linkType,
	"href": ${resolvedHrefGroq},
	"label": coalesce(label[language == $locale][0].value, label[language == "en"][0].value),
	isNewTab
`;

const menuFields = `
	_id,
	_type,
	title,
	items[]{
		"title": select(
			_type == "navDropdown" => coalesce(
				title[language == $locale][0].value,
				title[language == "en"][0].value
			),
			coalesce(
				title[language == $locale][0].value,
				title[language == "en"][0].value,
				link.label[language == $locale][0].value,
				link.label[language == "en"][0].value,
				link.internalLink->title[language == $locale][0].value,
				link.internalLink->title[language == "en"][0].value,
				link.internalLink->title,
				link.href
			)
		),
		link {
			${linkFields}
		},
		dropdownItems[]{
			_key,
			"title": coalesce(
				title[language == $locale][0].value,
				title[language == "en"][0].value,
				link.label[language == $locale][0].value,
				link.label[language == "en"][0].value,
				link.internalLink->title[language == $locale][0].value,
				link.internalLink->title[language == "en"][0].value,
				link.internalLink->title,
				link.href
			),
			link {
				${linkFields}
			}
		}
	}
`;

// Projection for a single mobile-menu navItem (flat list, no dropdowns).
// Mirrors the navItem branch of `menuFields` and reuses `linkFields`.
const mobileMenuItemFields = `
	"title": coalesce(
		title[language == $locale][0].value,
		title[language == "en"][0].value,
		link.label[language == $locale][0].value,
		link.label[language == "en"][0].value,
		link.internalLink->title[language == $locale][0].value,
		link.internalLink->title[language == "en"][0].value,
		link.internalLink->title,
		link.href
	),
	link {
		${linkFields}
	}
`;

export const imageMetaFields = `
	...,
  asset,
  crop,
  hotspot,
  "altText": asset->altText,
  "metadata": asset->metadata {
    lqip,
    dimensions,
    isOpaque,
    // From the asset, not the metadata object: sanity.imageMetadata has no
    // mimeType, so projecting it here resolved to null and left SanityImage's
    // JPEG fallback unreachable.
    "mimeType": ^.asset->mimeType
  }
`;

export const imageBlockMetaFields = `
  image{
		${imageMetaFields}
	},
	customRatio,
	imageMobile{
		${imageMetaFields}
	},
	customRatioMobile,
	caption,
	link{
		${linkFields}
	}
`;

const callToActionFields = `
	"label": coalesce(label[language == $locale][0].value, label[language == "en"][0].value),
	link {
		${linkFields}
	},
	"isButton": true
`;

const portableTextContentFields = `
	...,
	markDefs[]{
		...,
		_type == "link" => {
			${linkFields}
		},
		_type == "callToAction" => {
			${callToActionFields}
		}
	},
	_type == "image" => {
		${imageBlockMetaFields},
		link {
			${linkFields}
		}
	}
`;

const freeformField = `
	_type,
	_key,
	content[]{
		${portableTextContentFields}
	},
	sectionAppearance {
		...,
		"backgroundColor": backgroundColor->color,
		"textColor": textColor->color
	}
`;

// Projects a gFaq entry. Each gFaq is a single-locale document (document-level
// i18n), so no coalesce is needed — referencing pages resolve same-locale docs.
// `answer` is rich text (for rendering); `answerText` is flattened plain text
// for FAQPage JSON-LD.
const gFaqItemFields = `
	_id,
	question,
	"answer": answer[]{ ${portableTextContentFields} },
	"answerText": pt::text(answer)
`;

// gSizeChart is deliberately NOT document-localized — the measurements are
// locale-invariant, so the numbers are stored once. Only the text fields are
// translated, via the inline internationalizedArray coalesce pattern: the fit
// note and each measurement's label.
const gSizeChartFields = `
	_id,
	title,
	"slug": slug.current,
	unit,
	sizes,
	rows[]{
		_key,
		"label": coalesce(label[language == $locale][0].value, label[language == "en"][0].value),
		values[]{ _key, size, min, max }
	},
	"note": coalesce(note[language == $locale][0].value, note[language == "en"][0].value)
`;

const faqListField = `
	_type,
	_key,
	heading,
	"items": questions[]->{
		${gFaqItemFields}
	},
	sectionAppearance {
		...,
		"backgroundColor": backgroundColor->color,
		"textColor": textColor->color
	}
`;

const pageModuleFields = `
	_type == 'freeform' => {
		${freeformField}
	},
	_type == 'faqList' => {
		${faqListField}
	},
`;

const formField = `
	placeholder,
	_key,
	required,
	fieldLabel,
	fieldName,
	fieldWidth,
	inputType,
	selectOptions[] {
		_key,
		"title": option,
		"value": option
	}
`;

// Helper GROQ expression: returns the locale-preferred doc from a type,
// falling back to the English doc (or any doc with no language field yet).
const byLocale = (type: string) =>
	`*[_type == "${type}" && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)`;

// Inline projection field: lists which locale codes have a translated document.
// Uses GROQ implication — if the parent doc has a slug, narrow to that slug;
// for slug-less singletons the condition is vacuously true and only type is matched.
const availableLocalesField = `
"availableLocales": *[
	_type == ^._type
	&& (!defined(^.slug.current) || slug.current == ^.slug.current)
	&& defined(language)
].language
`;

// Reusable projection for the gNewsletter signup form. Shared by siteDataQuery
// (footer form) and pageNewsletterQuery (dedicated /newsletter page).
const newsletterFormFields = `
	// Whether a signup can actually complete, resolved exactly the way
	// newsletterConfigQuery resolves the list: this locale's document if it
	// carries one, otherwise any locale that does. gNewsletter is
	// document-localized, so fallback is whole-document — a zh_tw document that
	// exists but has no klaviyoListID does NOT inherit the English one, and the
	// form used to gate itself on that raw field. The result was a /zh_tw footer
	// with no form at all while /api/newsletter/subscribe could have subscribed
	// against the English list perfectly well.
	// The id itself stays out of the projection on purpose: the client no longer
	// chooses the list, and this object is handed to <Layout>, i.e. serialized
	// into the RSC payload of every page on the site.
	"signupEnabled": defined(coalesce(
		klaviyoListID,
		*[_type == "gNewsletter" && defined(klaviyoListID)][0].klaviyoListID
	)),
	heading,
	subheading,
	submitButtonText,
	"disclaimer": disclaimer[]{
		${portableTextContentFields}
	},
	successHeading,
	successBody,
	errorHeading,
	errorBody,
`;

// ---------------------------------------------------------------------------
// FIELD-level i18n helpers, shared by the product family (pProduct /
// pProductCollection / pProductCategory) and the event family (pEvent /
// pEvents / pEventCategory).
//
// One document carries every language — prose lives in internationalizedArrays,
// everything else (handle, price, dates, venue, refs, images) exists once. For
// products this mirrors Shopify's own model, where a product is a single entity
// and language is a query-time context. For events it mirrors reality: an event
// is one occurrence with one start time and one venue, which two documents could
// (and did) disagree about.
//
// Both families are fully migrated in every dataset, so these projections read
// the merged shape only. The `select(defined(language) => <old field>)` tails
// that carried the product queries through their migration are gone; documents
// that still carry `language` are the DOCUMENT-level types (pProductIndex,
// pHome, gHeader …), which are resolved by `byLocale` above and never touch
// these helpers.
// ---------------------------------------------------------------------------

// Localized string/text: current locale, falling back to English.
const locString = (field: string) =>
	`coalesce(${field}[language == $locale][0].value, ${field}[language == "en"][0].value)`;

// Localized Portable Text. Resolution is identical to `locString` — the alias
// exists only to mark, at the call site, that what comes back is a block array
// the caller still has to project with `[]{ ... }`.
const locPT = locString;

// Visibility guard for merged docs: shown in a locale only when they carry a
// title in that locale or in English. This preserves the doc-level behavior
// exactly — a zh-only doc never leaks onto English pages (it used to have no
// `en` document; now it has no `en` title), while an en-only doc renders its
// English fallback everywhere. Shared by the product and event queries.
const titleVisible = `(defined(title[language == $locale][0].value) || defined(title[language == "en"][0].value))`;

// The same guard applied AFTER a dereference, for editor-curated reference
// arrays (relatedProducts, collection products, cart recommendations). Those
// pickers are unfiltered — products are language-agnostic documents, so there
// is nothing to filter them by in the Studio — which means a zh-only product
// can be picked into a list rendered on an English page. Without this it comes
// through as a card with a null title linking to a URL that 404s, since
// pageProductSingleQuery does carry the guard.
// The parentheses are load-bearing: `refs[defined(@->)]->[<cond>]` parses but
// does NOT filter (verified against the API — 6 refs in, 6 out), silently
// producing exactly the leak this guards against. Wrapping the dereference
// first makes the trailing bracket a filter over the resulting array.
const visibleProducts = (refField: string) =>
	`(${refField}[defined(@->)]->)[${titleVisible}]`;

// Which locales this merged doc is translated into — feeds hreflang and the
// sitemap. Old-shape docs keep the sibling-document lookup. See
// `localesWithValue` above for why the new-shape arm filters on `defined(value)`.
const productAvailableLocalesField = `
"availableLocales": ${localesWithValue('title')}
`;

// The Shopify handle is commerce identity: one product, one handle, every
// language renders from it (localized prices come from Markets @inContext).
// The sibling lookup is transition-only, and is guarded like every other tail
// so a merged doc short-circuits to its own handle: unguarded it would re-run a
// correlated pProduct scan per card forever — including inside siteDataQuery's
// cart recommendations, which render on every page of the site.
const shopifyHandleField = `
	"shopifyHandle": shopify.handle
`;

// SEO block for field-level types, shaped exactly like baseFields' `sharing`
// so defineMetadata needs no awareness of the field-level model. New docs use
// the seo fieldset (seoTitle/seoDescription/shareGraphic/disableIndex); the
// retired `sharing` object it replaced no longer exists on these documents.
//
// Belongs only on a query's TOP-LEVEL document, never in a card or list item:
// nothing renders a card's SEO block, and each copy costs two `settingsGeneral`
// subqueries (share graphic + site title). Inside a 45-card listing that was 90
// subqueries and a full metadata block per card serialized to the client, all
// of it unread.
//
// `descFallback` names the localized prose field the meta description falls back
// to (excerpt for products and events, description for collections) — every
// schema promises that in the SEO Description field's help text, and
// pProductCategory already implements it. It sits BEFORE the transition tail
// deliberately: on an un-merged doc the i18n-array access yields null, so
// `sharing.metaDesc` still wins there rather than being shadowed by an
// old-shape plain excerpt.
//
// Both parameters are required and must be passed as string LITERALS: Sanity's
// static query extractor evaluates this template without running JS, so neither
// a ternary nor a default parameter value survives it (a default fails with
// "Could not find binding for node"). Types with no image or description
// fallback pass the literal 'noFallback' — an attribute no document has, so
// GROQ resolves that coalesce arm to null and skips it.
const i18nSharingFields = (imageFallback: string, descFallback: string) => `
	"sharing": {
		"disableIndex": disableIndex,
		"metaTitle": coalesce(seoTitle[language == $locale][0].value, seoTitle[language == "en"][0].value),
		"metaDesc": coalesce(
			seoDescription[language == $locale][0].value,
			seoDescription[language == "en"][0].value,
			${descFallback}[language == $locale][0].value,
			${descFallback}[language == "en"][0].value
		),
		"shareGraphic": coalesce(
			shareGraphic,
			${imageFallback},
			*[_type == "settingsGeneral"][0].shareGraphic
		),
		"siteTitle": coalesce(
			*[_type == "settingsGeneral"][0].siteTitle[language == $locale][0].value,
			*[_type == "settingsGeneral"][0].siteTitle[language == "en"][0].value
		),
	}
`;

// Sort key for product-family lists: English title (stable across locales,
// matching the Studio ordering), falling back to the old-shape plain title.
const productTitleOrder = `title[language == "en"][0].value`;

const productCardFields = `
	_id,
	_type,
	"title": ${locString('title')},
	"slug": slug.current,
	"excerpt": ${locString('excerpt')},
	badge,
	price,
	purchaseLink,
	${shopifyHandleField},
	categories[]->{
		_id,
		"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
		"slug": slug.current
	},
	brands[]->{ _id, title, "slug": slug.current },
	mainImage {
		${imageBlockMetaFields}
	}
`;

export const siteDataQuery = defineQuery(`{
		"announcement": ${byLocale('gAnnouncement')}[0]{
			display,
			messages,
			autoplay,
			autoplayInterval,
			backgroundColor,
			textColor,
			emphasizeColor,
			"link": ${linkFields}
		},
		"header": ${byLocale('gHeader')}[0]{
			menu->{
				${menuFields}
			}
		},
		"footer": ${byLocale('gFooter')}[0]{
			"menus": menus[]->{
				${menuFields}
			},
			copyright,
		},
		"toolbar": *[_type == "gToolbar"][0]{
			hideToolbar,
			"toolbarMenu": toolbarMenu->{
				${menuFields}
			}
		},
		"productSubmissionEmail": ${byLocale('pProductIndex')}[defined(submissionEmail)][0].submissionEmail,
		"mobileMenu": ${byLocale('gMobileMenu')}[0]{
			primaryMenu[]{
				${mobileMenuItemFields}
			},
			secondaryMenu[]{
				${mobileMenuItemFields}
			},
			cta{
				${callToActionFields}
			}
		},
		"newsletter": ${byLocale('gNewsletter')}[0]{
			${newsletterFormFields}
		},
		"sharing": *[_type == "settingsGeneral"][0]{
			"siteTitle": coalesce(siteTitle[language == $locale][0].value, siteTitle[language == "en"][0].value),
			"siteDescription": coalesce(siteDescription[language == $locale][0].value, siteDescription[language == "en"][0].value),
			"alternateName": coalesce(alternateName[language == $locale][0].value, alternateName[language == "en"][0].value),
			"areaServed": coalesce(areaServed[language == $locale][0].value, areaServed[language == "en"][0].value),
			foundingDate,
			"address": {
				"streetAddress": address.streetAddress,
				"addressLocality": coalesce(address.addressLocality[language == $locale][0].value, address.addressLocality[language == "en"][0].value),
				"addressRegion": coalesce(address.addressRegion[language == $locale][0].value, address.addressRegion[language == "en"][0].value),
				"postalCode": address.postalCode,
				"addressCountry": address.addressCountry
			},
			siteLogo,
			shareGraphic,
			"shareVideo": shareVideo.asset->url,
			favicon,
			faviconLight,
			contactEmail,
			socialLinks[]{
				icon,
				url
			}
		},
		"integrations": *[_type == "settingsIntegration"][0]{
			gaIDs,
			gtmIDs
		},
		"consent": *[_type == "settingsConsent"][0]{
			enabled,
			"bannerTitle": coalesce(bannerTitle[language == $locale][0].value, bannerTitle[language == "en"][0].value),
			"bannerBody": coalesce(bannerBody[language == $locale][0].value, bannerBody[language == "en"][0].value),
			"acceptAllLabel": coalesce(acceptAllLabel[language == $locale][0].value, acceptAllLabel[language == "en"][0].value),
			"rejectAllLabel": coalesce(rejectAllLabel[language == $locale][0].value, rejectAllLabel[language == "en"][0].value),
			"preferencesLabel": coalesce(preferencesLabel[language == $locale][0].value, preferencesLabel[language == "en"][0].value),
			"savePreferencesLabel": coalesce(savePreferencesLabel[language == $locale][0].value, savePreferencesLabel[language == "en"][0].value),
			"necessaryTitle": coalesce(necessaryTitle[language == $locale][0].value, necessaryTitle[language == "en"][0].value),
			"necessaryDescription": coalesce(necessaryDescription[language == $locale][0].value, necessaryDescription[language == "en"][0].value),
			"analyticsTitle": coalesce(analyticsTitle[language == $locale][0].value, analyticsTitle[language == "en"][0].value),
			"analyticsDescription": coalesce(analyticsDescription[language == $locale][0].value, analyticsDescription[language == "en"][0].value),
			"marketingTitle": coalesce(marketingTitle[language == $locale][0].value, marketingTitle[language == "en"][0].value),
			"marketingDescription": coalesce(marketingDescription[language == $locale][0].value, marketingDescription[language == "en"][0].value),
			"privacyPolicyLink": privacyPolicyLink{ ${linkFields} },
			"cookiePolicyLink": cookiePolicyLink{ ${linkFields} }
		},
		"cart": ${byLocale('settingsCart')}[0]{
			emptyHeading,
			"recommendedProducts": ${visibleProducts('recommendedProducts')}{
				${productCardFields}
			}
		},
	}
`);

// Server-side config for the product submission API route: owner recipient plus
// confirmation email template. Each field falls back to the English doc
// independently (same convention as productSubmissionEmail in siteDataQuery).
export const productSubmissionConfigQuery = defineQuery(`{
	"recipient": ${byLocale('pProductIndex')}[defined(submissionEmail)][0].submissionEmail,
	"subject": ${byLocale('pProductIndex')}[defined(confirmationEmail.subject)][0].confirmationEmail.subject,
	"heading": ${byLocale('pProductIndex')}[defined(confirmationEmail.heading)][0].confirmationEmail.heading,
	"message": ${byLocale('pProductIndex')}[defined(confirmationEmail.message)][0].confirmationEmail.message,
	"footer": ${byLocale('pProductIndex')}[defined(confirmationEmail.footer)][0].confirmationEmail.footer,
	"logo": ${byLocale('pProductIndex')}[defined(confirmationEmail.logo.asset)][0].confirmationEmail.logo
}`);

export const pageHomeQuery = defineQuery(`
	${byLocale('pHome')}[0]{
		${baseFields},
		${availableLocalesField},
		"isHomepage": true,
		landingTitle,
		"textColor": textColor->color,
		pageModules[]{
			${pageModuleFields}
		}
	}
`);

export const page404Query = defineQuery(`
	${byLocale('p404')}[0]{
		${baseFields},
		heading,
		paragraph[]{
			${portableTextContentFields}
		},
		callToAction{
			label,
			link {
				${linkFields}
			}
		}
	}
`);

export const pageGeneralQuery = defineQuery(`
	*[_type == "pGeneral" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${baseFields},
		${availableLocalesField},
		content[]{
			${portableTextContentFields}
		},
		pageModules[]{
			${pageModuleFields}
		},
		_updatedAt
	}
`);
export const pageGeneralSlugsQuery = defineQuery(`
  *[_type == "pGeneral" && defined(slug.current)]
  {"slug": slug.current}
`);

export const pageContactQuery = defineQuery(`
	${byLocale('pContact')}[0]{
		${baseFields},
		${availableLocalesField},
		description,
		contactForm {
			formTitle[]{
				${portableTextContentFields}
			},
			formFields[] {
				${formField}
			},
			successMessage,
			errorMessage,
			sendToEmail,
			emailSubject
		},
		legalConsent[]{
			${portableTextContentFields}
		}
	}
`);

export const pageFaqQuery = defineQuery(`
	${byLocale('pFaq')}[0]{
		${baseFields},
		${availableLocalesField},
		intro,
		"items": *[_type == "gFaq" && language == $locale] | order(order asc){
			${gFaqItemFields}
		}
	}
`);

export const pageSizeGuideQuery = defineQuery(`
	${byLocale('pSizeGuide')}[0]{
		${baseFields},
		${availableLocalesField},
		intro,
		footnote,
		sections[]{
			_key,
			title,
			"charts": charts[]{
				_key,
				label,
				"chart": chart->{
					${gSizeChartFields}
				}
			}
		}
	}
`);

export const pageNewsletterQuery = defineQuery(`
	${byLocale('pNewsletter')}[0]{
		${baseFields},
		${availableLocalesField},
		"newsletter": ${byLocale('gNewsletter')}[0]{
			${newsletterFormFields}
		}
	}
`);

// Status badges, shared by the listing and the detail page — both render the
// same pill with the same link.
const eventStatusListFields = `
	statusList[]{
		_key,
		link {
			${linkFields}
		},
		eventStatus-> {
			_id,
			"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
			"slug": slug.current,
			statusTextColor->{...color},
			statusBgColor->{...color}
		}
	}
`;

// Event listing. One document per event now, so the old two-arm union (current
// locale, plus English/undefined whose slug had no current-locale sibling) is
// gone: there is nothing to deduplicate, and `titleVisible` alone decides
// whether an event appears in this locale.
//
// `categories` is deliberately NOT projected: nothing on the listing renders it,
// and it costs a reference deref plus a colour-document deref per event.
const eventCardFields = `
	_id,
	_type,
	"title": ${locString('title')},
	"slug": slug.current,
	"subtitle": ${locString('subtitle')},
	eventDatetime,
	endDatetime,
	dateStatus,
	"location": ${locString('location')},
	locationLink,
	locationRef->{
		"name": coalesce(name[language == $locale][0].value, name[language == "en"][0].value),
		mapLink,
	},
	${eventStatusListFields}
`;

export const pEventsQuery = defineQuery(`
	*[_type == "pEvents"][0]{
		_id,
		_type,
		"title": ${locString('title')},
		"slug": slug.current,
		${i18nSharingFields('noFallback', 'noFallback')},
		"availableLocales": ${ALL_LOCALES_GROQ},
		"eventList": *[_type == "pEvent" && eventDatetime.utc >= $cutoff && ${titleVisible}]{
			${eventCardFields}
		} | order(eventDatetime.utc asc),
	}
`);

// /events-crew renders outside the [locale] segment, so these queries have no
// $locale to resolve against. They pick zh_tw first, falling back to English —
// the crew is Taiwan-based and the roster is written in Chinese. `locationRef`
// already did this; the rest joined it when the event family became field-level.
const crewString = (field: string) =>
	`coalesce(${field}[language == "zh_tw"][0].value, ${field}[language == "en"][0].value)`;

export const eventCrewMonthsQuery = defineQuery(`
	*[_type == "pEvent" && defined(teamAssignments) && defined(eventDatetime.utc)] | order(eventDatetime.utc asc) {
		eventDatetime
	}
`);

export const eventCrewMembersQuery = defineQuery(`
	*[_type == "gTeamMember" && _id in
		*[_type == "pEvent" && defined(teamAssignments)
			&& eventDatetime.utc >= $startDate && eventDatetime.utc < $endDate
		].teamAssignments[].members[]._ref
	] | order(coalesce(nickname, name) asc) {
		_id,
		name,
		nickname,
		"slug": slug.current,
		avatar
	}
`);

export const eventCrewByMonthQuery = defineQuery(`
	*[_type == "pEvent" && defined(teamAssignments)
		&& eventDatetime.utc >= $startDate && eventDatetime.utc < $endDate
		&& ($memberSlug == "" || $memberSlug in teamAssignments[].members[]->slug.current)
	] | order(eventDatetime.utc asc) {
		_id,
		"title": ${crewString('title')},
		"sharing":{},
		"subtitle": ${crewString('subtitle')},
		eventDatetime,
		endDatetime,
		dateStatus,
		"location": ${crewString('location')},
		locationLink,
		locationRef->{
			"name": ${crewString('name')},
			mapLink
		},
		"teamNotes": ${crewString('teamNotes')},
		categories[]-> {
			_id,
			"title": ${crewString('title')},
			"slug": slug.current,
			categoryColor->{...color}
		},
		teamAssignments[] {
			_key,
			group,
			"note": ${crewString('note')},
			role-> {
				_id,
				title,
				order
			},
			members[]-> {
				_id,
				name,
				nickname,
				"slug": slug.current,
				avatar
			}
		}
	}
`);

// Inside nested projections the document's transition discriminator is
// reached through ^ (one hop per scope): ^.language from a direct object or
// array item, ^.^.language from a list item inside one.
const productMetadataFields = `
	metadata[]{
		_key,
		"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value, select(defined(^.language) => title)),
		contentType,
		contentType == "richText" => {
			"richText": coalesce(richText[language == $locale][0].value, richText[language == "en"][0].value, select(defined(^.language) => richText))[]{ ${portableTextContentFields} }
		},
		contentType == "list" => {
			"list": list[]{
				_key,
				_type,
				_type == "reference" => {
					"tag": @->{
						_id,
						"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
						"slug": slug.current
					}
				},
				_type == "textItem" => {
					"text": coalesce(text[language == $locale][0].value, text[language == "en"][0].value, select(defined(^.^.language) => text))
				}
			}
		}
	}
`;

const productStaticSectionFields = `
	"whyUseIt": ${locPT('whyUseIt')}[]{ ${portableTextContentFields} },
	"whoIsItFor": ${locPT('whoIsItFor')}[]{ ${portableTextContentFields} },
	whenReachForIt{
		contentType,
		contentType == "richText" => {
			"richText": coalesce(richText[language == $locale][0].value, richText[language == "en"][0].value, select(defined(^.language) => richText))[]{ ${portableTextContentFields} }
		},
		contentType == "list" => {
			"list": list[]{
				_key,
				_type,
				_type == "reference" => {
					"tag": @->{
						_id,
						"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
						"slug": slug.current
					}
				},
				_type == "textItem" => {
					"text": coalesce(text[language == $locale][0].value, text[language == "en"][0].value, select(defined(^.^.language) => text))
				}
			}
		}
	}
`;

const productBaseFields = `
	${productCardFields},
	${i18nSharingFields('mainImage.image', 'excerpt')},
	soldOut,
	"content": ${locPT('content')}[]{
		${portableTextContentFields}
	},
	${productStaticSectionFields},
	${productMetadataFields}
`;

const productCategoriesFields = `
	"categories": *[_type == "pProductCategory"] | order(coalesce(title[language == $locale][0].value, title[language == "en"][0].value) asc) {
		_id,
		"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
		"slug": slug.current,
		coverImage {
			${imageBlockMetaFields}
		},
		"count": count(*[_type == "pProduct" && references(^._id) && ${titleVisible}])
	}
`;

// Card counts are deliberately small; the index is a shop window, not the
// catalogue. `allProductsList` is 8 (not 24) because both the "All Products"
// link and the "More Products" button below that grid go to the paginated
// /products/all, and each collection strip is 4 — exactly one row of the widest
// grid (2xl:grid-cols-4) — with the collection's own page holding the full set.
// At 24 + 8-per-strip the index shipped 58 cards / 58 <img> / 1,429 DOM nodes in
// a 532KB document 34,497px tall on mobile, which is what put Speed Index at
// 20.9s. Keep the rationale out here: anything inside the template literal is
// query payload sent to Sanity on every request and is baked into the generated
// types.
export const pageProductIndexQuery = defineQuery(`
	${byLocale('pProductIndex')}[0]{
		${baseFields},
		${availableLocalesField},
		"slug": "products",
		subtitle,
		description,
		allProducts{
			title,
			description
		},
		"allProductsList": *[_type == "pProduct" && ${titleVisible}]
			| order(_createdAt desc)[0...8]{
			${productCardFields}
		},
		"collections": collections[]->{
			_id,
			"title": ${locString('title')},
			"description": ${locString('description')},
			"slug": slug.current,
			coverImage {
				${imageBlockMetaFields}
			},
			"products": ${visibleProducts('products')}[0...4]{
				${productCardFields}
			}
		},
		categories[]->{_id,
			"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
			"slug": slug.current,
			coverImage {
				${imageBlockMetaFields}
			},
			"count": count(*[_type == "pProduct" && references(^._id) && ${titleVisible}])
		}
	}
`);

export const pageProductSlugsQuery = defineQuery(`
	*[_type == "pProduct" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageProductSingleQuery = defineQuery(`
	*[_type == "pProduct" && slug.current == $slug && ${titleVisible}][0]{
		${productBaseFields},
		${productAvailableLocalesField},
		"sizeChart": sizeChart->{
			${gSizeChartFields}
		},
		"relatedProducts": ${visibleProducts('relatedProducts')}{
			${productCardFields}
		},
		"defaultRelatedProducts": *[_type == "pProduct"
			&& count(categories[@._ref in ^.^.categories[]._ref]) > 0
			&& _id != ^._id
			&& ${titleVisible}
		] | order(_createdAt desc) [0...3] {
			${productCardFields}
		}
	}
`);

// Shopify handle → Sanity slug, for the cart drawer's line-item links. Shopify
// knows only its own handle; product routes are keyed on the Sanity slug, and
// the two are deliberately independent. Resolved per cart response rather than
// captured when the line is added, because an editor can rename a slug at any
// time and a stored copy would then point at a 404.
//
// `productTitleVisible` is not optional here: pageProductSingleQuery carries it,
// so a product untranslated in $locale 404s on that locale's route. Without the
// same guard a zh-only line added on the zh_tw route would render a link into
// that 404 once the shopper switched to English — the leak described above the
// fragment. A line whose product is invisible in this locale simply resolves to
// no slug, and the drawer renders its thumbnail unlinked.
export const productSlugsByShopifyHandleQuery = defineQuery(`
	*[_type == "pProduct"
		&& defined(slug.current)
		&& shopify.handle in $handles
		&& ${titleVisible}
	]{
		"handle": shopify.handle,
		"slug": slug.current
	}
`);

// Server-side config for the back-in-stock notify API route: the single global
// Klaviyo list all "notify when back in stock" signups subscribe to. Product
// identity is carried per signup as Klaviyo event properties, not stored here.
export const backInStockConfigQuery = defineQuery(`
	*[_type == "settingsIntegration"][0]{ "listId": klaviyoBackInStockListId }
`);

// Server-side list resolution for /api/newsletter/subscribe — same reasoning as
// backInStockConfigQuery: the client never chooses the Klaviyo list. gNewsletter
// is document-localized, so the list is resolved per locale (English fallback).
export const newsletterConfigQuery = defineQuery(`
	${byLocale('gNewsletter')}[defined(klaviyoListID)][0]{ "listId": klaviyoListID }
`);

export const pageProductCollectionSlugsQuery = defineQuery(`
	*[_type == "pProductCollection" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageProductCollectionSingleQuery = defineQuery(`
	*[_type == "pProductCollection" && slug.current == $slug && ${titleVisible}][0]{
		_id,
		_type,
		"title": ${locString('title')},
		"slug": slug.current,
		${i18nSharingFields('coverImage.image', 'description')},
		${productAvailableLocalesField},
		"description": ${locString('description')},
		"products": ${visibleProducts('products')}{
			${productCardFields}
		},
		${productCategoriesFields}
	}
`);

export const pageProductCategoriesIndexQuery = defineQuery(`
	{
		"productCount": count(*[_type == "pProduct" && ${titleVisible}]),
		${productCategoriesFields},
		"sharing": {
			"shareGraphic": *[_type == "settingsGeneral"][0].shareGraphic,
			"siteTitle": coalesce(
				*[_type == "settingsGeneral"][0].siteTitle[language == $locale][0].value,
				*[_type == "settingsGeneral"][0].siteTitle[language == "en"][0].value
			)
		}
	}
`);

export const pageProductCategorySlugsQuery = defineQuery(`
	*[_type == "pProductCategory" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageProductCategorySingleQuery = defineQuery(`
	*[_type == "pProductCategory" && slug.current == $slug][0]{
		_id,
		_type,
		"slug": slug.current,
		"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
		"sharing": {
			"disableIndex": disableIndex,
			"metaTitle": coalesce(seoTitle[language == $locale][0].value, seoTitle[language == "en"][0].value),
			"metaDesc": coalesce(
				seoDescription[language == $locale][0].value,
				seoDescription[language == "en"][0].value,
				description[language == $locale][0].value,
				description[language == "en"][0].value
			),
			"shareGraphic": coalesce(
				shareGraphic,
				coverImage.image,
				*[_type == "settingsGeneral"][0].shareGraphic
			),
			"siteTitle": coalesce(
				*[_type == "settingsGeneral"][0].siteTitle[language == $locale][0].value,
				*[_type == "settingsGeneral"][0].siteTitle[language == "en"][0].value
			)
		},
		coverImage {
			${imageBlockMetaFields}
		},
		"products": *[_type == "pProduct" && references(^._id) && ${titleVisible}] | order(${productTitleOrder} asc) {
			${productCardFields}
		}
	}
`);

export const pageProductCollectionsIndexQuery = defineQuery(`
	{
		"collections": *[_type == "pProductCollection" && ${titleVisible}] | order(${productTitleOrder} asc) {
			_id,
			"title": ${locString('title')},
			"description": ${locString('description')},
			"slug": slug.current,
			coverImage {
				${imageBlockMetaFields}
			},
			"count": count(products)
		}
	}
`);

export const pageProductsAllQuery = defineQuery(`
	{
		"products": *[_type == "pProduct" && ${titleVisible}] | order(${productTitleOrder} asc) [$start...$end] {
			${productCardFields}
		},
		"total": count(*[_type == "pProduct" && ${titleVisible}]),
		${productCategoriesFields}
	}
`);

export const pageEventSlugsQuery = defineQuery(`
	*[_type == "pEvent" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageEventSingleQuery = defineQuery(`
	*[_type == "pEvent" && slug.current == $slug && ${titleVisible}][0]{
		_id,
		_type,
		"title": ${locString('title')},
		"slug": slug.current,
		${i18nSharingFields('heroImage.image', 'excerpt')},
		"availableLocales": ${localesWithValue('title')},
		format,
		"subtitle": ${locString('subtitle')},
		"excerpt": ${locString('excerpt')},
		eventDatetime,
		endDatetime,
		dateStatus,
		eventType,
		distanceKm,
		isFree,
		"location": ${locString('location')},
		locationLink,
		locationRef->{
			"name": coalesce(name[language == $locale][0].value, name[language == "en"][0].value),
			mapLink,
			address,
			geo
		},
		heroImage{${imageBlockMetaFields}},
		highlights[]{
			"label": ${locString('label')},
			"value": ${locString('value')}
		},
		startEndLocation{
			"name": ${locString('name')},
			link
		},
		categories[]->{
			_id,
			"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
			"slug": slug.current
		},
		${eventStatusListFields},
		stations[]{
			"name": ${locString('name')},
			"distance": ${locString('distance')},
			"locationName": ${locString('locationName')},
			locationLink,
			"questTitle": ${locString('questTitle')},
			"questInstructions": ${locString('questInstructions')},
			questExampleImage{${imageBlockMetaFields}},
			"directionsIn": ${locString('directionsIn')},
			"directionsOut": ${locString('directionsOut')}
		},
		"content": ${locPT('content')}[]{
			${portableTextContentFields}
		}
	}
`);
