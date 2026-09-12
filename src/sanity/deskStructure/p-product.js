import { StarIcon, TagsIcon, StackIcon, BasketIcon } from '@sanity/icons';

// Products and collections are field-level localized (one document carries all
// languages), so both lists are plain documentTypeLists — no language filter,
// no translation.metadata child resolution.
//
// `title[0].value`, not `title.0.value`: Sanity parses a bare `0` as a field
// NAME, so the path fails to resolve and the ordering is silently dropped. The
// bracket form is a real index segment. Index 0 is the first authored language
// — English for everything except the handful of zh-only products.
const orderByTitle = [{ field: 'title[0].value', direction: 'asc' }];

const pageProductCollection = (S) => [
	S.listItem()
		.title('Collections')
		.icon(StackIcon)
		.child(
			S.documentTypeList('pProductCollection')
				.title('Collections')
				.defaultOrdering(orderByTitle)
		),
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
					.defaultOrdering(orderByTitle)
			),
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
		// Cart configuration lives with Products rather than under Settings —
		// it's part of the commerce surface an editor is already working in.
		// documentId pins the English document; settingsCart is localized, so the
		// language dropdown inside the editor reaches the other versions.
		S.listItem()
			.title('Cart')
			.child(
				S.editor()
					.id('settingsCart')
					.title('Cart')
					.schemaType('settingsCart')
					.documentId('settingsCart')
			)
			.icon(BasketIcon),
	];
};
