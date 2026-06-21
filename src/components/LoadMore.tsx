'use client';

import { Button } from '@/components/ui/Button';
import { encodeCursor, type LoadMoreCursor } from '@/lib/cursor';

type Props = {
	hasMore: boolean;
	isLoading: boolean;
	/** Cursor for the next batch; drives the progressive-enhancement href. */
	nextCursor: LoadMoreCursor;
	/** Localized list path the `?cursor=` fallback navigates to without JS. */
	basePath: string;
	onLoadMore: () => void;
	label: string;
	loadingLabel: string;
};

/**
 * Load More trigger. Renders as a real anchor pointing at `?cursor=<next>` so
 * crawlers (rel="next") and no-JS users still reach every product; with JS the
 * click is intercepted and the batch is appended in place.
 */
export function LoadMore({
	hasMore,
	isLoading,
	nextCursor,
	basePath,
	onLoadMore,
	label,
	loadingLabel,
}: Props) {
	if (!hasMore) return null;

	const href = nextCursor
		? `${basePath}?cursor=${encodeCursor(nextCursor)}`
		: basePath;

	return (
		<div className="mb-20 flex justify-center">
			<Button asChild variant="outline" size="lg">
				<a
					href={href}
					rel="next"
					aria-busy={isLoading}
					onClick={(e) => {
						e.preventDefault();
						onLoadMore();
					}}
				>
					{isLoading ? loadingLabel : label}
				</a>
			</Button>
		</div>
	);
}
