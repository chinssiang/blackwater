import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowUpRight } from '@/components/SvgIcons';
import CustomPortableText from '@/components/CustomPortableText';
import { cn, hasArrayValue } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';

type Station = {
	name?: string | null;
	distance?: string | null;
	locationName?: string | null;
	locationLink?: string | null;
	questTitle?: string | null;
	questInstructions?: string | null;
	directionsIn?: string | null;
	directionsOut?: string | null;
};

type StatusListItem = {
	_key?: string | null;
	eventStatus?: {
		title?: string | null;
		statusTextColor?: Record<string, number> | null;
		statusBgColor?: Record<string, number> | null;
	} | null;
	link?: { href?: string | null } | null;
};

type PageEventSingleProps = {
	data: {
		title?: string | null;
		subtitle?: string | null;
		slug?: string | null;
		eventDatetime?: string | null;
		dateStatus?: string | null;
		location?: string | null;
		locationLink?: string | null;
		startEndLocation?: { name?: string | null; link?: string | null } | null;
		statusList?: StatusListItem[] | null;
		stations?: Station[] | null;
		content?: unknown[] | null;
	} | null;
};

export default function PageEventSingle({ data }: PageEventSingleProps) {
	const {
		title,
		subtitle,
		eventDatetime,
		dateStatus,
		location,
		locationLink,
		startEndLocation,
		statusList,
		stations,
		content,
	} = data || {};

	const formattedDate =
		eventDatetime && (!dateStatus || dateStatus === 'confirmed')
			? format(new Date(eventDatetime), 'iii, MM.dd.yy, h:mm aaa')
			: dateStatus?.toUpperCase() || 'TBA';

	const startName = startEndLocation?.name || location;
	const startLink = startEndLocation?.link || locationLink;

	const hasStations = hasArrayValue(stations);
	const hasContent = hasArrayValue(content);

	return (
		<div className="min-h-screen">
			{/* Hero */}
			<section className="px-4 pt-16 pb-8 lg:px-8 lg:pt-24 lg:pb-12 border-b border-foreground/20">
				<div className="max-w-3xl">
					<p className="t-b-2 uppercase text-muted-foreground mb-3">
						{formattedDate}
					</p>
					<h1 className="t-h-2 uppercase text-balance mb-2">{title}</h1>
					{subtitle && (
						<p className="t-b-1 text-muted-foreground text-balance mb-6">
							{subtitle}
						</p>
					)}
					{hasArrayValue(statusList) && (
						<div className="flex flex-wrap gap-2">
							{statusList!.map((item) => (
								<EventStatusBadge
									key={item._key || item.eventStatus?.title}
									item={item}
								/>
							))}
						</div>
					)}
				</div>
			</section>

			{/* Anchor nav */}
			{hasStations && (
				<nav className="sticky top-0 z-20 bg-background border-b border-foreground/20 overflow-x-auto">
					<div className="flex gap-0">
						{startName && (
							<a
								href="#start"
								className="px-4 py-3 t-b-2 uppercase whitespace-nowrap border-r border-foreground/20 hover:bg-foreground hover:text-background transition-colors"
							>
								{startName}
							</a>
						)}
						{stations!.map((station, i) => (
							<a
								key={i}
								href={`#station-${i}`}
								className="px-4 py-3 t-b-2 uppercase whitespace-nowrap not-last:border-r border-foreground/20 hover:bg-foreground hover:text-background transition-colors"
							>
								{station.name}
							</a>
						))}
					</div>
				</nav>
			)}

			<div className="px-4 lg:px-8 max-w-3xl">
				{/* Start / End card */}
				{startName && (
					<section id="start" className="py-8 border-b border-foreground/20">
						<p className="t-b-2 uppercase text-muted-foreground mb-1">
							Start &amp; Finish
						</p>
						{startLink ? (
							<Link
								href={startLink}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 t-h-5 uppercase hover:opacity-70 transition-opacity"
							>
								{startName}
								<ArrowUpRight className="size-2" aria-hidden />
							</Link>
						) : (
							<p className="t-h-5 uppercase">{startName}</p>
						)}
					</section>
				)}

				{/* Station cards */}
				{hasStations &&
					stations!.map((station, i) => (
						<StationCard key={i} station={station} index={i} />
					))}

				{/* Event notes */}
				{hasContent && (
					<section className="py-10 border-t border-foreground/20">
						<p className="t-b-2 uppercase text-muted-foreground mb-4">
							Event Notes
						</p>
						<CustomPortableText value={content as any} />
					</section>
				)}
			</div>
		</div>
	);
}

function StationCard({ station, index }: { station: Station; index: number }) {
	const {
		name,
		distance,
		locationName,
		locationLink,
		questTitle,
		questInstructions,
		directionsIn,
		directionsOut,
	} = station;

	return (
		<section
			id={`station-${index}`}
			className="py-8 border-b border-foreground/20 scroll-mt-12"
		>
			{/* Station header */}
			<div className="flex items-start justify-between gap-4 mb-6">
				<div>
					<p className="t-b-2 uppercase text-muted-foreground mb-1">
						Station {index + 1}
						{distance && <span className="ml-2">&mdash; {distance}</span>}
					</p>
					<div className="flex items-center gap-3">
						<h2 className="t-h-4 uppercase">{name}</h2>
					</div>
				</div>
			</div>

			{/* Location */}
			{locationName && (
				<div className="mb-6">
					<p className="t-b-2 uppercase text-muted-foreground mb-1">Location</p>
					{locationLink ? (
						<Link
							href={locationLink}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 t-b-1 uppercase hover:opacity-70 transition-opacity"
						>
							{locationName}
							<ArrowUpRight className="size-2" aria-hidden />
						</Link>
					) : (
						<p className="t-b-1 uppercase">{locationName}</p>
					)}
				</div>
			)}

			{/* Quest */}
			{questTitle && (
				<div className="mb-6 p-4 border border-foreground/20 rounded">
					<p className="t-b-2 uppercase text-muted-foreground mb-1">
						Flavor Challenge &mdash; {questTitle}
					</p>
					{questInstructions && (
						<p className="t-b-1 whitespace-pre-line">{questInstructions}</p>
					)}
				</div>
			)}

			{/* Directions */}
			<div
				className={cn(
					'grid gap-4',
					directionsIn && directionsOut ? 'lg:grid-cols-2' : ''
				)}
			>
				{directionsIn && (
					<div>
						<p className="t-b-2 uppercase text-muted-foreground mb-1">
							Getting Here
						</p>
						<p className="t-b-1 whitespace-pre-line">{directionsIn}</p>
					</div>
				)}
				{directionsOut && (
					<div>
						<p className="t-b-2 uppercase text-muted-foreground mb-1">
							Heading Out
						</p>
						<p className="t-b-1 whitespace-pre-line">{directionsOut}</p>
					</div>
				)}
			</div>
		</section>
	);
}

function EventStatusBadge({ item }: { item: StatusListItem }) {
	const { eventStatus, link } = item;
	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus;
	return (
		<span
			className="rounded-4xl py-2 px-2.5 uppercase t-b-2 inline-flex items-center gap-1"
			style={{
				color:
					buildRgbaCssString(statusTextColor as any) || 'var(--foreground)',
				backgroundColor:
					buildRgbaCssString(statusBgColor as any) || 'var(--muted)',
			}}
		>
			{title}
			{link?.href && (
				<Link href={link.href} className="p-fill" aria-hidden>
					<ArrowUpRight className="size-2" />
				</Link>
			)}
		</span>
	);
}
