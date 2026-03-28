import type { Metadata } from 'next';
import { sanityFetch } from '@/sanity/lib/live';
import { eventCrewQuery } from '@/sanity/lib/queries';
import { PageEventCrew } from './_components/PageEventCrew';

export const metadata: Metadata = {
	title: 'Event Crew',
	robots: { index: false, follow: false },
};

export default async function Page() {
	const { data } = await sanityFetch({
		query: eventCrewQuery,
		tags: ['pEvent', 'gTeamMember', 'pEventRole'],
	});

	const events = data || [];

	const groupedEvents = events.reduce(
		(acc: Record<string, typeof events>, event: (typeof events)[number]) => {
			const date = new Date(event.eventDatetime!);
			const year = date.getFullYear();
			const month = date.getMonth();
			const key = `${year}_${month}`;

			if (!acc[key]) {
				acc[key] = [];
			}
			acc[key].push(event);

			return acc;
		},
		{}
	);

	return <PageEventCrew groupedEvents={groupedEvents} />;
}
