import { StarIcon, TagsIcon, StackIcon } from '@sanity/icons';

const pageProductCollection = (S) => {
	return S.listItem()
		.title('Collections')
		.child(
			S.documentTypeList('pProductCollection').title('Collections')
		)
		.icon(StackIcon);
};

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

export const pageProduct = (S) => {
	return S.listItem()
		.title('Products')
		.child(
			S.list()
				.title('Products')
				.items([
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
						.child(S.documentTypeList('pProduct').title('Products'))
						.icon(StarIcon),
					pageProductCollection(S),
					S.divider(),
					pageProductCategory(S),
					pageBrand(S),
					pageTag(S),
				])
		)
		.icon(StarIcon);
};
