import type { Metadata } from 'next';
import { sanityFetch } from '@/sanity/lib/live';
import { eventCrewQuery } from '@/sanity/lib/queries';
import { PageEventCrew } from './_components/PageEventsCrew';

export const metadata: Metadata = {
	title: 'Event Crew',
	robots: { index: false, follow: false },
};

function parseMonthParam(param: string | undefined) {
	if (!param) return null;
	const match = param.match(/^(\d{4})-(\d{1,2})$/);
	if (!match) return null;
	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10);
	if (month < 1 || month > 12) return null;
	return { year, month: month - 1 };
}

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ month?: string }>;
}) {
	const { month: monthParam } = await searchParams;
	const { data } = await sanityFetch({
		query: eventCrewQuery,
		tags: ['pEvent', 'gTeamMember', 'pEventRole'],
	});

	const events = data || [];

	const groupedEvents: Record<string, (typeof events)[number][]> = {};
	const availableMonthKeys: string[] = [];

	for (const event of events) {
		const date = new Date(event.eventDatetime!);
		const year = date.getFullYear();
		const month = date.getMonth();
		const key = `${year}_${month}`;

		if (!groupedEvents[key]) {
			groupedEvents[key] = [];
			availableMonthKeys.push(key);
		}
		groupedEvents[key].push(event);
	}

	availableMonthKeys.sort();

	// Determine which month to show
	const parsed = parseMonthParam(monthParam);
	let activeKey: string | null = null;

	if (parsed) {
		const requestedKey = `${parsed.year}_${parsed.month}`;
		if (groupedEvents[requestedKey]) {
			activeKey = requestedKey;
		}
	}

	// If no valid param or param doesn't match data, find the nearest upcoming month
	if (!activeKey && availableMonthKeys.length > 0) {
		const now = new Date();
		const currentKey = `${now.getFullYear()}_${now.getMonth()}`;
		// Find current or next available month
		const futureKey = availableMonthKeys.find((key) => key >= currentKey);
		activeKey = futureKey || availableMonthKeys[availableMonthKeys.length - 1];
	}

	const activeEvents = activeKey ? groupedEvents[activeKey] || [] : [];

	return (
		<PageEventCrew
			events={activeEvents}
			activeKey={activeKey}
			availableMonthKeys={availableMonthKeys}
		/>
	);
}
