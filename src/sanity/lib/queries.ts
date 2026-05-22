import { defineQuery } from 'next-sanity';
import { resolvedHrefGroq } from '@/lib/routes';
export const homeID = defineQuery(`*[_type == "pHome"][0]._id`);

export const SITEMAP_PAGES_QUERY = defineQuery(`
	*[_type in ["pHome", "pGeneral", "pContact"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)] {
		_type,
		"slug": slug.current,
		_updatedAt
	}
`);

export const SITEMAP_EVENTS_QUERY = defineQuery(`
	*[_type in ["pEvents", "pEvent"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)] {
		_type,
		"slug": slug.current,
		_updatedAt
	}
`);

export const SITEMAP_CURATED_QUERY = defineQuery(`
	*[_type in ["pCuratedIndex", "pCurated", "pCuratedCategory", "pCuratedCollection"]
		&& (!defined(sharing.disableIndex) || sharing.disableIndex == false)] {
		_type,
		"slug": slug.current,
		_updatedAt
	}
`);

const baseFields = `
	_id,
	_type,
	title,
	"slug": slug.current,
	"sharing":{
		...sharing,
		"siteTitle": *[_type == "settingsGeneral"][0].siteTitle,
	}
`;

const linkFields = `
	_type,
	linkType,
	"href": ${resolvedHrefGroq},
	"label": coalesce(label[_key == $locale][0].value, label[_key == "en"][0].value),
	isNewTab
`;

const menuFields = `
	_id,
	_type,
	title,
	items[]{
		"title": select(
			_type == "navDropdown" => coalesce(
				title[_key == $locale][0].value,
				title[_key == "en"][0].value
			),
			coalesce(
				title[_key == $locale][0].value,
				title[_key == "en"][0].value,
				link.label[_key == $locale][0].value,
				link.label[_key == "en"][0].value,
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
				title[_key == $locale][0].value,
				title[_key == "en"][0].value,
				link.label[_key == $locale][0].value,
				link.label[_key == "en"][0].value,
				link.internalLink->title,
				link.href
			),
			link {
				${linkFields}
			}
		}
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
	"label": coalesce(label[_key == $locale][0].value, label[_key == "en"][0].value),
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

const pageModuleFields = `
	_type == 'freeform' => {
		${freeformField}
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
			menu->{
				${menuFields}
			},
			"menuLegal": menuLegal->{
				${menuFields}
			},
			"toolbarMenu": toolbarMenu->{
				${menuFields}
			},
			note,
		},
		"newsletter": *[_type == "gNewsletter"][0]{
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
		},
		"sharing": *[_type == "settingsGeneral"][0]{
			siteTitle,
			siteDescription,
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
	}
`);

export const pageHomeQuery = defineQuery(`
	${byLocale('pHome')}[0]{
		${baseFields},
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
			${callToActionFields}
		}
	}
`);

export const pageGeneralQuery = defineQuery(`
	*[_type == "pGeneral" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${baseFields},
		content[]{
			${portableTextContentFields}
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

export const pEventsQuery = defineQuery(`
	${byLocale('pEvents')}[0]{
		${baseFields},
		"eventList": *[_type == "pEvent"] | order(eventDatetime asc) {
			${baseFields},
			subtitle,
			eventDatetime,
			dateStatus,
			location,
			locationLink,
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
					title,
					"slug": slug.current,
					statusTextColor->{...color},
					statusBgColor->{...color}
				}
			}
		},
	}
`);

export const eventCrewMonthsQuery = defineQuery(`
	*[_type == "pEvent" && defined(teamAssignments) && defined(eventDatetime)] | order(eventDatetime asc) {
		eventDatetime
	}
`);

export const eventCrewMembersQuery = defineQuery(`
	*[_type == "gTeamMember" && _id in
		*[_type == "pEvent" && defined(teamAssignments)
			&& eventDatetime >= $startDate && eventDatetime < $endDate
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
		&& eventDatetime >= $startDate && eventDatetime < $endDate
		&& ($memberSlug == "" || $memberSlug in teamAssignments[].members[]->slug.current)
	] | order(eventDatetime asc) {
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

const curatedProductCardFields = `
	${baseFields},
	excerpt,
	badge,
	price,
	purchaseLink,
	categories[]->{ _id, title, "slug": slug.current },
	brands[]->{ _id, title, "slug": slug.current },
	mainImage {
		${imageBlockMetaFields}
	}
`;

const curatedProductBaseFields = `
	${curatedProductCardFields},
	content[]{
		${portableTextContentFields}
	}
`;

const curatedCategoriesFields = `
	"categories": *[_type == "pCuratedCategory"] | order(title asc) {
		_id,
		title,
		"slug": slug.current,
		coverImage {
			${imageBlockMetaFields}
		},
		"count": count(*[_type == "pCurated" && references(^._id)])
	}
`;

export const pageCuratedIndexQuery = defineQuery(`
	${byLocale('pCuratedIndex')}[0]{
		${baseFields},
		"slug": "curated",
		subtitle,
		description,
		"collections": collections[]->{
			_id,
			title,
			description,
			"slug": slug.current,
			"products": products[0...6]->{
				${curatedProductCardFields}
			}
		},
		categories[]->{_id,
			title,
			"slug": slug.current,
			coverImage {
				${imageBlockMetaFields}
			},
			"count": count(*[_type == "pCurated" && references(^._id)])
		}
	}
`);

export const pageCuratedSlugsQuery = defineQuery(`
	*[_type == "pCurated" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageCuratedSingleQuery = defineQuery(`
	*[_type == "pCurated" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${curatedProductBaseFields},
		"relatedProducts": relatedProducts[]->{
			${curatedProductCardFields}
		},
		"defaultRelatedProducts": *[_type == "pCurated"
			&& count(categories[@._ref in ^.^.categories[]._ref]) > 0
			&& _id != ^._id
		] | order(_createdAt desc) [0...3] {
			${curatedProductCardFields}
		},
		${curatedCategoriesFields}
	}
`);

export const pageCuratedCollectionSlugsQuery = defineQuery(`
	*[_type == "pCuratedCollection" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageCuratedCollectionSingleQuery = defineQuery(`
	*[_type == "pCuratedCollection" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${baseFields},
		description,
		"products": products[]->{
			${curatedProductCardFields}
		},
		${curatedCategoriesFields}
	}
`);

export const pageCuratedCategoriesIndexQuery = defineQuery(`
	{
		${curatedCategoriesFields}
	}
`);

export const pageCuratedCategorySlugsQuery = defineQuery(`
	*[_type == "pCuratedCategory" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageCuratedCategorySingleQuery = defineQuery(`
	*[_type == "pCuratedCategory" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${baseFields},
		coverImage {
			${imageBlockMetaFields}
		},
		"products": *[_type == "pCurated" && references(^._id)] | order(title asc) {
			${curatedProductCardFields}
		}
	}
`);

export const pageCuratedCollectionsIndexQuery = defineQuery(`
	{
		"collections": *[_type == "pCuratedCollection"] | order(title asc) {
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

export const pageCuratedProductsIndexQuery = defineQuery(`
	{
		"products": *[_type == "pCurated"] | order(title asc) {
			${curatedProductCardFields}
		},
		${curatedCategoriesFields}
	}
`);

export const pageEventSlugsQuery = defineQuery(`
	*[_type == "pEvent" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageEventSingleQuery = defineQuery(`
	*[_type == "pEvent" && slug.current == $slug && (language == $locale || language == "en" || !defined(language))] | order(select(language == $locale => 0, language == "en" => 1, 2) asc)[0]{
		${baseFields},
		format,
		subtitle,
		eventDatetime,
		dateStatus,
		location,
		locationLink,
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
				title,
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
