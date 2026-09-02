'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import CustomLink from '@/components/CustomLink';
import EventStatusPill from '@/components/EventStatusPill';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { PEventsQueryResult } from 'sanity.types';
import type { WithoutPageMetadata } from '@/lib/defineMetadata';
import {
	formatRichDate,
	getDaysUntilEvent,
	getRichDateInstant,
	getRichDateYearMonth,
	isEventEnded,
} from '@/lib/event-date';
import { ArrowUpRight } from '@/components/SvgIcons';
import { Button } from '@/components/ui/Button';
import { fadeAnim } from '@/lib/animate';
import { cn, hasArrayValue, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { formatDaysUntilLabel, interpolate } from '@/lib/dictionary';
import { resolveEventDateStatus } from '@/lib/event-status';
import { localizePath } from '@/lib/i18n';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';

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

// Typed off the QUERY result, not the raw `PEvent` document type: pEvent is
// field-level localized, so on the document every prose field is an
// internationalizedArray, while GROQ hands this component the single resolved
// string for the current locale.
type EventsData = NonNullable<PEventsQueryResult>;
type EventListItem = EventsData['eventList'][number];

interface PageEventsProps {
	data: WithoutPageMetadata<EventsData> & {
		groupedEvents: {
			[key: string]: EventListItem[];
		};
	};
}

export function PageEvents({ data }: PageEventsProps) {
	const { title, groupedEvents } = data || {};
	const locale = useLocale();
	const t = useTranslations('events');
	const common = useTranslations('common');
	const dateFnsLocale = DATE_FNS_LOCALES[locale];
	const prefersReducedMotion = useReducedMotion();

	// The initialiser re-runs on the client during hydration, so `currentDate`
	// holds the real clock from the first client render even though the
	// prerendered HTML was built with the clock as of the last revalidation.
	const [currentDate, setCurrentDate] = useState(() => new Date());
	const [selectedMonth, setSelectedMonth] = useState<{
		month: number;
		year: number;
	} | null>(null);

	useEffect(() => {
		const timer = setInterval(() => setCurrentDate(new Date()), CLOCK_TICK_MS);
		return () => clearInterval(timer);
	}, []);

	const availableMonths = useMemo(() => {
		if (!groupedEvents) return [];

		return Object.keys(groupedEvents)
			.map((key) => {
				const events = groupedEvents[key];
				const firstEvent = events[0];
				const yearMonth = getRichDateYearMonth(firstEvent?.eventDatetime);
				const instant = getRichDateInstant(firstEvent?.eventDatetime);
				if (!firstEvent || !yearMonth || !instant) return null;

				return {
					key,
					month: yearMonth.month,
					year: yearMonth.year,
					date: instant,
					firstEventDatetime: firstEvent.eventDatetime,
					events,
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null)
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}, [groupedEvents]);

	const defaultMonthIndex = useMemo(() => {
		if (availableMonths.length === 0) return 0;
		const index = availableMonths.findIndex((itemMonth) =>
			itemMonth.events.some(
				(event) =>
					!isEventEnded(event.eventDatetime, event.endDatetime, currentDate)
			)
		);
		// All events are in the past -> open on the most recent month.
		return index >= 0 ? index : availableMonths.length - 1;
		// `currentDate` is deliberately omitted: the landing month is a first-render
		// decision. Recomputing it on a clock tick would move the view out from
		// under someone browsing a month they had not explicitly selected.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [availableMonths]);

	const currentMonthIndex = useMemo(() => {
		if (selectedMonth) {
			const index = availableMonths.findIndex((itemMonth) => {
				return (
					itemMonth.month === selectedMonth.month &&
					itemMonth.year === selectedMonth.year
				);
			});
			if (index >= 0) return index;
		}
		return defaultMonthIndex;
	}, [availableMonths, selectedMonth, defaultMonthIndex]);

	const currentMonthData = availableMonths[currentMonthIndex];
	const displayEvents = useMemo(
		() => currentMonthData?.events || [],
		[currentMonthData]
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

	const goToPreviousMonth = () => {
		if (currentMonthIndex > 0) {
			const prevMonth = availableMonths[currentMonthIndex - 1];
			if (!prevMonth) return;
			setSelectedMonth({ month: prevMonth.month, year: prevMonth.year });
			window.scrollTo({ top: 0 });
		}
	};

	const goToNextMonth = () => {
		if (currentMonthIndex < availableMonths.length - 1) {
			const nextMonth = availableMonths[currentMonthIndex + 1];
			if (!nextMonth) return;
			setSelectedMonth({ month: nextMonth.month, year: nextMonth.year });
			window.scrollTo({ top: 0 });
		}
	};

	const hasPrevious = currentMonthIndex > 0;
	const hasNext = currentMonthIndex < availableMonths.length - 1;

	const monthYearDisplay = currentMonthData
		? formatRichDate(
				currentMonthData.firstEventDatetime,
				t.monthYearFormat,
				dateFnsLocale
			)
		: '';

	return (
		<div className="min-h-screen p-x-max mx-auto pt-8.5 pb-22.5 lg:pt-16">
			<h1 id="events-heading" className="sr-only">
				{title}
			</h1>
			<div className="flex items-center justify-between sticky top-header bg-background/95 z-10 font-bold">
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
				{availableMonths.length > 0 && (
					<div className="flex items-center justify-between gap-1">
						<Button
							onClick={goToPreviousMonth}
							disabled={!hasPrevious}
							aria-label={t.aria.previousMonth}
							variant="ghost"
							className="uppercase text-xs font-normal cursor-pointer hover:opacity-60"
						>
							<ArrowLeft />
							{t.aria.previousMonth}
						</Button>
						/
						<Button
							onClick={goToNextMonth}
							disabled={!hasNext}
							aria-label={t.aria.nextMonth}
							variant="ghost"
							className="uppercase text-xs font-normal cursor-pointer hover:opacity-60"
						>
							{t.aria.nextMonth}
							<ArrowRight className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
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
						const displayLocationLink = locationRef?.mapLink || locationLink;

						const eventHasEnded = isEventEnded(
							eventDatetime,
							endDatetime,
							currentDate
						);
						const daysUntil = getDaysUntilEvent(eventDatetime, currentDate);
						const dateStatusInfo = resolveEventDateStatus(dateStatus, t);

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
										'font-bold uppercase lg:pl-0 t-b-1 lg:flex flex-wrap items-center gap-2.5 text-balance transition-transform duration-300 ease-out group-hover/row:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/row:translate-x-0',
										{
											'opacity-30': eventHasEnded,
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
											'opacity-30': eventHasEnded,
										}
									)}
								>
									{dateStatusInfo.isFirm && eventDatetime
										? formatRichDate(eventDatetime, t.dateFormat, dateFnsLocale)
										: dateStatusInfo.label}

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
										<span className="whitespace-nowrap -translate-y-0.25 ml-1 inline-block transition-transform duration-300 ease-out group-hover/location:translate-x-0.5 group-hover/location:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/location:translate-x-0 motion-reduce:group-hover/location:translate-y-0">
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
										<EventStatusPill
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
											<EventStatusPill
												key={item._key}
												data={item}
												className={cn(eventHasEnded ? 'opacity-30' : '')}
											/>
										))}
									{eventHasEnded && (
										<EventStatusPill
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
