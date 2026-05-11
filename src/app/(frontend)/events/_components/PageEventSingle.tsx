import Link from 'next/link';
import { format as formatDate } from 'date-fns';
import { ArrowUpRight } from '@/components/SvgIcons';
import CustomPortableText from '@/components/CustomPortableText';
import ImageBlock from '@/components/ImageBlock';
import { cn, hasArrayValue } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import EventStationsNav from './EventStationsNav';

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

type Highlight = {
	label?: string | null;
	value?: string | null;
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
		format?: string | null;
		heroImage?: Record<string, any> | null;
		highlights?: Highlight[] | null;
	} | null;
};

export default function PageEventSingle({ data }: PageEventSingleProps) {
	const {
		title,
		subtitle,
		eventDatetime,
		dateStatus,
		statusList,
		format: eventFormat,
		heroImage,
	} = data || {};

	const formattedDate =
		eventDatetime && (!dateStatus || dateStatus === 'confirmed')
			? formatDate(new Date(eventDatetime), 'iii, MM.dd.yy, h:mm aaa')
			: dateStatus?.toUpperCase() || 'TBA';

	const isMultiLocation =
		eventFormat === 'multi-location' ||
		(!eventFormat && hasArrayValue((data || {}).stations));

	return (
		<div className="min-h-screen">
			{heroImage?.image && (
				<ImageBlock
					imageObj={heroImage as any}
					alt={title || ''}
					sizes="100vw"
					priority
				/>
			)}
			<section className="p-x-max pt-16 pb-8 lg:pt-24 lg:pb-12">
				<div className="max-w-3xl">
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
			<EventBody
				data={data}
				formattedDate={formattedDate}
				isMultiLocation={isMultiLocation}
			/>
		</div>
	);
}

function EventBody({
	data,
	formattedDate,
	isMultiLocation,
}: {
	data: PageEventSingleProps['data'];
	formattedDate: string;
	isMultiLocation: boolean;
}) {
	const {
		location,
		locationLink,
		startEndLocation,
		highlights,
		stations,
		content,
	} = data || {};

	const hasContent = hasArrayValue(content);
	const hasStations = hasArrayValue(stations);
	const hasStartFinish = !!startEndLocation?.name;

	const navItems = [
		...(hasStartFinish
			? [{ id: 'start', label: startEndLocation!.name! }]
			: []),
		...(stations ?? []).map((s, i) => ({
			id: `station-${i}`,
			label: s.name ?? `Station ${i + 1}`,
		})),
	];

	return (
		<section className="flex flex-col lg:flex-row gap-10 lg:p-x-max">
			{/* Left sticky meta — shared for both variants */}
			<div className="lg:flex-1 lg:sticky lg:top-header h-fit space-y-8 px-contain lg:px-0">
				{location && (
					<div>
						<p className="t-b-2 uppercase text-muted-foreground mb-1">
							Location
						</p>
						{locationLink ? (
							<Link
								href={locationLink}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 t-h-5 uppercase hover:opacity-70 transition-opacity"
							>
								{location}
								<ArrowUpRight className="size-2" aria-hidden />
							</Link>
						) : (
							<p className="t-h-5 uppercase">{location}</p>
						)}
					</div>
				)}
				<div>
					<p className="t-b-2 uppercase text-muted-foreground mb-1">When</p>
					<p className="t-h-5 uppercase">{formattedDate}</p>
				</div>
				{hasArrayValue(highlights) && (
					<div>
						<p className="t-b-2 uppercase text-muted-foreground mb-3">
							Good to know
						</p>
						<ul className="space-y-2">
							{highlights!.map((h, i) => (
								<li key={i} className="t-b-1">
									<span className="uppercase text-muted-foreground">
										{h.label}:
									</span>{' '}
									{h.value}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>

			{/* Right column — variant-specific */}
			<div className="lg:flex-1 min-w-0">
				{hasStations && <EventStationsNav items={navItems} />}
				{hasStartFinish && (
					<section
						id="start"
						className="py-8 border-b border-foreground/20 scroll-mt-12 px-contain lg:px-0"
					>
						<p className="t-b-2 uppercase text-muted-foreground mb-1">
							Start &amp; Finish
						</p>
						{startEndLocation!.link ? (
							<Link
								href={startEndLocation!.link}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 t-h-5 uppercase hover:opacity-70 transition-opacity"
							>
								{startEndLocation!.name}
								<ArrowUpRight className="size-2" aria-hidden />
							</Link>
						) : (
							<p className="t-h-5 uppercase">{startEndLocation!.name}</p>
						)}
					</section>
				)}
				{hasStations &&
					stations!.map((station, i) => (
						<StationCard
							key={i}
							station={station}
							index={i}
							className="px-contain lg:px-0"
						/>
					))}
				{hasContent && (
					<section className="py-10 border-t border-foreground/20 px-contain lg:px-0">
						<p className="t-b-2 uppercase text-muted-foreground mb-4">
							Event Notes
						</p>
						<CustomPortableText blocks={content as any} />
					</section>
				)}
			</div>
		</section>
	);
}

function StationCard({
	station,
	index,
	className,
}: {
	station: Station;
	index: number;
	className?: string;
}) {
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
			className={cn(
				'py-8 border-b border-foreground/20 scroll-mt-12',
				className
			)}
		>
			<div className="flex items-start justify-between gap-4 mb-6">
				<div className="min-w-0">
					<p className="t-b-2 uppercase text-muted-foreground mb-3">
						Station {index + 1}
						{distance && <span className="ml-2">{distance}</span>}
					</p>
					<div className="flex items-center gap-3 min-w-0">
						<h2 className="t-h-4 uppercase text-balance">{name}</h2>
					</div>
				</div>
			</div>

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
						<p className="t-b-1 uppercase wrap-break-word">{locationName}</p>
					)}
				</div>
			)}

			{questTitle && (
				<div className="mb-6 p-4 border border-foreground/20 rounded">
					<p className="t-b-2 uppercase text-muted-foreground mb-1">
						Flavor Challenge &mdash; {questTitle}
					</p>
					{questInstructions && (
						<p className="t-b-1 leading-5 hitespace-pre-line">
							{questInstructions}
						</p>
					)}
				</div>
			)}

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
				<Link href={link.href} className="p-fill" aria-hidden tabIndex={-1}>
					<ArrowUpRight className="size-2" />
				</Link>
			)}
		</span>
	);
}
