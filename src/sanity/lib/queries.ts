import { defineQuery } from 'next-sanity';
import { resolvedHrefGroq } from '@/lib/routes';
export const homeID = defineQuery(`*[_type == "pHome"][0]._id`);

export const SITEMAP_PAGES_QUERY = defineQuery(`
	*[_type in ["pHome", "pGeneral", "pContact", "pFaq"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)] {
		_type,
		"slug": slug.current,
		_updatedAt,
		language
	}
`);

export const SITEMAP_EVENTS_QUERY = defineQuery(`
	*[_type in ["pEvents", "pEvent"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)] {
		_type,
		"slug": slug.current,
		_updatedAt,
		language
	}
`);

export const SITEMAP_PRODUCTS_QUERY = defineQuery(`
	*[_type in ["pProductIndex", "pProduct", "pProductCategory", "pProductCollection"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)] {
		_type,
		"slug": slug.current,
		_updatedAt,
		language
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
    mimeType
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

// Helper GROQ filter clause for locale-aware *listings*: include a doc if it's in
// the current locale, OR it's the English/undefined fallback AND no current-locale
// version with the same slug exists. Translated product docs share their slug, so
// this deduplicates a list to one entry per product/collection (locale preferred,
// English fallback) — the list equivalent of byLocale's single-doc resolution.
const productLocaleFilter = (type: string) =>
	`(language == $locale || ((language == "en" || !defined(language)) && !(slug.current in *[_type == "${type}" && language == $locale].slug.current)))`;

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
	klaviyoListID,
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
			gtmIDs,
			klaviyoCompanyId
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
			emailSubject,
			formFailureNotificationEmail
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

export const pageNewsletterQuery = defineQuery(`
	${byLocale('pNewsletter')}[0]{
		${baseFields},
		${availableLocalesField},
		"newsletter": ${byLocale('gNewsletter')}[0]{
			${newsletterFormFields}
		}
	}
`);

export const pEventsQuery = defineQuery(`
	${byLocale('pEvents')}[0]{
		${baseFields},
		${availableLocalesField},
		"eventList": (
			*[_type == "pEvent" && language == $locale && eventDatetime.utc >= $cutoff]{
				${baseFields},
				subtitle,
				eventDatetime,
				dateStatus,
				location,
				locationLink,
				locationRef->{
					"name": coalesce(name[language == $locale][0].value, name[language == "en"][0].value),
					mapLink,
				},
				categories[]-> {
					_id,
					title,
					"slug": slug.current,
					categoryColor->{...color}
				},
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
			}
			+ *[
				_type == "pEvent"
				&& (language == "en" || !defined(language))
				&& eventDatetime.utc >= $cutoff
				&& !(slug.current in *[_type == "pEvent" && language == $locale && eventDatetime.utc >= $cutoff].slug.current)
			]{
				${baseFields},
				subtitle,
				eventDatetime,
				dateStatus,
				location,
				locationLink,
				locationRef->{
					"name": coalesce(name[language == $locale][0].value, name[language == "en"][0].value),
					mapLink,
				},
				categories[]-> {
					_id,
					title,
					"slug": slug.current,
					categoryColor->{...color}
				},
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
			}
		) | order(eventDatetime.utc asc),
	}
`);

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
		title,
		"sharing":{},
		subtitle,
		eventDatetime,
		dateStatus,
		location,
		locationLink,
		teamNotes,
		categories[]-> {
			_id,
			title,
			"slug": slug.current,
			categoryColor->{...color}
		},
		teamAssignments[] {
			_key,
			group,
			note,
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

const blogPostBaseFields = `
	${baseFields},
	author->{name},
	categories[]-> {
		_id,
		title,
		"slug": slug.current,
		categoryColor->{...color}
	}
`;

export const blogPostCardFields = `${blogPostBaseFields}, excerpt`;

export const blogPostFullFields = `
	${blogPostBaseFields},
	content[]{
		${portableTextContentFields}
	},
	"relatedBlogs": relatedBlogs[]->{
		${blogPostCardFields}
	}
`;

export const articleListAllQuery = `
	"articleList": *[_type == "pBlog"] | order(_updatedAt desc) [0...12] {
		${blogPostCardFields}
	}
`;

const blogIndexBaseQuery = `
	${baseFields},
	"slug": "blog",
	itemsPerPage,
	paginationMethod,
	loadMoreButtonLabel,
	infiniteScrollCompleteLabel,
	"itemsTotalCount": count(*[_type == "pBlog"])
`;

export const pageBlogIndexQuery = defineQuery(`
	${byLocale('pBlogIndex')}[0]{
		${blogIndexBaseQuery}
	}
`);

export const pageBlogIndexWithArticleDataSSGQuery = defineQuery(`
	${byLocale('pBlogIndex')}[0]{
		${blogIndexBaseQuery},
		${articleListAllQuery}
	}
`);

export const pageBlogPaginationMethodQuery = defineQuery(`
	{
		"articleTotalNumber": count(*[_type == "pBlog"]),
		"itemsPerPage": *[_type == "pBlogIndex"][0].itemsPerPage
	}`);

export const pageBlogSlugsQuery = defineQuery(`
  *[_type == "pBlog" && defined(slug.current)]
  {"slug": slug.current}
`);

export const pageBlogSingleQuery = defineQuery(`
	*[_type == "pBlog" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${blogPostFullFields},
		"defaultRelatedBlogs": *[_type == "pBlog"
			&& count(categories[@._ref in ^.^.categories[]._ref ]) > 0
			&& _id != ^._id
		] | order(publishedAt desc, _createdAt desc) [0...2] {
			${blogPostCardFields}
		}
	}
`);

const productCardFields = `
	${baseFields},
	excerpt,
	badge,
	price,
	purchaseLink,
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

const productMetadataFields = `
	metadata[]{
		_key,
		title,
		contentType,
		contentType == "richText" => {
			"richText": richText[]{ ${portableTextContentFields} }
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
				_type == "textItem" => { text }
			}
		}
	}
`;

const productStaticSectionFields = `
	whyUseIt[]{ ${portableTextContentFields} },
	whoIsItFor[]{ ${portableTextContentFields} },
	whenReachForIt{
		contentType,
		contentType == "richText" => {
			"richText": richText[]{ ${portableTextContentFields} }
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
				_type == "textItem" => { text }
			}
		}
	}
`;

const productBaseFields = `
	${productCardFields},
	content[]{
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
		"count": count(*[_type == "pProduct" && references(^._id) && ${productLocaleFilter('pProduct')}])
	}
`;

// Shared filter clause for the product listings. Each dimension is a no-op when
// its param array is empty (count == 0), so an unfiltered request returns the
// full catalogue. Categories/brands match on slug; badges match on value.
const productFilterClause = `
	&& (count($categories) == 0 || count(categories[@->slug.current in $categories]) > 0)
	&& (count($brands) == 0 || count(brands[@->slug.current in $brands]) > 0)
	&& (count($badges) == 0 || count(badge[@ in $badges]) > 0)
`;

// Shared sort clause driven by the $sort param. Each select() is null (a no-op)
// unless its key is active; the final `title asc` is the default tiebreaker.
const productSortOrder = `order(
	select($sort == "newest" => _createdAt) desc,
	select($sort == "oldest" => _createdAt) asc,
	select($sort == "za" => title) desc,
	title asc
)`;

// Facet data for the filter UI, shared by every page that renders <ProductFilters>.
// Aliased to value/label/count so the result drops straight into FacetOption[].
// Counts are catalogue-wide (not re-scoped to other active filters).
const productFilterFacets = `
	"facetCategories": *[_type == "pProductCategory"] | order(coalesce(title[language == $locale][0].value, title[language == "en"][0].value) asc) {
		"value": slug.current,
		"label": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
		"count": count(*[_type == "pProduct" && references(^._id) && ${productLocaleFilter('pProduct')}])
	},
	"facetBrands": *[_type == "pBrand"] | order(title asc) {
		"value": slug.current,
		"label": title,
		"count": count(*[_type == "pProduct" && references(^._id) && ${productLocaleFilter('pProduct')}])
	},
	"badgeCounts": {
		"founders-pick": count(*[_type == "pProduct" && "founders-pick" in badge && ${productLocaleFilter('pProduct')}]),
		"most-popular": count(*[_type == "pProduct" && "most-popular" in badge && ${productLocaleFilter('pProduct')}]),
		"editors-choice": count(*[_type == "pProduct" && "editors-choice" in badge && ${productLocaleFilter('pProduct')}]),
		"new": count(*[_type == "pProduct" && "new" in badge && ${productLocaleFilter('pProduct')}])
	}
`;

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
		"allProductsList": *[_type == "pProduct" && ${productLocaleFilter('pProduct')}${productFilterClause}]
			| ${productSortOrder} [0...24]{
			${productCardFields}
		},
		"allProductsTotal": count(*[_type == "pProduct" && ${productLocaleFilter('pProduct')}${productFilterClause}]),
		${productFilterFacets},
		"collections": collections[]->{
			"loc": *[_type == "pProductCollection"
				&& slug.current == ^.slug.current
				&& (language == $locale || language == "en" || !defined(language))
			] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
				_id,
				title,
				description,
				"slug": slug.current,
				coverImage {
					${imageBlockMetaFields}
				},
				"products": products[0...8]->{
					${productCardFields}
				}
			}
		}.loc,
		categories[]->{_id,
			"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
			"slug": slug.current,
			coverImage {
				${imageBlockMetaFields}
			},
			"count": count(*[_type == "pProduct" && references(^._id) && ${productLocaleFilter('pProduct')}])
		}
	}
`);

export const pageProductSlugsQuery = defineQuery(`
	*[_type == "pProduct" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageProductSingleQuery = defineQuery(`
	*[_type == "pProduct" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${productBaseFields},
		${availableLocalesField},
		"relatedProducts": relatedProducts[]->{
			${productCardFields}
		},
		"defaultRelatedProducts": *[_type == "pProduct"
			&& count(categories[@._ref in ^.^.categories[]._ref]) > 0
			&& _id != ^._id
			&& ${productLocaleFilter('pProduct')}
		] | order(_createdAt desc) [0...3] {
			${productCardFields}
		}
	}
`);

export const pageProductCollectionSlugsQuery = defineQuery(`
	*[_type == "pProductCollection" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageProductCollectionSingleQuery = defineQuery(`
	*[_type == "pProductCollection" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${baseFields},
		${availableLocalesField},
		description,
		"products": products[]->{
			${productCardFields}
		},
		${productCategoriesFields}
	}
`);

export const pageProductCategoriesIndexQuery = defineQuery(`
	{
		"productCount": count(*[_type == "pProduct" && ${productLocaleFilter('pProduct')}]),
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
		"products": *[_type == "pProduct" && references(^._id) && ${productLocaleFilter('pProduct')}] | order(title asc) {
			${productCardFields}
		}
	}
`);

export const pageProductCollectionsIndexQuery = defineQuery(`
	{
		"collections": *[_type == "pProductCollection" && ${productLocaleFilter('pProductCollection')}] | order(title asc) {
			_id,
			title,
			description,
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
		"products": *[_type == "pProduct" && ${productLocaleFilter('pProduct')}${productFilterClause}]
			| ${productSortOrder} [$start...$end] {
			${productCardFields}
		},
		"total": count(*[_type == "pProduct" && ${productLocaleFilter('pProduct')}${productFilterClause}]),
		${productCategoriesFields},
		${productFilterFacets}
	}
`);

export const pageEventSlugsQuery = defineQuery(`
	*[_type == "pEvent" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageEventSingleQuery = defineQuery(`
	*[_type == "pEvent" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${baseFields},
		${availableLocalesField},
		format,
		subtitle,
		excerpt,
		eventDatetime,
		endDatetime,
		dateStatus,
		eventType,
		distanceKm,
		isFree,
		location,
		locationLink,
		locationRef->{
			"name": coalesce(name[language == $locale][0].value, name[language == "en"][0].value),
			mapLink,
			address,
			geo
		},
		heroImage{${imageBlockMetaFields}},
		highlights[]{label, value},
		startEndLocation,
		categories[]->{ _id, title, "slug": slug.current },
		statusList[]{
			_key,
			link {
				${linkFields}
			},
			eventStatus->{
				_id,
				"title": coalesce(title[language == $locale][0].value, title[language == "en"][0].value),
				statusTextColor->{...color},
				statusBgColor->{...color}
			}
		},
		stations[]{
			name,
			distance,
			locationName,
			locationLink,
			questTitle,
			questInstructions,
			questExampleImage{${imageBlockMetaFields}},
			directionsIn,
			directionsOut
		},
		content[]{
			${portableTextContentFields}
		}
	}
`);
