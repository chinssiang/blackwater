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
			<div className="flex items-center justify-between sticky top-header bg-background/95 z-10 py-2">
				<motion.h1
					key={monthDisplay}
					initial="hide"
					animate="show"
					variants={fadeAnim}
					transition={{ duration: 0.6, delay: 0.3, ease: EASE_HEADER }}
					className="t-h-5 font-bold"
				>
					{monthDisplay} ｜ 領跑與支援配置
				</motion.h1>
				{availableMonthKeys.length > 0 && (
					<div className="flex items-center">
						{prevHref ? (
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="uppercase t-b-2 cursor-pointer hover:opacity-60"
							>
								<Link href={prevHref}>
									<ArrowLeft />
									Previous
								</Link>
							</Button>
						) : (
							<Button
								disabled
								variant="ghost"
								size="sm"
								className="uppercase t-b-2"
							>
								<ArrowLeft />
								Previous
							</Button>
						)}
						/
						{nextHref ? (
							<Button
								asChild
								variant="ghost"
								size="sm"
								className="uppercase t-b-2 cursor-pointer hover:opacity-60"
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
								className="uppercase t-b-2"
							>
								Next
								<ArrowRight className="size-3.5" />
							</Button>
						)}
					</div>
				)}
			</div>

			{hasArrayValue(events) ? (
				<div className="mt-10 lg:mt-17.5 space-y-4">
					{events.map((event, index) => (
						<EventCard key={event._id} event={event} index={index} />
					))}
				</div>
			) : (
				<p className="py-8 text-center text-muted-foreground">
					No crew assignments for this month
				</p>
			)}
		</div>
	);
}

function EventCard({ event, index }: { event: EventItem; index: number }) {
	const {
		title,
		eventDatetime,
		location,
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
		<motion.div
			initial="hide"
			animate="show"
			variants={fadeAnim}
			transition={{
				duration: 1.5,
				delay: (index + 1) * 0.1,
				ease: EASE_CARD,
			}}
			className={cn('border border-white/10 rounded-lg p-5 bg-white/[0.02]', {
				'opacity-30': ended,
			})}
		>
			{/* Header */}
			<div className="flex flex-wrap items-baseline gap-2.5 mb-4">
				{categoryTitle && (
					<span
						className="text-[11px] font-bold px-2 py-0.5 rounded uppercase"
						style={{
							backgroundColor: categoryBg || 'var(--muted)',
							color: categoryBg ? '#fff' : 'var(--foreground)',
						}}
					>
						{categoryTitle}
					</span>
				)}
				<span className="font-semibold">{title}</span>
				{dateInfo && (
					<span className="text-muted-foreground text-sm ml-auto">
						{dateInfo.display}
					</span>
				)}
				{location && (
					<span className="text-muted-foreground text-sm">📍 {location}</span>
				)}
			</div>

			{/* Assignments Grid */}
			{hasArrayValue(sortedAssignments) && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
					{sortedAssignments.map((assignment) => (
						<AssignmentCard key={assignment._key} assignment={assignment} />
					))}
				</div>
			)}

			{/* Team Notes */}
			{teamNotes && (
				<div className="mt-3 px-3 py-2 bg-white/[0.03] border border-white/10 rounded text-sm text-muted-foreground italic">
					📝 {teamNotes}
				</div>
			)}
		</motion.div>
	);
}

type Assignment = NonNullable<EventItem['teamAssignments']>[number];

function AssignmentCard({ assignment }: { assignment: Assignment }) {
	const { role, group, members, note } = assignment;

	const roleTitle = role?.title || 'Role';
	const label = group ? `${roleTitle} ${group} 組` : roleTitle;

	return (
		<div className="bg-white/4 border border-white/10 rounded-md px-3 py-2">
			<span className="text-[11px] font-semibold uppercase text-indigo-400 tracking-wide">
				{label}
			</span>
			<div className="flex flex-wrap items-center gap-1.5 mt-1">
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
									className="size-5 rounded-full object-cover shrink-0"
								/>
							) : (
								<span className="size-5 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-[9px] font-medium text-muted-foreground">
									{name.charAt(0)}
								</span>
							)}
							<span className="text-sm">{name}</span>
						</div>
					);
				})}
			</div>
			{note && (
				<div className="text-xs text-muted-foreground mt-1 italic">{note}</div>
			)}
		</div>
	);
}
