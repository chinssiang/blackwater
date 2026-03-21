import { StarIcon, TagsIcon, StackIcon } from '@sanity/icons';

const pageCuratedCollection = (S) => {
	return S.listItem()
		.title('Collections')
		.child(
			S.documentTypeList('pCuratedCollection').title('Collections')
		)
		.icon(StackIcon);
};

const pageCuratedCategory = (S) => {
	return S.listItem()
		.title('Categories')
		.child(S.documentTypeList('pCuratedCategory').title('Categories'))
		.icon(TagsIcon);
};

const pageBrand = (S) => {
	return S.listItem()
		.title('Brands')
		.child(S.documentTypeList('pBrand').title('Brands'))
		.icon(TagsIcon);
};

export const pageCurated = (S) => {
	return S.listItem()
		.title('Curated')
		.child(
			S.list()
				.title('Curated')
				.items([
					S.listItem()
						.title('Curated Index Page')
						.child(
							S.editor()
								.id('pCuratedIndex')
								.title('Curated Index Page')
								.schemaType('pCuratedIndex')
								.documentId('pCuratedIndex')
						)
						.icon(StarIcon),
					S.listItem()
						.title('Products')
						.child(S.documentTypeList('pCurated').title('Curated Products'))
						.icon(StarIcon),
					pageCuratedCollection(S),
					S.divider(),
					pageCuratedCategory(S),
					pageBrand(S),
				])
		)
		.icon(StarIcon);
};
