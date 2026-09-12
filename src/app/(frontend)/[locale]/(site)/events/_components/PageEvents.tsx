'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import CustomLink from '@/components/CustomLink';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { PEventsQueryResult } from 'sanity.types';
import type { WithoutPageMetadata } from '@/lib/defineMetadata';
import {
	getDaysUntilEvent,
	getNextEventClockTransition,
	getTodayKey,
	groupEventsByDay,
	isEventEnded,
	resolveEventTimeLabel,
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
import { tabsTriggerVariants } from '@/components/ui/tabsTriggerVariants';
import { EASE_OUT_EXPO, fadeAnim } from '@/lib/animate';
import { cn, hasArrayValue, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { formatDaysUntilLabel, interpolate } from '@/lib/dictionary';
import { resolveEventLocation } from '@/lib/event-location';
import { resolveHref } from '@/lib/routes';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import EventStatusPill from '@/components/EventStatusPill';
import { EventsCalendar } from './EventsCalendar';

const EASE_EVENT_ROW = [0, 0.5, 0.5, 1] as const;
const EASE_HEADER = [0, 0.71, 0.2, 1.01] as const;
// One cadence for every entrance and every row — a first paint and a return
// from the calendar cascade at the same rhythm, and only the per-row fade
// below is shortened on a return. Both of the obvious ways to make a return
// brisker by touching this instead were tried and are worse: a tighter
// interval makes the rows read as arriving together rather than in sequence,
// and capping the accumulation (as `revealStagger` does in `lib/animate.ts`,
// where an unbounded grid justifies it) lands everything past the cap in one
// group, which is a harder edge than the long tail it replaces. A month here
// holds a dozen or so events, so the tail is bounded by the data anyway.
const EVENT_ROW_STAGGER = 0.05;
const EVENT_ROW_DURATION = 1.2;
// Nothing after the first paint is a page load. Replaying the full 1.2s
// flourish on every view toggle made coming back to the list a ~2.1s wait
// against the calendar's 0.35s grid fade, and one control settling six times
// apart depending on direction is what read as the switch being rough — not
// the cross-fade itself. A month step remounts every row too and had the same
// problem. So each row fades over this instead once the page has painted,
// which keeps the cadence identical and lands the last row at ~1.25s.
const EVENT_ROW_SWAP_DURATION = 0.35;
const VIEW_SWAP_DURATION = 0.3;
const CONTENT_ENTER_DELAY = 0.2;
const eventRowAnim = {
	hide: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0 },
};

const CALENDAR_PAST_WINDOW_MONTHS = 12;
const CALENDAR_FUTURE_WINDOW_MONTHS = 12;

/** The two ways this page can render its events. */
type EventsView = 'list' | 'calendar';

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
	// Motion's own hook, NOT `usePrefersReducedMotion`, and the exception to what
	// CLAUDE.md says — because this value only ever feeds `initial`, which Motion
	// captures once at mount, and the list is the DEFAULT view, so it mounts
	// during hydration. The store hook is a `useSyncExternalStore` whose
	// `getServerSnapshot` is `false`, and React uses that snapshot for the
	// hydration render, so it answers `false` on exactly the render that matters
	// and correcting a tick later cannot un-capture an `initial`: a visitor with
	// Reduce Motion on got the full cascade anyway. Motion's hook reads
	// `matchMedia` DURING render and seeds its state from it, so it is right on
	// that first client render, and the staleness it is criticised for — never
	// updating on an OS toggle mid-session — cannot matter to a prop read once.
	// Prefer the store hook anywhere the answer is read continuously, which is
	// why `EventsCalendar` (mounted only by a toggle, long after hydration)
	// correctly uses it.
	const prefersReducedMotion = useReducedMotion();

	const [currentDate, setCurrentDate] = useState(() => new Date());
	const [view, setView] = useState<EventsView>('list');
	// Whether anything has been on screen yet. Read during render to tell the
	// list's FIRST paint from every arrival after it — see the row duration
	// below. Deliberately derived from the page's own lifecycle rather than
	// written by the view toggle's onClick: the button is not the only thing
	// that can remount these rows (a month step remounts every one of them, and
	// any future writer of `view` — a deep link, a shortcut — would too), and a
	// flag owned by one control is wrong for all of them. The same reason
	// `slideDirection` reads the month delta instead of taking a prop from the
	// arrows, and `hasPrevious`/`hasNext` derive from `stepMonth`.
	const hasPainted = useRef(false);
	useEffect(() => {
		hasPainted.current = true;
	}, []);
	const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(
		null
	);
	const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);

	useEffect(() => {
		const timer = setTimeout(
			() => setCurrentDate(new Date()),
			Math.max(
				getNextEventClockTransition(eventList, currentDate) - Date.now(),
				0
			)
		);
		return () => clearTimeout(timer);
	}, [eventList, currentDate]);

	// Grouped here rather than on the server: the page already serializes
	// `eventList` into this component's props, so a second pre-grouped copy of
	// every event was travelling in the same payload to say the same thing.
	//
	// The only timezone-aware pass over the list in THIS file (the clock schedule
	// above makes its own, inside `event-date.ts`). Everything below is derived
	// from these day keys with string and integer maths, because a key's
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
			const dayEvents = eventsByDay.get(dayKey)!;
			const index = toMonthIndex(getDayKeyYearMonth(dayKey));
			const bucket = byMonth.get(index);
			if (bucket) bucket.push(...dayEvents);
			else byMonth.set(index, [...dayEvents]);
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

	// Every clock- and locale-derived answer a row needs, resolved once per row
	// rather than once per render — the same hoist the calendar's grid memo makes
	// for its chips, applied to the view that renders first. It also collapses a
	// duplicate walk: `isHideStatusColumn` below used to re-run `isEventEnded`
	// and `getDaysUntilEvent` over the same events the row loop had just asked.
	//
	// `daysUntil` is gated on the label's own `isFirm`, because a cancelled event
	// two days out must not answer CANCELLED and "in 2 days" in one row.
	const rows = useMemo(
		() =>
			displayEvents.map((event) => {
				const { label: timeLabel, isFirm } = resolveEventTimeLabel(
					event,
					t.dateFormat,
					t,
					dateFnsLocale
				);
				return {
					event,
					timeLabel,
					hasEnded: isEventEnded(
						event.eventDatetime,
						event.endDatetime,
						currentDate
					),
					daysUntil: isFirm
						? getDaysUntilEvent(event.eventDatetime, currentDate)
						: null,
				};
			}),
		[displayEvents, currentDate, t, dateFnsLocale]
	);

	// Drop the status column only when no row will render a pill. Must mirror all
	// three pill sources in the status <Td> below (CMS status, ended, days-until)
	// -- a pill with no column auto-places into an implicit row at column 1.
	const isHideStatusColumn = useMemo(
		() =>
			!rows.some(
				({ event, hasEnded, daysUntil }) =>
					event.statusList?.some((item) => item?.eventStatus) ||
					hasEnded ||
					daysUntil !== null
			),
		[rows]
	);
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

	// Derived from the same `stepMonth` the buttons call, so "can this control do
	// anything" has ONE answer. The predicate this replaced was
	// `monthsWithEvents.length > 0` — right for a list, which cannot render a
	// month with no rows, but wrong for a grid: with an empty window `monthRange`
	// is still today ± 12, so both arrows computed `true` and were then hidden,
	// freezing the calendar on one month.
	const hasPrevious = stepMonth(-1) !== null;
	const hasNext = stepMonth(1) !== null;

	// From the month itself, not from an event inside it: an empty month has no
	// event to take a name from, and the calendar can display one.
	// The view the button switches TO — derived once, because the click, the
	// aria-label and the visible label are three readings of one fact.
	const nextView: EventsView = view === 'list' ? 'calendar' : 'list';

	const rowDuration = hasPainted.current
		? EVENT_ROW_SWAP_DURATION
		: EVENT_ROW_DURATION;

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
			{/* The month controls sit in the sticky bar beside the view toggle but
			    outside either view: they steer whichever one is showing, and
			    duplicating them per view would put two of every control in the DOM. */}
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
					className="t-l-0 uppercase"
				>
					{monthYearDisplay}
				</motion.p>
				<div className="flex items-center gap-2 sm:gap-3">
					<button
						type="button"
						onClick={() => {
							setView(nextView);
							window.scrollTo({ top: 0 });
						}}
						aria-label={t.aria.switchTo[nextView]}
						className={cn(
							tabsTriggerVariants({ variant: 'pill', size: 'sm' }),
							// Both labels stacked in one grid cell, so the pill is always
							// sized by the longer of the two and does not resize when the
							// view flips. Derived rather than a fixed `min-w-*`: a hardcoded
							// width is unrelated to the strings, so a longer translation
							// silently outgrows it and the resize comes back with nothing
							// failing. `view` and `nextView` are always the two distinct
							// views, so the pair covers both words in every locale.
							'grid place-items-center'
						)}
					>
						<span className="col-start-1 row-start-1">{t.view[nextView]}</span>
						{/* The spacer. `invisible` is visibility:hidden, so it holds its
						    box and stays out of the a11y tree — and the button's
						    aria-label names it regardless. */}
						<span className="invisible col-start-1 row-start-1">
							{t.view[view]}
						</span>
					</button>
					{(hasPrevious || hasNext) && (
						<div className="flex items-center justify-between gap-1">
							<Button
								onClick={() => goToMonth(-1)}
								disabled={!hasPrevious}
								aria-label={t.aria.previousMonth}
								variant="ghost"
								className="uppercase t-l-2 font-normal cursor-pointer hover:opacity-60 max-sm:px-1.5"
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
								className="uppercase t-l-2 font-normal cursor-pointer hover:opacity-60 max-sm:px-1.5"
							>
								<span className="max-sm:hidden">{t.aria.nextMonth}</span>
								<ArrowRight className="size-3.5" />
							</Button>
						</div>
					)}
				</div>
			</div>

			{/* The two views cross-fade rather than cutting: the one being left
			    behind fades out while the arriving one is already running its own
			    entrance, so the switch is one movement.

			    `mode="popLayout"` because the views are wildly different heights.
			    It measures the leaving view and pins it `position: absolute` at
			    the box it occupied, so the arriving view takes its place in flow
			    on the first frame and NOTHING BELOW MOVES. Under the default
			    `sync` the two would be siblings in normal flow and the arriving
			    view would sit ~700px down the page until the fade finished;
			    under `wait` this container would collapse to nothing between
			    them. The cost of `popLayout`, accepted: when the arriving view
			    is the shorter one, the leaving view overhangs this container and
			    paints over what follows for those 0.2s. Clipping that with
			    `overflow-hidden` turns the fade into a wipe, which is worse.

			    This `relative` wrapper is what makes the pin land correctly:
			    Motion positions the leaving element against its `offsetParent`,
			    and with no positioned ancestor that is the body, which puts the
			    fading view somewhere else on the page entirely.

			    Both wrappers animate EXIT ONLY. Each view already owns its
			    entrance — the row cascade below, the calendar's grid fade — and
			    a wrapper fade-in on top would multiply two opacity curves and
			    make arriving slower, not smoother. `initial={false}` is not
			    tidiness either: it mounts the wrapper at `show`, so the
			    prerendered HTML carries no `opacity: 0` and the list is visible
			    with no JS. No reduced-motion guard, because an opacity fade may
			    keep running under it; nothing here transforms. */}
			<div className="relative">
				<AnimatePresence mode="popLayout">
					{view === 'calendar' && (
						<motion.div
							key="calendar"
							initial={false}
							animate="show"
							exit="hide"
							variants={fadeAnim}
							transition={{
								duration: VIEW_SWAP_DURATION,
								ease: EASE_EVENT_ROW,
							}}
						>
							<EventsCalendar
								monthIndex={currentMonthIndex}
								eventsByDay={eventsByDay}
								currentDate={currentDate}
								selectedDay={selectedDay}
								onSelectDay={selectDay}
							/>
						</motion.div>
					)}

					{/* One wrapper around BOTH outcomes of the list branch, so a view
					    switch is one presence change rather than two. */}
					{view === 'list' && (
						<motion.div
							key="list"
							initial={false}
							animate="show"
							exit="hide"
							variants={fadeAnim}
							transition={{
								duration: VIEW_SWAP_DURATION,
								ease: EASE_EVENT_ROW,
							}}
						>
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
									{rows.map(
										(
											{ event: item, timeLabel, hasEnded, daysUntil },
											index
										) => {
											const { title, subtitle, _id, slug, statusList } =
												item || {};

											// Through the route table, like the calendar panel: the
											// hand-built path this replaces linked to `/events/null`
											// whenever an event had no slug.
											const href = slug
												? resolveHref({ documentType: 'pEvent', slug, locale })
												: null;

											const {
												name: displayLocation,
												mapLink: displayLocationLink,
											} = resolveEventLocation(item);

											return (
												<motion.div
													key={_id}
													role="row"
													className={cn(
														'relative t-b-1 transition-colors hover:bg-foreground/85 grid items-center border-b group py-4 border-foreground/80 lg:py-2 lg:min-h-15 group/row',
														colStyle,
														{
															'pointer-events-none': hasEnded,
														}
													)}
													initial={prefersReducedMotion ? false : 'hide'}
													animate="show"
													variants={eventRowAnim}
													transition={{
														duration: rowDuration,
														delay:
															CONTENT_ENTER_DELAY +
															index * EVENT_ROW_STAGGER,
														ease: EASE_OUT_EXPO,
													}}
												>
													<Td
														className={cn(
															'font-bold uppercase lg:pl-0 t-b-1 lg:flex flex-wrap items-center gap-2.5 text-balance transition-transform duration-300 ease-out group-hover/row:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/row:translate-x-0',
															{
																'opacity-30': hasEnded,
															}
														)}
													>
														<p className="text-balance mb-4 lg:mb-0">{title}</p>
														{subtitle && (
															<p className="text-muted-foreground text-balance transition-colors group-hover/row:text-muted">
																{subtitle}
															</p>
														)}
													</Td>
													<Td
														className={cn(
															'static t-b-1 uppercase mb-auto text-right lg:text-left lg:mb-0',
															{
																'opacity-30': hasEnded,
															}
														)}
													>
														{timeLabel}

														{href && (
															<Link
																className={cn('p-fill', OVERLAY_LINK_FOCUS)}
																href={href}
																aria-label={interpolate(t.aria.viewEvent, {
																	title: title || '',
																})}
															/>
														)}
													</Td>
													<Td
														className={cn(
															't-b-1 uppercase text-balance mt-2 lg:mt-0 whitespace-pre-line wrap-break-word min-w-0 group/location',
															{
																'opacity-30': hasEnded,
															}
														)}
													>
														{displayLocation}
														{displayLocationLink && (
															<span className="whitespace-nowrap -translate-y-px ml-1 inline-block transition-transform duration-300 ease-out group-hover/location:translate-x-0.5 group-hover/location:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/location:translate-x-0 motion-reduce:group-hover/location:translate-y-0">
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
																link={{
																	href: displayLocationLink,
																	isNewTab: true,
																}}
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
														{!hasEnded && daysUntil !== null && (
															<EventStatusPill
																key={`in-${daysUntil}-day`}
																className="py-2"
																data={{
																	eventStatus: {
																		title: formatDaysUntilLabel(daysUntil, t),
																	},
																}}
															/>
														)}
														{hasArrayValue(statusList) &&
															statusList.map((item: any) => (
																<EventStatusPill
																	key={item._key}
																	data={item}
																	className={cn(
																		'py-2',
																		hasEnded && 'opacity-30'
																	)}
																/>
															))}
														{hasEnded && (
															<EventStatusPill
																key="ended"
																className="py-2"
																data={{
																	eventStatus: { title: t.status.ended },
																}}
															/>
														)}
													</Td>
												</motion.div>
											);
										}
									)}
								</div>
							) : (
								<p className="py-8 text-center">{t.emptyMonth}</p>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
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
	// Motion's hook for the same reason as the list rows above: `initial` is
	// captured at mount, and this header mounts during hydration with them.
	const prefersReducedMotion = useReducedMotion();
	return (
		<motion.div
			key={String(isHideStatusColumn)}
			initial={prefersReducedMotion ? false : 'hide'}
			animate="show"
			variants={fadeAnim}
			transition={{
				// Short enough to land before the rows it labels in BOTH cases: at
				// 0.6s it was still fading in after the first row of a re-entry had
				// already settled, which put the header behind the content it names.
				duration: 0.3,
				// In step with the rows below: this header remounts with them on a
				// view switch, and at the old 0.3s it arrived after content it
				// labels.
				delay: CONTENT_ENTER_DELAY,
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
