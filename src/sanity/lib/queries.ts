import { defineQuery } from 'next-sanity';
import { resolvedHrefGroq } from '@/lib/routes';
export const homeID = defineQuery(`*[_type == "pHome"][0]._id`);

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
	"linkType": linkInput.linkType,
	"href": linkInput {
		${resolvedHrefGroq}
	}.resolvedHref,
	"isNewTab": select(
		linkInput.linkType == "external" => true,
		isNewTab
	)
`;

const menuFields = `
	_id,
	_type,
	title,
	items[]{
		title,
		link {
			${linkFields}
		},
		dropdownItems[]{
			_key,
			title,
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
	label,
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

export const siteDataQuery = defineQuery(`{
		"announcement": *[_type == "gAnnouncement"][0]{
			display,
			messages,
			autoplay,
			autoplayInterval,
			backgroundColor,
			textColor,
			emphasizeColor,
			"link": ${linkFields}
		},
		"header": *[_type == "gHeader"][0]{
			menu->{
				${menuFields}
			}
		},
		"footer": *[_type == "gFooter"][0]{
			menu->{
				${menuFields}
			},
			"menuLegal": menuLegal->{
				${menuFields}
			},
			"toolbarMenu": toolbarMenu->{
				${menuFields}
			},
			note
		},
		"sharing": *[_type == "settingsGeneral"][0]{
			siteTitle,
			shareGraphic,
			"shareVideo": shareVideo.asset->url,
			favicon,
			faviconLight
		},
		"integrations": *[_type == "settingsIntegration"][0]{
			gaIDs,
			gtmIDs
		},
	}
`);

export const pageHomeQuery = defineQuery(`
	*[_type == "pHome"][0]{
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
	*[_type == "p404" && _id == "p404"][0]{
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
	*[_type == "pGeneral" && slug.current == $slug][0]{
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
	*[_type == "pContact"][0]{
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
	*[_type == "pEvents"][0]{
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

export const eventCrewQuery = defineQuery(`
	*[_type == "pEvent" && defined(teamAssignments)] | order(eventDatetime asc) {
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
	*[_type == "pBlogIndex"][0]{
		${blogIndexBaseQuery}
	}
`);

export const pageBlogIndexWithArticleDataSSGQuery = defineQuery(`
	*[_type == "pBlogIndex"][0]{
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
	*[_type == "pBlog" && slug.current == $slug][0]{
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
	*[_type == "pCuratedIndex"][0]{
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
		${curatedCategoriesFields}
	}
`);

export const pageCuratedSlugsQuery = defineQuery(`
	*[_type == "pCurated" && defined(slug.current)]
	{"slug": slug.current}
`);

export const pageCuratedSingleQuery = defineQuery(`
	*[_type == "pCurated" && slug.current == $slug][0]{
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
	*[_type == "pCuratedCollection" && slug.current == $slug][0]{
		${baseFields},
		description,
		"products": products[]->{
			${curatedProductCardFields}
		},
		${curatedCategoriesFields}
	}
`);
