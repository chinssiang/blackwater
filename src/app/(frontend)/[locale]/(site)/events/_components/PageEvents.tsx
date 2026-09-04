'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import CustomLink from '@/components/CustomLink';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { PEventsQueryResult } from 'sanity.types';
import type { WithoutPageMetadata } from '@/lib/defineMetadata';
import {
	formatEventTimeLabel,
	getDaysUntilEvent,
	getTodayKey,
	groupEventsByDay,
	isEventEnded,
} from '@/lib/event-date';
import {
	formatDayKey,
	fromMonthIndex,
	getDayKeyYearMonth,
	monthStartKey,
	toMonthIndex,
	type DayKey,
} from '@/lib/calendar';
import { ArrowUpRight } from '@/components/SvgIcons';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { fadeAnim } from '@/lib/animate';
import { cn, hasArrayValue, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { formatDaysUntilLabel, interpolate } from '@/lib/dictionary';
import { localizePath } from '@/lib/i18n';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { EventStatusItem } from './EventStatusItem';
import { EventsCalendar } from './EventsCalendar';

const EASE_EVENT_ROW = [0, 0.5, 0.5, 1] as const;
const EASE_HEADER = [0, 0.71, 0.2, 1.01] as const;
// Confident ease-out (expo) for the staggered row entrance.
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EVENT_ROW_STAGGER = 0.05;

// Rows rise and fade in as a staggered cascade. Local variant (not the shared
// fadeAnim) so the slide stays scoped to this list; reduced motion collapses it
// via the `initial={false}` guard at the call site.
const eventRowAnim = {
	hide: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0 },
};

// How often the ended/days-until state is re-evaluated once mounted, so a row
// dims at its end time without the visitor reloading.
const CLOCK_TICK_MS = 60 * 1000;

// How far the calendar grid can be paged. The past bound mirrors
// `EVENTS_PAST_WINDOW_MONTHS` in page.tsx — the query fetches no further back,
// so an empty grid beyond it would be a claim we cannot support. Keep the two in
// step. The future bound is presentational: the query has every upcoming event,
// so this is just how far past the last one it stays worth looking.
const CALENDAR_PAST_WINDOW_MONTHS = 12;
const CALENDAR_FUTURE_WINDOW_MONTHS = 12;

/** The two ways this page can render its events. */
type EventsView = 'list' | 'calendar';

const VIEW_TRIGGER_CLASS =
	't-l-2 rounded-full border border-foreground px-2.5 py-1.5 uppercase whitespace-nowrap transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-foreground/5';

// Typed off the QUERY result, not the raw `PEvent` document type: pEvent is
// field-level localized, so on the document every prose field is an
// internationalizedArray, while GROQ hands this component the single resolved
// string for the current locale.
type EventsData = NonNullable<PEventsQueryResult>;
type EventListItem = EventsData['eventList'][number];

interface PageEventsProps {
	data: WithoutPageMetadata<EventsData>;
}

export function PageEvents({ data }: PageEventsProps) {
	const { title, eventList } = data || {};
	const locale = useLocale();
	const t = useTranslations('events');
	const common = useTranslations('common');
	const dateFnsLocale = DATE_FNS_LOCALES[locale];
	const prefersReducedMotion = useReducedMotion();

	// The initialiser re-runs on the client during hydration, so `currentDate`
	// holds the real clock from the first client render even though the
	// prerendered HTML was built with the clock as of the last revalidation.
	const [currentDate, setCurrentDate] = useState(() => new Date());
	const [view, setView] = useState<EventsView>('list');
	// A month index (see `toMonthIndex`), not a {year, month} pair: the two views
	// step through months differently and both comparisons and arithmetic stay
	// integer. Null means "wherever the default lands".
	const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(
		null
	);
	// The other half of the calendar's cursor. It lives here rather than in
	// <EventsCalendar> because Radix unmounts the inactive tab panel, so a
	// child-owned selection would be discarded every time the visitor looked at
	// the list — the same "keeps your place" promise the month above makes.
	const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);

	useEffect(() => {
		const timer = setInterval(() => setCurrentDate(new Date()), CLOCK_TICK_MS);
		return () => clearInterval(timer);
	}, []);

	// Grouped here rather than on the server: the page already serializes
	// `eventList` into this component's props, so a second pre-grouped copy of
	// every event was travelling in the same payload to say the same thing.
	//
	// This is the ONLY timezone-aware pass over the list. Everything below is
	// derived from these day keys with string and integer maths, because a key's
	// `yyyy-MM` prefix is by construction the month the event falls in, in the
	// timezone it was authored in — reading each event again to ask for its month
	// would be the same Intl work a second time for the same answer.
	const eventsByDay = useMemo(() => groupEventsByDay(eventList), [eventList]);

	const eventsByMonth = useMemo(() => {
		const byMonth = new Map<number, EventListItem[]>();
		// Day keys sorted first: `eventsByDay` is in the query's INSTANT order, and
		// for events stored in different timezones that is not the same as civil-day
		// order — concatenating buckets as they were first seen could put a later
		// day above an earlier one in the list view. Keys are zero-padded, so a
		// lexical sort is a chronological one.
		for (const dayKey of [...eventsByDay.keys()].sort()) {
			const index = toMonthIndex(getDayKeyYearMonth(dayKey));
			const bucket = byMonth.get(index);
			if (bucket) bucket.push(...eventsByDay.get(dayKey)!);
			else byMonth.set(index, [...eventsByDay.get(dayKey)!]);
		}
		return byMonth;
	}, [eventsByDay]);

	// Sorted explicitly rather than trusting insertion order: GROQ orders by the
	// absolute instant while these buckets are civil months, and the two can
	// disagree for events stored in different timezones.
	const monthsWithEvents = useMemo(
		() => [...eventsByMonth.keys()].sort((a, b) => a - b),
		[eventsByMonth]
	);

	const todayMonthIndex = toMonthIndex(
		getDayKeyYearMonth(getTodayKey(currentDate))
	);

	// How far the calendar can page. Bounded by what the data can honestly answer,
	// NOT by where the events happen to sit: clamping to the event span made both
	// arrows dead whenever every event fell in the current month, which is exactly
	// the case where "is anything on next month?" is the question being asked.
	//
	// Backwards stops at the query's own cutoff (`EVENTS_PAST_WINDOW_MONTHS` in
	// page.tsx) because older months were never fetched — an empty grid there
	// would claim there were no events when we simply did not ask. Forwards the
	// query has everything, so an empty month is the truth, and a year past the
	// last event is room enough to see that.
	const monthRange = {
		min: Math.min(
			todayMonthIndex - CALENDAR_PAST_WINDOW_MONTHS,
			monthsWithEvents[0] ?? todayMonthIndex
		),
		max:
			Math.max(todayMonthIndex, monthsWithEvents.at(-1) ?? todayMonthIndex) +
			CALENDAR_FUTURE_WINDOW_MONTHS,
	};

	const defaultMonthIndex = useMemo(() => {
		const upcoming = monthsWithEvents.find((index) =>
			eventsByMonth
				.get(index)
				?.some(
					(event) =>
						!isEventEnded(event.eventDatetime, event.endDatetime, currentDate)
				)
		);
		if (upcoming !== undefined) return upcoming;
		// All events are in the past -> open on the most recent month; with no
		// events at all, on the month the visitor is actually in.
		return monthsWithEvents.at(-1) ?? todayMonthIndex;
		// `currentDate` is deliberately omitted: the landing month is a first-render
		// decision. Recomputing it on a clock tick would move the view out from
		// under someone browsing a month they had not explicitly selected.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [monthsWithEvents, eventsByMonth]);

	// One month drives both views, so switching between them keeps your place.
	const currentMonthIndex = selectedMonthIndex ?? defaultMonthIndex;
	const displayEvents = useMemo(
		() => eventsByMonth.get(currentMonthIndex) ?? [],
		[eventsByMonth, currentMonthIndex]
	);

	// Drop the status column only when no row will render a pill. Must mirror all
	// three pill sources in the status <Td> below (CMS status, ended, days-until)
	// -- a pill with no column auto-places into an implicit row at column 1.
	const isHideStatusColumn = useMemo(() => {
		return !displayEvents.some((event) => {
			return (
				event.statusList?.some((item) => item?.eventStatus) ||
				isEventEnded(event.eventDatetime, event.endDatetime, currentDate) ||
				getDaysUntilEvent(event.eventDatetime, currentDate) !== null
			);
		});
	}, [displayEvents, currentDate]);
	const colStyle = isHideStatusColumn
		? 'grid-cols-[60%_1fr] lg:grid-cols-[3fr_1fr_minmax(0,1fr)]'
		: 'grid-cols-[60%_1fr] lg:grid-cols-[3fr_1fr_minmax(0,1fr)_230px]';

	// The two views step differently, and that is the point rather than an
	// inconsistency: the list has no way to render a month with no rows in it, so
	// it moves to the next month that HAS events; the calendar's grid says
	// something real about an empty month, so it moves one month at a time.
	const stepMonth = (direction: -1 | 1): number | null => {
		if (view === 'calendar') {
			const next = currentMonthIndex + direction;
			return next >= monthRange.min && next <= monthRange.max ? next : null;
		}
		return direction < 0
			? (monthsWithEvents.findLast((index) => index < currentMonthIndex) ??
					null)
			: (monthsWithEvents.find((index) => index > currentMonthIndex) ?? null);
	};

	// A day in a leading/trailing padding week belongs to a neighbouring month, so
	// selecting it moves the calendar there rather than showing a panel for a day
	// the header says you are not looking at.
	const selectDay = (day: DayKey) => {
		setSelectedDay(day);
		const dayMonth = toMonthIndex(getDayKeyYearMonth(day));
		if (dayMonth !== currentMonthIndex) setSelectedMonthIndex(dayMonth);
	};

	const goToMonth = (direction: -1 | 1) => {
		const next = stepMonth(direction);
		if (next === null) return;
		setSelectedMonthIndex(next);
		window.scrollTo({ top: 0 });
	};

	// With nothing in the whole window there is no month worth stepping to, and
	// the pre-toggle header hid these controls in exactly that case.
	const hasEventsAnywhere = monthsWithEvents.length > 0;
	const hasPrevious = stepMonth(-1) !== null;
	const hasNext = stepMonth(1) !== null;

	// From the month itself, not from an event inside it: an empty month has no
	// event to take a name from, and the calendar can display one.
	const monthYearDisplay = formatDayKey(
		monthStartKey(fromMonthIndex(currentMonthIndex)),
		t.monthYearFormat,
		dateFnsLocale
	);

	return (
		<div className="min-h-screen p-x-max mx-auto pt-8.5 pb-22.5 lg:pt-16">
			<h1 id="events-heading" className="sr-only">
				{title}
			</h1>
			<Tabs
				value={view}
				onValueChange={(next) => setView(next as EventsView)}
				// The month controls sit in the sticky bar with the tabs but outside
				// both panels: they steer whichever view is showing, and duplicating
				// them per panel would put two of every control in the DOM.
			>
				<div className="flex items-center justify-between gap-2 sm:gap-3 sticky top-header bg-background/95 z-10 font-bold">
					<motion.p
						key={monthYearDisplay}
						initial={prefersReducedMotion ? false : 'hide'}
						animate="show"
						variants={fadeAnim}
						transition={{
							duration: 0.6,
							delay: 0.3,
							ease: EASE_HEADER,
						}}
						className="t-h-3 uppercase"
					>
						{monthYearDisplay}
					</motion.p>
					<div className="flex items-center gap-2 sm:gap-3">
						<TabsList aria-label={t.view.label} className="gap-1.5">
							<TabsTrigger value="list" className={VIEW_TRIGGER_CLASS}>
								{t.view.list}
							</TabsTrigger>
							<TabsTrigger value="calendar" className={VIEW_TRIGGER_CLASS}>
								{t.view.calendar}
							</TabsTrigger>
						</TabsList>
						{hasEventsAnywhere && (
							<div className="flex items-center justify-between gap-1">
								<Button
									onClick={() => goToMonth(-1)}
									disabled={!hasPrevious}
									aria-label={t.aria.previousMonth}
									variant="ghost"
									className="uppercase text-xs font-normal cursor-pointer hover:opacity-60 max-sm:px-1.5"
								>
									<ArrowLeft />
									{/* Label hidden, not dropped: the button keeps its
								    aria-label, and at 375px the month, the view toggle and
								    two worded buttons cannot share one line. */}
									<span className="max-sm:hidden">{t.aria.previousMonth}</span>
								</Button>
								<span aria-hidden className="max-sm:hidden">
									/
								</span>
								<Button
									onClick={() => goToMonth(1)}
									disabled={!hasNext}
									aria-label={t.aria.nextMonth}
									variant="ghost"
									className="uppercase text-xs font-normal cursor-pointer hover:opacity-60 max-sm:px-1.5"
								>
									<span className="max-sm:hidden">{t.aria.nextMonth}</span>
									<ArrowRight className="size-3.5" />
								</Button>
							</div>
						)}
					</div>
				</div>

				<TabsContent value="calendar">
					<EventsCalendar
						monthIndex={currentMonthIndex}
						eventsByDay={eventsByDay}
						currentDate={currentDate}
						selectedDay={selectedDay}
						onSelectDay={selectDay}
					/>
				</TabsContent>

				<TabsContent value="list">
					{hasArrayValue(displayEvents) ? (
						<div
							className="mt-10 lg:mt-17.5"
							role="table"
							aria-labelledby="events-heading"
						>
							<div
								role="row"
								className={cn(
									't-b-1 uppercase grid border-y border-b border-foreground/80 py-2 lg:py-6',
									colStyle
								)}
							>
								<Th className="lg:pl-0">{t.headers.codex}</Th>
								<Th
									isHideStatusColumn={isHideStatusColumn}
									className="text-right lg:text-left"
								>
									{t.headers.time}
								</Th>
								<Th
									isHideStatusColumn={isHideStatusColumn}
									className="hidden lg:block"
								>
									{t.headers.location}
								</Th>
								{!isHideStatusColumn && (
									<Th
										isHideStatusColumn={isHideStatusColumn}
										className="hidden lg:block text-right"
									>
										{t.headers.status}
									</Th>
								)}
							</div>
							{displayEvents.map((item, index) => {
								const {
									title,
									subtitle,
									_id,
									slug,
									statusList,
									eventDatetime,
									endDatetime,
									dateStatus,
									location,
									locationLink,
								} = item || {};

								// The generated query type already carries locationRef; the cast
								// this replaces would have hidden it if eventCardFields ever
								// dropped the deref.
								const locationRef = item?.locationRef;
								const displayLocation = locationRef?.name || location;
								const displayLocationLink =
									locationRef?.mapLink || locationLink;

								const eventHasEnded = isEventEnded(
									eventDatetime,
									endDatetime,
									currentDate
								);
								const daysUntil = getDaysUntilEvent(eventDatetime, currentDate);

								return (
									<motion.div
										key={_id}
										role="row"
										className={cn(
											'relative t-b-1 transition-colors hover:bg-foreground/85 grid items-center border-b group py-4 border-foreground/80 lg:py-2 lg:min-h-15 group/row',
											colStyle,
											{
												'pointer-events-none': eventHasEnded,
											}
										)}
										initial={prefersReducedMotion ? false : 'hide'}
										animate="show"
										variants={eventRowAnim}
										transition={{
											duration: 1.2,
											delay: 0.3 + index * EVENT_ROW_STAGGER,
											ease: EASE_OUT_EXPO,
										}}
									>
										<Td
											className={cn(
												'font-bold uppercase lg:pl-0 t-b-1 lg:flex flex-wrap items-center gap-2.5 text-balance group-hover/row:translate-x-1 transition-transform',
												{
													'opacity-30': eventHasEnded,
												}
											)}
										>
											<p className="text-balance mb-4 lg:mb-0">{title}</p>
											{subtitle && (
												<p className="text-muted-foreground text-balance group-hover/row:text-muted">
													{subtitle}
												</p>
											)}
										</Td>
										<Td
											className={cn(
												'static t-b-1 uppercase mb-auto text-right lg:text-left lg:mb-0',
												{
													'opacity-30': eventHasEnded,
												}
											)}
										>
											{formatEventTimeLabel(
												item,
												t.dateFormat,
												t.status,
												dateFnsLocale
											)}

											<Link
												className={cn('p-fill', OVERLAY_LINK_FOCUS)}
												href={localizePath(`/events/${slug}`, locale)}
												aria-label={interpolate(t.aria.viewEvent, {
													title: title || '',
												})}
											/>
										</Td>
										<Td
											className={cn(
												't-b-1 uppercase text-balance mt-2 lg:mt-0 whitespace-pre-line wrap-break-word min-w-0 group/location',
												{
													'opacity-30': eventHasEnded,
												}
											)}
										>
											{displayLocation}
											{displayLocationLink && (
												<span className="whitespace-nowrap -translate-y-0.25 ml-1 inline-block group-hover/location:translate-x-0.5 group-hover/location:-translate-y-0.5 transition-transform">
													&#8203;
													<ArrowUpRight className="size-2 inline-block" />
												</span>
											)}
											{displayLocationLink && (
												<CustomLink
													className={cn(
														'p-fill increase-target-size',
														OVERLAY_LINK_FOCUS
													)}
													link={{ href: displayLocationLink, isNewTab: true }}
													aria-label={interpolate(t.aria.viewLocation, {
														location: displayLocation || '',
													})}
												/>
											)}
										</Td>
										<Td
											className={
												'lg:justify-end gap-1 flex flex-wrap min-w-0 col-start-1 lg:col-start-[unset] mt-6 lg:mt-0'
											}
										>
											{!eventHasEnded && daysUntil !== null && (
												<EventStatusItem
													key={`in-${daysUntil}-day`}
													data={{
														eventStatus: {
															title: formatDaysUntilLabel(daysUntil, t),
														},
													}}
												/>
											)}
											{hasArrayValue(statusList) &&
												statusList.map((item: any) => (
													<EventStatusItem
														key={item._key}
														data={item}
														className={cn(eventHasEnded ? 'opacity-30' : '')}
													/>
												))}
											{eventHasEnded && (
												<EventStatusItem
													key="ended"
													data={{ eventStatus: { title: t.status.ended } }}
												/>
											)}
										</Td>
									</motion.div>
								);
							})}
						</div>
					) : (
						<p className="py-8 text-center">{t.emptyMonth}</p>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

function Th({
	isHideStatusColumn,
	className,
	...props
}: React.ComponentProps<typeof motion.div> & {
	isHideStatusColumn?: boolean;
}) {
	const prefersReducedMotion = useReducedMotion();
	return (
		<motion.div
			key={String(isHideStatusColumn)}
			initial={prefersReducedMotion ? false : 'hide'}
			animate="show"
			variants={fadeAnim}
			transition={{
				duration: 0.6,
				delay: 0.3,
				ease: EASE_EVENT_ROW,
			}}
			className={cn('font-bold lg:px-2', className)}
			role="columnheader"
			{...props}
		/>
	);
}
function Td({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				'lg:px-2 whitespace-nowrap text-foreground group-hover:text-background transition-colors empty:hidden relative',
				className
			)}
			role="cell"
			{...props}
		/>
	);
}
