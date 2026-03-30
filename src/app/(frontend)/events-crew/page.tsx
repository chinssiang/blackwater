import type { Metadata } from 'next';
import { Suspense } from 'react';
import { sanityFetch } from '@/sanity/lib/live';
import {
	eventCrewMonthsQuery,
	eventCrewByMonthQuery,
	eventCrewMembersQuery,
} from '@/sanity/lib/queries';
import type {
	EventCrewByMonthQueryResult,
	EventCrewMonthsQueryResult,
	EventCrewMembersQueryResult,
} from 'sanity.types';
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

function getMonthDateRange(year: number, month: number) {
	const startDate = new Date(year, month, 1).toISOString();
	const endDate = new Date(year, month + 1, 1).toISOString();
	return { startDate, endDate };
}

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ month?: string; member?: string }>;
}) {
	const { month: monthParam, member: memberSlug } = await searchParams;

	// Lightweight query: just dates for building month navigation
	const { data: monthEntries } = await sanityFetch({
		query: eventCrewMonthsQuery,
		tags: ['pEvent'],
	});

	const entries: EventCrewMonthsQueryResult = monthEntries ?? [];
	const availableMonthKeys = [
		...new Set(
			entries.map((entry) => {
				const date = new Date(entry.eventDatetime);
				return `${date.getFullYear()}_${date.getMonth()}`;
			})
		),
	].sort();

	const parsed = parseMonthParam(monthParam);
	let activeKey: string | null = null;

	if (parsed) {
		const requestedKey = `${parsed.year}_${parsed.month}`;
		if (availableMonthKeys.includes(requestedKey)) {
			activeKey = requestedKey;
		}
	}

	if (!activeKey && availableMonthKeys.length > 0) {
		const now = new Date();
		const currentKey = `${now.getFullYear()}_${now.getMonth()}`;
		const futureKey = availableMonthKeys.find((key) => key >= currentKey);
		activeKey = futureKey || availableMonthKeys[availableMonthKeys.length - 1];
	}

	let events: EventCrewByMonthQueryResult = [];
	let uniqueMembers: EventCrewMembersQueryResult = [];

	if (activeKey) {
		const [year, month] = activeKey.split('_').map(Number);
		const { startDate, endDate } = getMonthDateRange(year, month);
		const tags = ['pEvent', 'gTeamMember', 'pEventRole'];
		const [{ data: eventsData }, { data: membersData }] = await Promise.all([
			sanityFetch({
				query: eventCrewByMonthQuery,
				params: { startDate, endDate, memberSlug: memberSlug || '' },
				tags,
			}),
			sanityFetch({
				query: eventCrewMembersQuery,
				params: { startDate, endDate },
				tags: ['gTeamMember'],
			}),
		]);
		events = eventsData ?? [];
		uniqueMembers = membersData ?? [];
	}

	const selectedMember = memberSlug
		? (uniqueMembers.find((m) => m.slug === memberSlug) ?? null)
		: null;

	return (
		<Suspense>
			<PageEventCrew
				events={events}
				activeKey={activeKey}
				availableMonthKeys={availableMonthKeys}
				uniqueMembers={uniqueMembers}
				selectedMember={selectedMember}
			/>
		</Suspense>
	);
}
