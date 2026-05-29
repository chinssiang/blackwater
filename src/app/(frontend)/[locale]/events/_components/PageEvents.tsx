'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import CustomLink from '@/components/CustomLink';
import { format } from 'date-fns';
import { enUS, zhTW } from 'date-fns/locale';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { PEvent } from 'sanity.types';
import { ArrowUpRight } from '@/components/SvgIcons';
import { Button } from '@/components/ui/Button';
import { fadeAnim } from '@/lib/animate';
import { buildRgbaCssString } from '@/lib/image-utils';
import { cn, hasArrayValue } from '@/lib/utils';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { interpolate, pickPlural } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';

const EASE_EVENT_ROW = [0, 0.5, 0.5, 1] as const;
const EASE_HEADER = [0, 0.71, 0.2, 1.01] as const;

const DATE_FNS_LOCALES: Record<
	Locale,
	Locale extends 'zh_tw' ? typeof zhTW : typeof enUS
> = {
	en: enUS,
	zh_tw: zhTW,
} as Record<Locale, typeof enUS | typeof zhTW>;

function isEventEnded(
	eventDatetime: string | null | undefined,
	currentDate: Date
): boolean {
	if (!eventDatetime) return false;
	const eventDateEndOfDay = new Date(eventDatetime);
	eventDateEndOfDay.setHours(23, 59, 59, 999);
	return eventDateEndOfDay < currentDate;
}

function getDaysUntilEvent(
	eventDatetime: string | null | undefined,
	currentDate: Date
): number | null {
	if (!eventDatetime) return null;
	const eventDateStartOfDay = new Date(eventDatetime);
	eventDateStartOfDay.setHours(0, 0, 0, 0);

	const today = new Date(currentDate);
	today.setHours(0, 0, 0, 0);

	const diffTime = eventDateStartOfDay.getTime() - today.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays >= 0 && diffDays <= 3) {
		return diffDays;
	}
	return null;
}

interface PageEventsProps {
	data: PEvent & {
		groupedEvents: {
			[key: string]: PEvent[];
		};
	};
}

export function PageEvents({ data }: PageEventsProps) {
	const { title, groupedEvents } = data || {};
	const locale = useLocale();
	const t = useTranslations('events');
	const common = useTranslations('common');
	const dateFnsLocale = DATE_FNS_LOCALES[locale];

	const currentDate = new Date();
	const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
	const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

	const availableMonths = useMemo(() => {
		if (!groupedEvents) return [];

		return Object.keys(groupedEvents)
			.map((key) => {
				const events = groupedEvents[key];
				const firstEvent = events[0];
				if (!firstEvent || !firstEvent.eventDatetime) return null;

				const date = new Date(firstEvent.eventDatetime);

				return {
					key,
					month: date.getMonth(),
					year: date.getFullYear(),
					date: date,
					events: events as PEvent[],
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null)
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}, [groupedEvents]);

	const currentMonthIndex = useMemo(() => {
		const index = availableMonths.findIndex((itemMonth) => {
			return itemMonth.month === currentMonth && itemMonth.year === currentYear;
		});

		return index >= 0 ? index : 0;
	}, [availableMonths, currentMonth, currentYear]);

	const currentMonthData = availableMonths[currentMonthIndex];
	const displayEvents = useMemo(
		() => currentMonthData?.events || [],
		[currentMonthData]
	);

	const isHideStatusColumn = useMemo(() => {
		const isAllStatusEmpty = displayEvents.every((event) => {
			return event.statusList === null || event.statusList === undefined;
		});
		return isAllStatusEmpty;
	}, [displayEvents]);
	const colStyle = isHideStatusColumn
		? 'grid-cols-[60%_1fr] lg:grid-cols-[3fr_1fr_1fr]'
		: 'grid-cols-[60%_1fr] lg:grid-cols-[3fr_1fr_1fr_230px]';

	const goToPreviousMonth = () => {
		if (currentMonthIndex > 0) {
			const prevMonth = availableMonths[currentMonthIndex - 1];
			if (!prevMonth) return;
			setCurrentMonth(prevMonth.month);
			setCurrentYear(prevMonth.year);
		}
	};

	const goToNextMonth = () => {
		if (currentMonthIndex < availableMonths.length - 1) {
			const nextMonth = availableMonths[currentMonthIndex + 1];
			if (!nextMonth) return;
			setCurrentMonth(nextMonth.month);
			setCurrentYear(nextMonth.year);
		}
	};

	const hasPrevious = currentMonthIndex > 0;
	const hasNext = currentMonthIndex < availableMonths.length - 1;

	const monthYearDisplay = currentMonthData
		? format(currentMonthData.date, t.monthYearFormat, {
				locale: dateFnsLocale,
			})
		: '';

	return (
		<div className="min-h-main-(--height-newsletter) p-x-max mx-auto py-8.5 lg:py-16">
			<h1 className="sr-only">{title}</h1>
			<div className="flex items-center justify-between sticky top-header bg-background/95 z-10 font-bold">
				<motion.p
					key={monthYearDisplay}
					initial="hide"
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
				{availableMonths.length > 0 && (
					<div className="flex items-center justify-between gap-1">
						<Button
							onClick={goToPreviousMonth}
							disabled={!hasPrevious}
							aria-label={t.aria.previousMonth}
							variant="ghost"
							size="sm"
							className="uppercase t-b-2 cursor-pointer hover:opacity-60"
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
							size="sm"
							className="uppercase t-b-2 cursor-pointer hover:opacity-60"
						>
							{t.aria.nextMonth}
							<ArrowRight className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
			{hasArrayValue(displayEvents) ? (
				<div className="mt-10 lg:mt-17.5">
					<div
						className={cn(
							't-b-1 uppercase grid border-y border-b border-white/80 py-2 lg:py-6',
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
							dateStatus,
							location,
							locationLink,
						} = item || {};

						const locationRef = (item as any)?.locationRef as
							| { name?: string | null; mapLink?: string | null }
							| undefined;
						const displayLocation = locationRef?.name || location;
						const displayLocationLink = locationRef?.mapLink || locationLink;

						const eventHasEnded = isEventEnded(eventDatetime, currentDate);
						const daysUntil = getDaysUntilEvent(eventDatetime, currentDate);

						return (
							<motion.div
								key={_id}
								className={cn(
									'relative t-b-1 transition-colors hover:bg-foreground/85 grid items-center border-b group py-4 border-white/80 lg:py-2 lg:min-h-15 group/row',
									colStyle,
									{
										'pointer-events-none': eventHasEnded,
									}
								)}
								initial="hide"
								animate="show"
								variants={fadeAnim}
								transition={{
									duration: 2,
									delay: (index + 1) * 0.12,
									ease: EASE_EVENT_ROW,
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
										't-b-1 uppercase mb-auto text-right lg:text-left lg:mb-0',
										{
											'opacity-30': eventHasEnded,
										}
									)}
								>
									{(!dateStatus || dateStatus === 'confirmed') && eventDatetime
										? format(new Date(eventDatetime), t.dateFormat, {
												locale: dateFnsLocale,
											})
										: dateStatus || t.status.tba}
								</Td>
								<Link className="p-fill" href={`/events/${slug}`} />
								<Td
									className={cn(
										't-b-1 uppercase text-balance mt-2 lg:mt-0 whitespace-pre-line group/location',
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
										<Link
											className="p-fill increase-target-size"
											href={displayLocationLink}
											aria-label={displayLocation || ''}
											target="_blank"
										/>
									)}
								</Td>
								<Td
									className={
										'lg:justify-end gap-1 flex col-start-1 lg:col-start-[unset] mt-6 lg:mt-0'
									}
								>
									{daysUntil !== null && daysUntil !== undefined && (
										<StatusItem
											key={`in-${daysUntil}-day`}
											data={{
												eventStatus: {
													title:
														daysUntil === 0
															? t.status.today
															: interpolate(
																	pickPlural(t.daysUntil, daysUntil),
																	{ count: daysUntil }
																),
												},
											}}
										/>
									)}
									{hasArrayValue(statusList) &&
										statusList.map((item: any) => (
											<StatusItem
												key={item._key}
												data={item}
												className={cn(eventHasEnded ? 'opacity-30' : '')}
											/>
										))}
									{eventHasEnded && (
										<StatusItem
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

function StatusItem({ data, className }: { data: any; className?: string }) {
	const { link, eventStatus } = data;

	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus || {};
	return (
		<span
			className={cn(
				'rounded-4xl py-2 px-2.5 uppercase relative flex items-center gap-0.5 t-b-2',
				className
			)}
			style={{
				color: buildRgbaCssString(statusTextColor) || 'var(--foreground)',
				backgroundColor: buildRgbaCssString(statusBgColor) || 'var(--muted)',
			}}
		>
			{title}
			{link?.href && (
				<>
					<ArrowRight className="size-3" />
					<CustomLink
						className="p-fill"
						link={link}
						aria-hidden={true}
					></CustomLink>
				</>
			)}
		</span>
	);
}

function Th({
	isHideStatusColumn,
	className,
	...props
}: React.ComponentProps<typeof motion.div> & {
	isHideStatusColumn?: boolean;
}) {
	return (
		<motion.div
			key={String(isHideStatusColumn)}
			initial="hide"
			animate="show"
			variants={fadeAnim}
			transition={{
				duration: 0.6,
				delay: 0.3,
				ease: EASE_EVENT_ROW,
			}}
			className={cn('font-bold lg:px-2', className)}
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
			{...props}
		/>
	);
}
