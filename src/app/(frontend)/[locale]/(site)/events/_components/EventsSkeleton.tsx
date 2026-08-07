'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from '@/components/LocaleProvider';
import { EVENTS_GRID_COLS } from './events-grid';

// Rendered as the Suspense fallback for the /events index. Client-side because
// it needs useTranslations for the real column headers, and a Suspense fallback
// must render synchronously -- so it cannot be an async server component
// awaiting getDictionary.
//
// The wrapper, sticky header and grid deliberately mirror PageEvents so the
// swap to real data costs no layout shift. Assumes the status column is present
// (the common case); a month with no status pills settles one column narrower.

// Dev data averages ~6 events per month.
const PLACEHOLDER_ROWS = 6;

// Varied widths read as content rather than as a loading bar.
const ROW_WIDTHS = [
	{ title: 'w-3/5', time: 'w-4/5', location: 'w-3/4' },
	{ title: 'w-2/5', time: 'w-3/5', location: 'w-1/2' },
	{ title: 'w-4/5', time: 'w-4/5', location: 'w-2/3' },
	{ title: 'w-1/2', time: 'w-2/3', location: 'w-4/5' },
	{ title: 'w-3/4', time: 'w-3/5', location: 'w-1/2' },
	{ title: 'w-2/3', time: 'w-4/5', location: 'w-3/5' },
];

function Bar({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn('block h-3 rounded-full bg-foreground/15', className)}
		/>
	);
}

export function EventsSkeleton() {
	const t = useTranslations('events');

	return (
		<div
			className="min-h-screen p-x-max mx-auto pt-8.5 pb-22.5 lg:pt-16"
			role="status"
			aria-busy="true"
		>
			<span className="sr-only">{t.loading}</span>
			<div className="flex items-center justify-between sticky top-header bg-background/95 z-10 font-bold">
				<Bar className="t-h-3 h-5 w-40 lg:w-56" />
			</div>
			<div className="mt-10 lg:mt-17.5 animate-pulse">
				<div
					className={cn(
						't-b-1 uppercase grid border-y border-b border-foreground/80 py-2 lg:py-6',
						EVENTS_GRID_COLS.withStatus
					)}
				>
					<div className="font-bold lg:px-2 lg:pl-0">{t.headers.codex}</div>
					<div className="font-bold lg:px-2 text-right lg:text-left">
						{t.headers.time}
					</div>
					<div className="font-bold lg:px-2 hidden lg:block">
						{t.headers.location}
					</div>
					<div className="font-bold lg:px-2 hidden lg:block text-right">
						{t.headers.status}
					</div>
				</div>
				{ROW_WIDTHS.slice(0, PLACEHOLDER_ROWS).map((w, i) => (
					<div
						key={i}
						className={cn(
							'grid items-center border-b border-foreground/80 py-4 lg:py-2 lg:min-h-15',
							EVENTS_GRID_COLS.withStatus
						)}
					>
						<div className="lg:px-2 lg:pl-0">
							<Bar className={w.title} />
						</div>
						<div className="lg:px-2 flex justify-end lg:justify-start">
							<Bar className={w.time} />
						</div>
						<div className="lg:px-2 hidden lg:block">
							<Bar className={w.location} />
						</div>
						<div className="lg:px-2 hidden lg:flex justify-end">
							<Bar className="h-8 w-24 rounded-4xl" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
