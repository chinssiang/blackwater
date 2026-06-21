'use server';

import { sanityFetch } from '@/sanity/lib/live';
import {
	loadMoreProductsAllQuery,
	productsByCategoryPageQuery,
	productsByCollectionPageQuery,
} from '@/sanity/lib/queries';
import type { Locale } from '@/lib/i18n';
import {
	PRODUCTS_PAGE_SIZE,
	sliceKeyset,
	sliceOffset,
	type LoadMoreCursor,
	type LoadMoreResult,
	type ProductCardData,
	type ProductSource,
} from '@/lib/cursor';

type Bound = { locale: Locale; source: ProductSource };

/**
 * Fetches the next batch of products for a given list. The first argument is
 * bound server-side via `.bind` on the page so the client only ever sends the
 * opaque cursor — the GROQ filter is chosen here from the typed `source`, never
 * from a client-supplied string. Fetched with `stega: false` so titles (and
 * therefore keyset cursors) stay free of invisible Visual-Editing characters.
 */
export async function loadMoreProducts(
	{ locale, source }: Bound,
	cursor: LoadMoreCursor
): Promise<LoadMoreResult> {
	const limit = PRODUCTS_PAGE_SIZE + 1;

	if (source.kind === 'collection') {
		const offset = cursor && 'offset' in cursor ? cursor.offset : 0;
		const { data } = await sanityFetch({
			query: productsByCollectionPageQuery,
			params: {
				locale,
				collectionId: source.collectionId,
				start: offset,
				end: offset + limit,
			},
			stega: false,
			tags: ['pProductCollection', 'pProduct', 'pProductCategory'],
		});
		return sliceOffset((data ?? []) as ProductCardData[], offset);
	}

	const keyset = cursor && 'title' in cursor ? cursor : null;
	const params = {
		locale,
		cursorTitle: keyset?.title ?? null,
		cursorId: keyset?.id ?? null,
		limit,
	};

	const { data } =
		source.kind === 'category'
			? await sanityFetch({
					query: productsByCategoryPageQuery,
					params: { ...params, categoryId: source.categoryId },
					stega: false,
					tags: ['pProductCategory', 'pProduct'],
				})
			: await sanityFetch({
					query: loadMoreProductsAllQuery,
					params,
					stega: false,
					tags: ['pProduct', 'pProductCategory'],
				});

	return sliceKeyset((data ?? []) as ProductCardData[]);
}
