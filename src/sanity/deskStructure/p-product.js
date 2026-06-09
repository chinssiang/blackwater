import { apiVersion } from '@/sanity/env';
import { StarIcon, TagsIcon, StackIcon } from '@sanity/icons';

const pageProductCollection = (S) => [
	S.listItem()
		.title('Collections')
		.icon(StackIcon)
		.child(
			S.documentTypeList('pProductCollection')
				.title('Collections')
				.apiVersion(apiVersion)
				.filter('_type == "pProductCollection" && language == "en"')
				.defaultOrdering([{ field: 'title', direction: 'asc' }])
				.child((docId) =>
					S.documentList()
						.title('Translations')
						.apiVersion(apiVersion)
						.filter(
							'_type == "pProductCollection" && _id in *[_type == "translation.metadata" && references($docId)][0].translations[].value._ref'
						)
						.params({ docId })
						.defaultOrdering([{ field: 'language', direction: 'asc' }])
				)
		),
	// S.listItem()
	// 	.title('Collections · 中文 (no English pair)')
	// 	.icon(StackIcon)
	// 	.child(
	// 		S.documentList()
	// 			.title('中文 — missing English version')
	// 			.apiVersion(apiVersion)
	// 			.filter(
	// 				'_type == "pProductCollection" && language != "en" && count(*[_type == "translation.metadata" && references(^._id)][0].translations[value->language == "en"]) == 0'
	// 			)
	// 	),
];

const pageProductCategory = (S) => {
	return S.listItem()
		.title('Categories')
		.child(S.documentTypeList('pProductCategory').title('Categories'))
		.icon(TagsIcon);
};

const pageBrand = (S) => {
	return S.listItem()
		.title('Brands')
		.child(S.documentTypeList('pBrand').title('Brands'))
		.icon(TagsIcon);
};

const pageTag = (S) => {
	return S.listItem()
		.title('Tags')
		.child(S.documentTypeList('gTag').title('Tags'))
		.icon(TagsIcon);
};

export const pageProductItems = (S) => {
	return [
		S.listItem()
			.title('Products Index Page')
			.child(
				S.editor()
					.id('pProductIndex')
					.title('Products Index Page')
					.schemaType('pProductIndex')
					.documentId('pProductIndex')
			)
			.icon(StarIcon),
		S.listItem()
			.title('All Products')
			.icon(StarIcon)
			.child(
				S.documentTypeList('pProduct')
					.title('Products')
					.apiVersion(apiVersion)
					.filter('_type == "pProduct" && language == "en"')
					.defaultOrdering([{ field: 'title', direction: 'asc' }])
					.child((docId) =>
						S.documentList()
							.title('Translations')
							.apiVersion(apiVersion)
							.filter(
								'_type == "pProduct" && _id in *[_type == "translation.metadata" && references($docId)][0].translations[].value._ref'
							)
							.params({ docId })
							.defaultOrdering([
								{
									field: 'language',
									direction: 'asc',
								},
							])
					)
			),
		// S.listItem()
		// 	.title('中文 (no English pair)')
		// 	.icon(StarIcon)
		// 	.child(
		// 		S.documentList()
		// 			.title('中文 — missing English version')
		// 			.apiVersion(apiVersion)
		// 			.filter(
		// 				'_type == "pProduct" && language != "en" && count(*[_type == "translation.metadata" && references(^._id)][0].translations[value->language == "en"]) == 0'
		// 			)
		// 	),
		...pageProductCollection(S),
		S.listItem()
			.id('productTaxonomy')
			.title('Taxonomy')
			.icon(TagsIcon)
			.child(
				S.list()
					.title('Taxonomy')
					.items([
						pageProductCategory(S),
						pageBrand(S),
						pageTag(S),
					])
			),
	];
};
