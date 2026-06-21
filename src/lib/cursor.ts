import type { LoadMoreProductsAllQueryResult } from 'sanity.types';

/** How many products render per "page" / Load More batch. */
export const PRODUCTS_PAGE_SIZE = 24;

/** Card-level product shape shared by every paginated product list. */
export type ProductCardData = NonNullable<LoadMoreProductsAllQueryResult>[number];

/** Keyset cursor for filter-based pagination, ordered by (title asc, _id asc). */
export type KeysetCursor = { title: string; id: string };
/** Offset cursor for the editorially-ordered collection reference array. */
export type OffsetCursor = { offset: number };
export type LoadMoreCursor = KeysetCursor | OffsetCursor | null;

/** Which list the server action should query. Built server-side only. */
export type ProductSource =
	| { kind: 'all' }
	| { kind: 'category'; categoryId: string }
	| { kind: 'collection'; collectionId: string };

export type LoadMoreResult<T = ProductCardData> = {
	items: T[];
	nextCursor: LoadMoreCursor;
	hasMore: boolean;
};

/**
 * Splits a keyset over-fetch (PAGE_SIZE + 1 rows) into the rendered page plus
 * the cursor for the next batch. `hasMore` comes from the sentinel row, not a
 * `total` count, so it stays correct as content changes under live editing.
 */
export function sliceKeyset(
	fetched: ProductCardData[],
	pageSize: number = PRODUCTS_PAGE_SIZE
): LoadMoreResult {
	const hasMore = fetched.length > pageSize;
	const items = fetched.slice(0, pageSize);
	const last = items[items.length - 1];
	return {
		items,
		hasMore,
		nextCursor: hasMore && last ? { title: last.title ?? '', id: last._id } : null,
	};
}

/** Offset equivalent of {@link sliceKeyset} for the collection array slice. */
export function sliceOffset(
	fetched: ProductCardData[],
	offset: number,
	pageSize: number = PRODUCTS_PAGE_SIZE
): LoadMoreResult {
	const hasMore = fetched.length > pageSize;
	return {
		items: fetched.slice(0, pageSize),
		hasMore,
		nextCursor: hasMore ? { offset: offset + pageSize } : null,
	};
}

/** URL-safe encoding for the `?cursor=` progressive-enhancement fallback. */
export function encodeCursor(cursor: Exclude<LoadMoreCursor, null>): string {
	return encodeURIComponent(JSON.stringify(cursor));
}

/**
 * Decodes a `?cursor=` value. Next.js already URL-decodes searchParams, so the
 * incoming string is plain JSON. Returns null on anything malformed.
 */
export function decodeCursor(value: string | undefined | null): LoadMoreCursor {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value);
		if (parsed && typeof parsed === 'object') {
			if (typeof parsed.offset === 'number') return { offset: parsed.offset };
			if (typeof parsed.title === 'string' && typeof parsed.id === 'string') {
				return { title: parsed.title, id: parsed.id };
			}
		}
	} catch {
		// fall through to null
	}
	return null;
}
