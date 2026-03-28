'use client';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

const EASE_EVENT_ROW = [0, 0.5, 0.5, 1] as const;
const EASE_HEADER = [0, 0.71, 0.2, 1.01] as const;

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
import Link from 'next/link';
import CustomLink from '@/components/CustomLink';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ArrowUpRight } from '@/components/SvgIcons';
import { hasArrayValue } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import { fadeAnim } from '@/lib/animate';
import { Button } from '@/components/ui/Button';
import type { PEvent } from 'sanity.types';
import { motion } from 'motion/react';

interface PageEventsProps {
	data: PEvent & {
		groupedEvents: {
			[key: string]: PEvent[];
		};
	};
}

export function PageEvents({ data }: PageEventsProps) {
	const { title, groupedEvents } = data || {};
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
	const displayEvents = useMemo(() => {
		return currentMonthData?.events || [];
	}, [currentMonthData]);

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
		? format(currentMonthData.date, 'MMMM yyyy')
		: '';

	return (
		<div className="px-contain mx-auto min-h-[inherit] py-10 lg:py-17.5">
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
					className="t-h-5 uppercase"
				>
					{monthYearDisplay}
				</motion.p>
				{availableMonths.length > 0 && (
					<div className="flex items-center justify-between">
						<Button
							onClick={goToPreviousMonth}
							disabled={!hasPrevious}
							aria-label="Previous month"
							variant="ghost"
							size="sm"
							className="uppercase t-b-2 cursor-pointer hover:opacity-60"
						>
							<ArrowLeft />
							Previous
						</Button>
						/
						<Button
							onClick={goToNextMonth}
							disabled={!hasNext}
							aria-label="Next month"
							variant="ghost"
							size="sm"
							className="uppercase t-b-2 cursor-pointer hover:opacity-60"
						>
							Next
							<ArrowRight className="size-3.5" />
						</Button>
					</div>
				)}
			</div>
			{hasArrayValue(displayEvents) ? (
				<div className="mt-10 lg:mt-17.5">
					<div
						className={cn(
							't-h-6 uppercase grid border-y border-b border-white/80 py-2 lg:py-6',
							colStyle
						)}
					>
						<Th className="lg:pl-0">codex</Th>
						<Th
							isHideStatusColumn={isHideStatusColumn}
							className="text-right lg:text-left"
						>
							time
						</Th>
						<Th
							isHideStatusColumn={isHideStatusColumn}
							className="hidden lg:block"
						>
							location
						</Th>
						{!isHideStatusColumn && (
							<Th
								isHideStatusColumn={isHideStatusColumn}
								className="hidden lg:block text-right"
							>
								status
							</Th>
						)}
					</div>
					{displayEvents.map((item, index) => {
						const {
							title,
							subtitle,
							_id,
							statusList,
							eventDatetime,
							dateStatus,
							location,
							locationLink,
						} = item || {};

						const eventHasEnded = isEventEnded(eventDatetime, currentDate);
						const daysUntil = getDaysUntilEvent(eventDatetime, currentDate);

						return (
							<motion.div
								key={_id}
								className={cn(
									't-b-1 transition-colors hover:bg-foreground/85 grid items-center border-b group py-4 border-white/80 lg:py-2 lg:min-h-15 group/row',
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
										'font-bold uppercase lg:pl-0 t-h-6 lg:flex flex-wrap items-center gap-2.5 text-balance group-hover/row:translate-x-1 transition-transform',
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
										? format(new Date(eventDatetime), 'iii, MM.dd.yy, h:mm aaa')
										: dateStatus || 'TBA'}
								</Td>
								<Td
									className={cn(
										't-h-6 uppercase text-balance mt-2 lg:mt-0 whitespace-pre-line group/location',
										{
											'opacity-30': eventHasEnded,
										}
									)}
								>
									{location}
									{locationLink && (
										<span className="whitespace-nowrap -translate-y-0.25 ml-1 inline-block group-hover/location:translate-x-0.5 group-hover/location:-translate-y-0.5 transition-transform">
											&#8203;
											<ArrowUpRight className="size-2 inline-block" />
										</span>
									)}
									{locationLink && (
										<Link
											className="p-fill increase-target-size"
											href={locationLink}
											aria-label={location}
											target="_blank"
										/>
									)}
								</Td>
								<Td
									className={
										'lg:justify-end gap-1 flex col-start-1 lg:col-start-[unset] mt-6 lg:mt-0'
									}
								>
									{eventHasEnded && (
										<StatusItem
											key="ended"
											data={{ eventStatus: { title: 'ended' } }}
										/>
									)}
									{daysUntil !== null && daysUntil !== undefined && (
										<StatusItem
											key={`in-${daysUntil}-day`}
											data={{
												eventStatus: {
													title:
														daysUntil === 0
															? 'today'
															: `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
												},
											}}
										/>
									)}
									{hasArrayValue(statusList) &&
										statusList.map((item: any) => (
											<StatusItem key={item._key} data={item} />
										))}
								</Td>
							</motion.div>
						);
					})}
				</div>
			) : (
				<p className="py-8 text-center">No events for this month</p>
			)}
		</div>
	);
}

function StatusItem({ data }: { data: any }) {
	const { link, eventStatus } = data;

	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus || {};
	return (
		<span
			className="rounded-4xl py-2 px-2.5 uppercase relative flex items-center gap-0.5 t-b-2"
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
