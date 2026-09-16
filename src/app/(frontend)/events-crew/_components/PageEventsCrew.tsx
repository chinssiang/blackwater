'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { formatRichDate, isEventEnded } from '@/lib/event-date';
import { resolveEventLocation } from '@/lib/event-location';
import { buildRgbaCssString } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { hasArrayValue } from '@/lib/utils';
import SanityImage from '@/components/SanityImage';
import { buttonVariants } from '@/components/ui/Button';
import type {
	EventCrewByMonthQueryResult,
	EventCrewMembersQueryResult,
	RichDate,
} from 'sanity.types';

type EventItem = NonNullable<EventCrewByMonthQueryResult>[number];

const DAY_MAP: Record<string, string> = {
	Sun: '日',
	Mon: '一',
	Tue: '二',
	Wed: '三',
	Thu: '四',
	Fri: '五',
	Sat: '六',
};

function formatEventDate(datetime: RichDate) {
	const monthDay = formatRichDate(datetime, 'M/dd');
	const dayOfWeek = formatRichDate(datetime, 'EEE');
	const zhDay = DAY_MAP[dayOfWeek] || dayOfWeek;
	const time = formatRichDate(datetime, 'HH:mm');
	return {
		display: `${monthDay}（${zhDay}）${time}`,
	};
}

// Crew often have this page open through an event, so the ended badge is
// re-evaluated on a timer rather than only at render.
const CLOCK_TICK_MS = 60 * 1000;

function keyToMonthParam(key: string): string {
	const [year, month] = key.split('_');
	return `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
}

function keyToDisplay(key: string): string {
	const [year, month] = key.split('_');
	return `${year}年${Number(month) + 1}月`;
}

type UniqueMember = NonNullable<EventCrewMembersQueryResult>[number];

interface PageEventCrewProps {
	events: EventItem[];
	activeKey: string | null;
	availableMonthKeys: string[];
	uniqueMembers: UniqueMember[];
	selectedMember: UniqueMember | null;
}

/**
 * One arrow in the month pager. Renders a plain <span> when there is no month
 * that way, rather than a link that is styled as disabled: `pointer-events-none`
 * does not take an anchor out of the tab order and `aria-disabled` is only
 * advisory, so a keyboard user could still reach the arrow and navigate to the
 * `#` placeholder. No target, no link — the same shape `ui/Pagination` uses.
 */
function MonthNavLink({
	href,
	children,
}: {
	href: string | null;
	children: ReactNode;
}) {
	const className = cn(
		buttonVariants({ variant: 'ghost', size: 'sm' }),
		't-l-2 uppercase'
	);

	if (!href) return <span className={className}>{children}</span>;

	return (
		<Link
			href={href}
			className={cn(className, 'cursor-pointer hover:opacity-60')}
		>
			{children}
		</Link>
	);
}

export function PageEventCrew({
	events,
	activeKey,
	availableMonthKeys,
	uniqueMembers,
	selectedMember,
}: PageEventCrewProps) {
	const router = useRouter();
	const [scrolled, setScrolled] = useState(false);
	// This page renders per request, so the initial value is current on both
	// sides; the interval is what keeps a long-open tab honest.
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
		return () => clearInterval(timer);
	}, []);

	const setSelectedMemberSlug = useCallback(
		(slug: string | null) => {
			const params = new URLSearchParams(window.location.search);
			if (slug) {
				params.set('member', slug);
			} else {
				params.delete('member');
			}
			router.replace(`?${params.toString()}`);
		},
		[router]
	);

	useEffect(() => {
		const lgQuery = window.matchMedia('(min-width: 1024px)');

		const handleScroll = () => {
			if (!lgQuery.matches) {
				setScrolled(false);
				return;
			}
			setScrolled((prev) => {
				if (prev) return window.scrollY > 10;
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
					'top-header bg-background/95 sticky z-10 border-b border-white/6 backdrop-blur-sm transition-all duration-300',
					scrolled ? 'py-2' : 'py-4'
				)}
			>
				<div className="p-x-max flex items-end justify-between gap-4">
					<div className="space-y-2">
						<span
							className={cn(
								'text-muted-foreground animate-fade-in block overflow-hidden uppercase transition-all duration-300',
								scrolled ? 't-b-1' : 't-l-0'
							)}
						>
							Crew briefing
						</span>
						{/* Size is deliberately scroll-invariant; only the kicker responds. */}
						<h1
							className="t-l-0 animate-fade-in font-bold"
							style={{ animationDelay: '0.15s' }}
						>
							{monthDisplay}
						</h1>
					</div>
					{availableMonthKeys.length > 0 && (
						<nav className="flex shrink-0 items-center gap-1">
							<MonthNavLink href={prevHref}>
								<ArrowLeft className="size-3.5" />
								Prev
							</MonthNavLink>
							<span className="text-xs text-white/20 select-none">/</span>
							<MonthNavLink href={nextHref}>
								Next
								<ArrowRight className="size-3.5" />
							</MonthNavLink>
						</nav>
					)}
				</div>
				{/* Crew Filter */}
				{uniqueMembers.length > 0 && (
					<div className="p-x-max mx-auto mt-3 flex items-center gap-1.5 border-t border-white/4 pt-3 lg:gap-2">
						<span className="t-l-2 text-muted-foreground shrink-0 uppercase">
							Filter
						</span>
						<div className="relative min-w-0 flex-1">
							<div className="from-background pointer-events-none absolute inset-y-0 -left-px z-10 w-6 bg-linear-to-r to-transparent lg:hidden" />
							<div className="from-background pointer-events-none absolute inset-y-0 -right-px z-10 w-6 bg-linear-to-l to-transparent lg:hidden" />
							<div className="flex scrollbar-none items-center gap-1 overflow-x-auto px-2 lg:flex-wrap lg:gap-1.5 lg:px-0">
								{uniqueMembers.map((member) => {
									const displayName =
										member.nickname || member.name || 'Unknown';
									const isActive = selectedMember?.slug === member.slug;
									return (
										<button
											key={member._id}
											type="button"
											onClick={() =>
												setSelectedMemberSlug(isActive ? null : member.slug)
											}
											className={cn(
												't-b-2 flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-1 whitespace-nowrap transition-all lg:px-2.5',
												isActive
													? 'text-foreground bg-white/30 ring-1 ring-white/20'
													: 'text-muted-foreground hover:text-foreground bg-white/4 hover:bg-white/25'
											)}
										>
											{member.avatar ? (
												<div className="relative aspect-square size-4 shrink-0 overflow-hidden rounded-full">
													<SanityImage
														image={member.avatar}
														className="object-cover"
														fill
														alt={displayName}
														sizes="120px"
													/>
												</div>
											) : (
												<span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
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
								onClick={() => setSelectedMemberSlug(null)}
								className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer rounded-full p-1 transition-colors hover:bg-white/8"
							>
								<X className="size-3.5" />
							</button>
						)}
					</div>
				)}
			</div>
			{hasArrayValue(events) ? (
				<div className="p-x-max space-y-6 py-8">
					{selectedMember && (
						<p className="t-b-1 text-muted-foreground">
							<span className="text-foreground font-bold">
								{selectedMember.nickname || selectedMember.name}
							</span>{' '}
							is assigned to{' '}
							<span className="text-foreground font-bold">{events.length}</span>{' '}
							event
							{events.length !== 1 ? 's' : ''} this month
						</p>
					)}
					{events.map((event, index) => (
						<EventCard
							key={event._id}
							event={event}
							index={index}
							highlightMemberSlug={selectedMember?.slug || null}
							now={now}
						/>
					))}
				</div>
			) : (
				<div className="py-20 text-center">
					<p className="t-b-1 text-muted-foreground">
						{selectedMember
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
	highlightMemberSlug,
	now,
}: {
	event: EventItem;
	index: number;
	highlightMemberSlug: string | null;
	now: Date;
}) {
	const {
		title,
		subtitle,
		eventDatetime,
		endDatetime,
		categories,
		teamAssignments,
		teamNotes,
	} = event;

	const { name: displayLocation, mapLink: displayLocationLink } =
		resolveEventLocation(event);

	const ended = isEventEnded(eventDatetime, endDatetime, now);
	const dateInfo = eventDatetime ? formatEventDate(eventDatetime) : null;

	const categoryTitle = categories?.[0]?.title;
	const categoryColor = categories?.[0]?.categoryColor as
		Parameters<typeof buildRgbaCssString>[0] | undefined;
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
		<div
			className={cn(
				'animate-fade-in overflow-hidden rounded-lg border border-white/8',
				'transition-opacity duration-500'
			)}
			style={{
				animationDelay: `${(index + 1) * 0.08}s`,
				animationDuration: '1.2s',
				contentVisibility: 'auto',
				containIntrinsicSize: '0 200px',
			}}
		>
			<div className="border-b border-white/6 bg-white/2 px-5 py-4 lg:px-6 lg:py-5">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div className="flex flex-col gap-1.5 lg:gap-2">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<h2 className="t-b-1 font-bold">{title}</h2>
							{categoryTitle && (
								<span
									className="t-l-2 shrink-0 rounded px-2 py-1 uppercase"
									style={{
										backgroundColor: categoryBg || 'var(--muted)',
										color: categoryBg ? '#fff' : 'var(--foreground)',
									}}
								>
									{categoryTitle}
								</span>
							)}
							{ended && (
								<span className="t-l-2 text-foreground shrink-0 rounded bg-amber-700 px-2 py-1 uppercase">
									結束
								</span>
							)}
						</div>
						{subtitle && <p className="t-b-1">{subtitle}</p>}
					</div>
					<div className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1">
						{dateInfo && (
							<span className="t-b-1 text-foreground font-medium tabular-nums">
								{dateInfo.display}
							</span>
						)}
						{displayLocation &&
							(displayLocationLink ? (
								<a
									href={displayLocationLink}
									target="_blank"
									rel="noopener noreferrer"
									className="t-b-1 text-muted-foreground hover:text-foreground underline decoration-white/20 underline-offset-2 transition-colors hover:decoration-white/40"
								>
									{displayLocation}
								</a>
							) : (
								<span className="t-b-1 text-muted-foreground">
									{displayLocation}
								</span>
							))}
					</div>
				</div>
			</div>

			{/* Assignments */}
			{hasArrayValue(sortedAssignments) && (
				<div className="p-4 lg:p-5">
					<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{sortedAssignments.map((assignment) => (
							<AssignmentCard
								key={assignment._key}
								assignment={assignment}
								highlightMemberSlug={highlightMemberSlug}
							/>
						))}
					</div>
				</div>
			)}

			{/* Team Notes */}
			{teamNotes && (
				<div className="mx-4 mb-4 rounded border border-dashed border-white/8 bg-white/2 px-4 py-3 lg:mx-5 lg:mb-5">
					<span className="t-l-2 text-muted-foreground mb-1 block">NOTE</span>
					<p className="t-b-1 text-muted-foreground">{teamNotes}</p>
				</div>
			)}
		</div>
	);
}

type Assignment = NonNullable<EventItem['teamAssignments']>[number];

function AssignmentCard({
	assignment,
	highlightMemberSlug,
}: {
	assignment: Assignment;
	highlightMemberSlug: string | null;
}) {
	const { role, group, members, note } = assignment;

	const roleTitle = role?.title || 'Role';
	const label = group ? `${roleTitle} ${group} 組` : roleTitle;

	return (
		<div className="rounded-md border border-white/6 bg-white/3 px-3.5 py-2.5">
			<span className="t-b-2 mb-2.5 block font-semibold text-indigo-400/90 uppercase">
				{label}
			</span>
			<div className="flex flex-wrap items-center gap-4">
				{members?.map((member) => {
					const name = member.nickname || member.name || 'Unknown';
					const isHighlighted = highlightMemberSlug === member.slug;
					const isDimmed = highlightMemberSlug !== null && !isHighlighted;
					return (
						<div
							key={member._id}
							data-comp="crew-person"
							tabIndex={isDimmed ? -1 : 0}
							className={cn(
								'group/person relative flex items-center gap-1.5 transition-opacity outline-none',
								{ 'pointer-events-none opacity-30': isDimmed }
							)}
						>
							{member.avatar ? (
								<>
									<div
										className={cn(
											'relative aspect-square size-6 shrink-0 overflow-hidden rounded-full transition-all',
											isHighlighted
												? 'size-8 ring-2 ring-indigo-400'
												: 'ring-1 ring-white/10'
										)}
									>
										<SanityImage
											image={member.avatar}
											className="object-cover"
											alt={member.nickname || 'member avatar'}
											fill
											sizes="120px"
										/>
									</div>
									{/* Hover enlarged avatar */}
									<div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 size-20 origin-bottom-left scale-75 overflow-hidden rounded-full opacity-0 transition-all duration-200 ease-out group-focus-within/person:scale-100 group-focus-within/person:opacity-100 group-hover/person:scale-100 group-hover/person:opacity-100">
										<SanityImage
											image={member.avatar}
											className="object-cover"
											fill
											alt={member.nickname || 'member avatar'}
											sizes="240px"
										/>
									</div>
								</>
							) : (
								<span
									className={cn(
										'text-muted-foreground flex aspect-square size-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-semibold',
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
