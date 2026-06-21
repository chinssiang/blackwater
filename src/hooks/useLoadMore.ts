'use client';

import { useCallback, useState, useTransition } from 'react';
import type { LoadMoreCursor, LoadMoreResult } from '@/lib/cursor';

type UseLoadMoreArgs<T> = {
	initialItems: T[];
	/** Cursor for the *next* batch (i.e. the batch after `initialItems`). */
	initialCursor: LoadMoreCursor;
	initialHasMore: boolean;
	action: (cursor: LoadMoreCursor) => Promise<LoadMoreResult<T>>;
};

/**
 * Accumulating cursor pagination. Holds the loaded items, the cursor for the
 * next batch, and whether more remain. `loadMore()` calls the bound server
 * action, appends its items, and advances the cursor. `nextCursor` is exposed
 * so the trigger can render a real `?cursor=` href for no-JS / crawler use.
 */
export function useLoadMore<T>({
	initialItems,
	initialCursor,
	initialHasMore,
	action,
}: UseLoadMoreArgs<T>) {
	const [items, setItems] = useState<T[]>(initialItems);
	const [cursor, setCursor] = useState<LoadMoreCursor>(initialCursor);
	const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
	const [isLoading, startTransition] = useTransition();

	const loadMore = useCallback(() => {
		if (!hasMore || isLoading) return;
		startTransition(async () => {
			const res = await action(cursor);
			setItems((prev) => [...prev, ...res.items]);
			setCursor(res.nextCursor);
			setHasMore(res.hasMore);
		});
	}, [action, cursor, hasMore, isLoading]);

	return { items, loadMore, isLoading, hasMore, nextCursor: cursor };
}
