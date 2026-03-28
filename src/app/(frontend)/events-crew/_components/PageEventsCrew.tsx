'use client';

import { cn } from '@/lib/utils';
import { hasArrayValue } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
import { useMemo } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { buildImageSrc } from '@/lib/image-utils';
import type { EventCrewQueryResult } from 'sanity.types';

type EventItem = NonNullable<EventCrewQueryResult>[number];

const EASE_CARD = [0, 0.5, 0.5, 1] as const;
const EASE_HEADER = [0, 0.71, 0.2, 1.01] as const;

const DAY_MAP: Record<string, string> = {
	Sun: '日',
	Mon: '一',
	Tue: '二',
	Wed: '三',
	Thu: '四',
	Fri: '五',
	Sat: '六',
};

function formatEventDate(datetime: string) {
	const date = new Date(datetime);
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const dayOfWeek = format(date, 'EEE');
	const zhDay = DAY_MAP[dayOfWeek] || dayOfWeek;
	const time = format(date, 'HH:mm');
	return {
		display: `${month}/${String(day).padStart(2, '0')}（${zhDay}）${time}`,
		date,
	};
}

function isEventEnded(eventDatetime: string | null | undefined): boolean {
	if (!eventDatetime) return false;
	const eventDateEndOfDay = new Date(eventDatetime);
	eventDateEndOfDay.setHours(23, 59, 59, 999);
	return eventDateEndOfDay < new Date();
}

function keyToMonthParam(key: string): string {
	const [year, month] = key.split('_');
	return `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
}

function keyToDisplay(key: string): string {
	const [year, month] = key.split('_');
	return `${year}年${Number(month) + 1}月`;
}

interface PageEventCrewProps {
	events: EventItem[];
	activeKey: string | null;
	availableMonthKeys: string[];
}

export function PageEventCrew({
	events,
	activeKey,
	availableMonthKeys,
}: PageEventCrewProps) {
	const currentIndex = activeKey ? availableMonthKeys.indexOf(activeKey) : -1;
	const hasPrevious = currentIndex > 0;
	const hasNext = currentIndex < availableMonthKeys.length - 1;

	const prevHref = hasPrevious
		? `/events-crew?month=${keyToMonthParam(availableMonthKeys[currentIndex - 1])}`
		: null;
	const nextHref = hasNext
		? `/events-crew?month=${keyToMonthParam(availableMonthKeys[currentIndex + 1])}`
		: null;

	const monthDisplay = activeKey ? keyToDisplay(activeKey) : '';

	return (
		<div className="px-contain mx-auto min-h-[inherit] py-10 lg:py-17.5">
			{/* Briefing Header */}
			<div className="sticky top-header bg-background/95 backdrop-blur-sm z-10 py-4 border-b border-white/[0.06]">
				<div className="flex items-end justify-between gap-4">
					<div>
						<motion.span
							key={`label-${monthDisplay}`}
							initial="hide"
							animate="show"
							variants={fadeAnim}
							transition={{ duration: 0.4, ease: EASE_HEADER }}
							className="t-l-2 text-muted-foreground block mb-2"
						>
							CREW BRIEFING
						</motion.span>
						<motion.h1
							key={monthDisplay}
							initial="hide"
							animate="show"
							variants={fadeAnim}
							transition={{ duration: 0.6, delay: 0.15, ease: EASE_HEADER }}
							className="t-h-3 font-bold tracking-tight"
						>
							{monthDisplay}
						</motion.h1>
					</div>
					{availableMonthKeys.length > 0 && (
						<nav className="flex items-center gap-1 shrink-0">
							{prevHref ? (
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="uppercase t-l-2 cursor-pointer hover:opacity-60"
								>
									<Link href={prevHref}>
										<ArrowLeft className="size-3.5" />
										Prev
									</Link>
								</Button>
							) : (
								<Button
									disabled
									variant="ghost"
									size="sm"
									className="uppercase t-l-2"
								>
									<ArrowLeft className="size-3.5" />
									Prev
								</Button>
							)}
							<span className="text-white/20 text-xs select-none">/</span>
							{nextHref ? (
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="uppercase t-l-2 cursor-pointer hover:opacity-60"
								>
									<Link href={nextHref}>
										Next
										<ArrowRight className="size-3.5" />
									</Link>
								</Button>
							) : (
								<Button
									disabled
									variant="ghost"
									size="sm"
									className="uppercase t-l-2"
								>
									Next
									<ArrowRight className="size-3.5" />
								</Button>
							)}
						</nav>
					)}
				</div>
			</div>

			{hasArrayValue(events) ? (
				<div className="mt-8 lg:mt-12 space-y-6">
					{events.map((event, index) => (
						<EventCard key={event._id} event={event} index={index} />
					))}
				</div>
			) : (
				<div className="py-20 text-center">
					<p className="t-b-1 text-muted-foreground">
						No crew assignments for this month
					</p>
				</div>
			)}
		</div>
	);
}

function EventCard({ event, index }: { event: EventItem; index: number }) {
	const {
		title,
		eventDatetime,
		location,
		locationLink,
		categories,
		teamAssignments,
		teamNotes,
	} = event;

	const ended = isEventEnded(eventDatetime);
	const dateInfo = eventDatetime ? formatEventDate(eventDatetime) : null;

	const categoryTitle = categories?.[0]?.title;
	const categoryColor = categories?.[0]?.categoryColor as
		| Parameters<typeof buildRgbaCssString>[0]
		| undefined;
	const categoryBg = categoryColor
		? buildRgbaCssString(categoryColor)
		: undefined;

	const sortedAssignments = useMemo(() => {
		if (!teamAssignments) return [];
		return [...teamAssignments].sort((a, b) => {
			const orderA = a.role?.order ?? 999;
			const orderB = b.role?.order ?? 999;
			if (orderA !== orderB) return orderA - orderB;
			const groupA = a.group || '';
			const groupB = b.group || '';
			return groupA.localeCompare(groupB);
		});
	}, [teamAssignments]);

	return (
		<motion.article
			initial="hide"
			animate="show"
			variants={fadeAnim}
			transition={{
				duration: 1.2,
				delay: (index + 1) * 0.08,
				ease: EASE_CARD,
			}}
			className={cn(
				'border border-white/8 rounded-lg overflow-hidden',
				'transition-opacity duration-500',
				{ 'opacity-25 saturate-0': ended }
			)}
		>
			<div className="px-5 py-4 lg:px-6 lg:py-5 border-b border-white/6 bg-white/2">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
						<h2 className="t-h-5 font-bold">{title}</h2>
						{categoryTitle && (
							<span
								className="t-l-2 p-2 rounded uppercase shrink-0"
								style={{
									backgroundColor: categoryBg || 'var(--muted)',
									color: categoryBg ? '#fff' : 'var(--foreground)',
								}}
							>
								{categoryTitle}
							</span>
						)}
					</div>
					<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 shrink-0">
						{dateInfo && (
							<span className="t-b-1 text-foreground tabular-nums font-medium">
								{dateInfo.display}
							</span>
						)}
						{location &&
							(locationLink ? (
								<a
									href={locationLink}
									target="_blank"
									rel="noopener noreferrer"
									className="t-b-2 text-muted-foreground underline underline-offset-2 decoration-white/20 hover:text-foreground hover:decoration-white/40 transition-colors"
								>
									{location}
								</a>
							) : (
								<span className="t-b-2 text-muted-foreground">{location}</span>
							))}
					</div>
				</div>
			</div>

			{/* Assignments */}
			{hasArrayValue(sortedAssignments) && (
				<div className="p-4 lg:p-5">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
						{sortedAssignments.map((assignment) => (
							<AssignmentCard key={assignment._key} assignment={assignment} />
						))}
					</div>
				</div>
			)}

			{/* Team Notes */}
			{teamNotes && (
				<div className="mx-4 mb-4 lg:mx-5 lg:mb-5 px-4 py-3 bg-white/[0.02] border border-dashed border-white/[0.08] rounded">
					<span className="t-l-2 text-muted-foreground block mb-1">NOTE</span>
					<p className="t-b-1 text-muted-foreground">{teamNotes}</p>
				</div>
			)}
		</motion.article>
	);
}

type Assignment = NonNullable<EventItem['teamAssignments']>[number];

function AssignmentCard({ assignment }: { assignment: Assignment }) {
	const { role, group, members, note } = assignment;

	const roleTitle = role?.title || 'Role';
	const label = group ? `${roleTitle} ${group} 組` : roleTitle;

	return (
		<div className="bg-white/3 border border-white/6 rounded-md px-3.5 py-2.5">
			<span className="t-l-2 font-semibold uppercase text-indigo-400/90 block mb-1.5">
				{label}
			</span>
			<div className="flex flex-wrap items-center gap-2">
				{members?.map((member) => {
					const name = member.nickname || member.name || 'Unknown';
					const avatarSrc = member.avatar
						? buildImageSrc(member.avatar, { width: 48, height: 48 })
						: '';
					return (
						<div key={member._id} className="flex items-center gap-1.5">
							{avatarSrc ? (
								<img
									src={avatarSrc}
									alt={name}
									className="size-6 rounded-full object-cover shrink-0 ring-1 ring-white/10"
								/>
							) : (
								<span className="size-6 rounded-full bg-white/[0.08] shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground ring-1 ring-white/10">
									{name.charAt(0)}
								</span>
							)}
							<span className="t-b-1 font-medium">{name}</span>
						</div>
					);
				})}
			</div>
			{note && (
				<p className="t-b-2 text-muted-foreground mt-1.5 italic">{note}</p>
			)}
		</div>
	);
}
