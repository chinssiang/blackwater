import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pEventsQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { PageEvents } from './_components/PageEvents';

const getCachedEventsData = cache(async () =>
	sanityFetch({ query: pEventsQuery, tags: ['pEvents', 'pEvent'] })
);

export async function generateMetadata(): Promise<Metadata> {
	const { data } = await getCachedEventsData();
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page() {
	const { data } = await getCachedEventsData();

	if (!data) return notFound();

	const { eventList } = data || {};
	const groupedEvents = eventList.reduce(
		(
			acc: Record<string, (typeof eventList)[number][]>,
			event: (typeof eventList)[number]
		) => {
			const date = new Date(event.eventDatetime);
			const year = date.getFullYear();
			const month = date
				.toLocaleString('en-US', { month: 'long' })
				.toLowerCase();

			const key = `${year}_${month}`;

			if (!acc[key]) {
				acc[key] = [];
			}
			acc[key].push(event);

			return acc;
		},
		{}
	);

	return <PageEvents data={{ groupedEvents, ...data }} />;
}
