'use client';

import { cn } from '@/lib/utils';
import { hasArrayValue } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { buildImageSrc } from '@/lib/image-utils';
import type { EventCrewQueryResult } from 'sanity.types';
import SanityImage from '@/components/SanityImage';
import { useState, useMemo, useEffect } from 'react';

type EventItem = NonNullable<EventCrewQueryResult>[number];

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

const DisabledPrevButton = (
	<Button disabled variant="ghost" size="sm" className="uppercase t-l-2">
		<ArrowLeft className="size-3.5" />
		Prev
	</Button>
);

const DisabledNextButton = (
	<Button disabled variant="ghost" size="sm" className="uppercase t-l-2">
		Next
		<ArrowRight className="size-3.5" />
	</Button>
);

interface PageEventCrewProps {
	events: EventItem[];
	activeKey: string | null;
	availableMonthKeys: string[];
}

function collectUniqueMembers(events: EventItem[]) {
	const memberMap = new Map<
		string,
		{
			_id: string;
			name: string;
			nickname: string | null;
			avatar: EventItem['teamAssignments'] extends Array<infer T>
				? T extends { members: Array<infer M> | null }
					? M extends { avatar: infer A }
						? A
						: null
					: null
				: null;
		}
	>();

	for (const event of events) {
		if (!event.teamAssignments) continue;
		for (const assignment of event.teamAssignments) {
			if (!assignment.members) continue;
			for (const member of assignment.members) {
				if (!memberMap.has(member._id)) {
					memberMap.set(member._id, {
						_id: member._id,
						name: member.name || 'Unknown',
						nickname: member.nickname,
						avatar: member.avatar,
					});
				}
			}
		}
	}

	return Array.from(memberMap.values()).sort((a, b) => {
		const nameA = a.nickname || a.name;
		const nameB = b.nickname || b.name;
		return nameA.localeCompare(nameB);
	});
}

function filterEventsByMember(
	events: EventItem[],
	memberId: string
): EventItem[] {
	return events.filter((event) =>
		event.teamAssignments?.some((assignment) =>
			assignment.members?.some((member) => member._id === memberId)
		)
	);
}

export function PageEventCrew({
	events,
	activeKey,
	availableMonthKeys,
}: PageEventCrewProps) {
	const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const lgQuery = window.matchMedia('(min-width: 1024px)');

		const handleScroll = () => {
			if (!lgQuery.matches) {
				setScrolled(false);
				return;
			}
			setScrolled((prev) => {
				if (prev) return window.scrollY > 20;
				return window.scrollY > 60;
			});
		};

		const handleMediaChange = () => {
			if (!lgQuery.matches) setScrolled(false);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		lgQuery.addEventListener('change', handleMediaChange);
		return () => {
			window.removeEventListener('scroll', handleScroll);
			lgQuery.removeEventListener('change', handleMediaChange);
		};
	}, []);

	const uniqueMembers = useMemo(() => collectUniqueMembers(events), [events]);

	const filteredEvents = useMemo(
		() =>
			selectedMemberId
				? filterEventsByMember(events, selectedMemberId)
				: events,
		[events, selectedMemberId]
	);

	const selectedMember = selectedMemberId
		? uniqueMembers.find((m) => m._id === selectedMemberId)
		: null;

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
		<>
			<div
				className={cn(
					'sticky top-header bg-background/95 backdrop-blur-sm z-10 border-b border-white/6 transition-all duration-300',
					scrolled ? 'py-2' : 'py-4'
				)}
			>
				<div className="flex items-end justify-between gap-4 p-x-max">
					<div className="space-y-3">
						<span
							className={cn(
								'text-muted-foreground block animate-fade-in transition-all duration-300 overflow-hidden',
								scrolled ? 't-h-6' : 't-h-5'
							)}
						>
							Crew briefing
						</span>
						<h1
							className={cn(
								'font-bold tracking-tight animate-fade-in transition-all duration-300',
								scrolled ? 't-h-5' : 't-h-3'
							)}
							style={{ animationDelay: '0.15s' }}
						>
							{monthDisplay}
						</h1>
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
								DisabledPrevButton
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
								DisabledNextButton
							)}
						</nav>
					)}
				</div>
				{/* Crew Filter */}
				{uniqueMembers.length > 0 && (
					<div className="flex items-center gap-1.5 lg:gap-2 mt-3 pt-3 border-t border-white/4 p-x-max mx-auto">
						<span className="t-l-2 text-muted-foreground uppercase shrink-0">
							Filter
						</span>
						<div className="relative min-w-0 flex-1">
							<div className="pointer-events-none absolute inset-y-0 -left-px w-6 bg-linear-to-r from-background to-transparent z-10 lg:hidden" />
							<div className="pointer-events-none absolute inset-y-0 -right-px w-6 bg-linear-to-l from-background to-transparent z-10 lg:hidden" />
							<div className="flex items-center gap-1 lg:gap-1.5 overflow-x-auto lg:flex-wrap scrollbar-none px-2 lg:px-0">
								{uniqueMembers.map((member) => {
									const displayName = member.nickname || member.name;
									const isActive = selectedMemberId === member._id;
									return (
										<button
											key={member._id}
											type="button"
											onClick={() =>
												setSelectedMemberId(isActive ? null : member._id)
											}
											className={cn(
												'flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 py-1 rounded-full text-sm whitespace-nowrap shrink-0 transition-all cursor-pointer hover:scale-110',
												isActive
													? 'bg-white/15 text-foreground ring-1 ring-white/20'
													: 'bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground'
											)}
										>
											{member.avatar ? (
												<div className="size-4 aspect-square rounded-full overflow-hidden shrink-0 relative">
													<SanityImage
														image={member.avatar}
														className="object-cover"
														fill
														sizes="16px"
													/>
												</div>
											) : (
												<span className="size-4 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-[8px] font-semibold">
													{displayName.charAt(0)}
												</span>
											)}
											<span className="t-b-2">{displayName}</span>
										</button>
									);
								})}
							</div>
						</div>
						{selectedMember && (
							<button
								type="button"
								onClick={() => setSelectedMemberId(null)}
								className="shrink-0 p-1 rounded-full hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
							>
								<X className="size-3.5" />
							</button>
						)}
					</div>
				)}
			</div>
			{hasArrayValue(filteredEvents) ? (
				<div className="p-x-max mt-8 lg:mt-12 space-y-6">
					{selectedMember && (
						<p className="t-b-2 text-muted-foreground">
							{selectedMember.nickname || selectedMember.name} is assigned to{' '}
							{filteredEvents.length} event
							{filteredEvents.length !== 1 ? 's' : ''} this month
						</p>
					)}
					{filteredEvents.map((event, index) => (
						<EventCard
							key={event._id}
							event={event}
							index={index}
							highlightMemberId={selectedMemberId}
						/>
					))}
				</div>
			) : (
				<div className="py-20 text-center">
					<p className="t-b-1 text-muted-foreground">
						{selectedMemberId
							? `${selectedMember?.nickname || selectedMember?.name || 'This member'} has no assignments this month`
							: 'No crew assignments for this month'}
					</p>
				</div>
			)}
		</>
	);
}

function EventCard({
	event,
	index,
	highlightMemberId,
}: {
	event: EventItem;
	index: number;
	highlightMemberId: string | null;
}) {
	const {
		title,
		subtitle,
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

	const sortedAssignments = teamAssignments
		? teamAssignments.toSorted((a, b) => {
				const orderA = a.role?.order ?? 999;
				const orderB = b.role?.order ?? 999;
				if (orderA !== orderB) return orderA - orderB;
				const groupA = a.group || '';
				const groupB = b.group || '';
				return groupA.localeCompare(groupB);
			})
		: [];

	return (
		<article
			className={cn(
				'border border-white/8 rounded-lg overflow-hidden animate-fade-in',
				'transition-opacity duration-500',
				{ 'opacity-25 saturate-0': ended }
			)}
			style={{
				animationDelay: `${(index + 1) * 0.08}s`,
				animationDuration: '1.2s',
				contentVisibility: 'auto',
				containIntrinsicSize: '0 200px',
			}}
		>
			<div className="px-5 py-4 lg:px-6 lg:py-5 border-b border-white/6 bg-white/2">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div className="flex flex-col gap-1.5 lg:gap-2">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<h2 className="t-h-6 font-bold">{title}</h2>
							{categoryTitle && (
								<span
									className="t-l-2 px-2 py-1 rounded uppercase shrink-0"
									style={{
										backgroundColor: categoryBg || 'var(--muted)',
										color: categoryBg ? '#fff' : 'var(--foreground)',
									}}
								>
									{categoryTitle}
								</span>
							)}
						</div>
						{subtitle && <p className="t-b-1">{subtitle}</p>}
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
									className="t-b-1 text-muted-foreground underline underline-offset-2 decoration-white/20 hover:text-foreground hover:decoration-white/40 transition-colors"
								>
									{location}
								</a>
							) : (
								<span className="t-b-1 text-muted-foreground">{location}</span>
							))}
					</div>
				</div>
			</div>

			{/* Assignments */}
			{hasArrayValue(sortedAssignments) && (
				<div className="p-4 lg:p-5">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
						{sortedAssignments.map((assignment) => (
							<AssignmentCard
								key={assignment._key}
								assignment={assignment}
								highlightMemberId={highlightMemberId}
							/>
						))}
					</div>
				</div>
			)}

			{/* Team Notes */}
			{teamNotes && (
				<div className="mx-4 mb-4 lg:mx-5 lg:mb-5 px-4 py-3 bg-white/2 border border-dashed border-white/8 rounded">
					<span className="t-l-2 text-muted-foreground block mb-1">NOTE</span>
					<p className="t-b-1 text-muted-foreground">{teamNotes}</p>
				</div>
			)}
		</article>
	);
}

type Assignment = NonNullable<EventItem['teamAssignments']>[number];

function AssignmentCard({
	assignment,
	highlightMemberId,
}: {
	assignment: Assignment;
	highlightMemberId: string | null;
}) {
	const { role, group, members, note } = assignment;

	const roleTitle = role?.title || 'Role';
	const label = group ? `${roleTitle} ${group} 組` : roleTitle;

	return (
		<div className="bg-white/3 border border-white/6 rounded-md px-3.5 py-2.5">
			<span className="t-b-2 font-semibold uppercase text-indigo-400/90 block mb-2.5">
				{label}
			</span>
			<div className="flex flex-wrap items-center gap-4">
				{members?.map((member) => {
					const name = member.nickname || member.name || 'Unknown';
					const isHighlighted = highlightMemberId === member._id;
					const isDimmed = highlightMemberId !== null && !isHighlighted;
					return (
						<div
							key={member._id}
							data-comp="crew-person"
							className={cn(
								'group/person relative flex items-center gap-1.5 transition-opacity',
								{ 'opacity-30 pointer-events-none': isDimmed }
							)}
						>
							{member.avatar ? (
								<>
									<div
										className={cn(
											'size-6 aspect-square rounded-full overflow-hidden shrink-0 relative transition-all',
											isHighlighted
												? 'ring-2 ring-indigo-400 size-8'
												: 'ring-1 ring-white/10'
										)}
									>
										<SanityImage
											image={member.avatar}
											className="object-cover"
											fill
											sizes="24px"
										/>
									</div>
									{/* Hover enlarged avatar */}
									<div className="size-20 pointer-events-none absolute bottom-full left-0 mb-2 z-20 opacity-0 scale-75 origin-bottom-left transition-all duration-200 ease-out group-hover/person:opacity-100 group-hover/person:scale-100 rounded-full overflow-hidden">
										<SanityImage
											image={member.avatar}
											className="object-cover"
											fill
											sizes="80px"
										/>
									</div>
								</>
							) : (
								<span
									className={cn(
										'size-6 aspect-square rounded-full bg-white/8 shrink-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground',
										isHighlighted
											? 'ring-2 ring-indigo-400'
											: 'ring-1 ring-white/10'
									)}
								>
									{name.charAt(0)}
								</span>
							)}
							<span className="t-b-1 font-medium">{name}</span>
						</div>
					);
				})}
			</div>
			{note && <p className="t-b-2 text-muted-foreground mt-3">{note}</p>}
		</div>
	);
}
