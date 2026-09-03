import {
	formatRichDate,
	getDaysUntilEvent,
	isEventEnded,
} from '@/lib/event-date';
import { resolveEventDateStatus } from '@/lib/event-status';
import CustomPortableText from '@/components/CustomPortableText';
import ImageBlock from '@/components/ImageBlock';
import { LocationCurrentTime } from '@/components/LocationCurrentTimeLazy';
import EventStatusPill from '@/components/EventStatusPill';
import { cn, hasArrayValue } from '@/lib/utils';
import {
	formatDaysUntilLabel,
	interpolate,
	type Dictionary,
} from '@/lib/dictionary';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { REVEAL_SOFT } from '@/lib/animate';
import type { Locale } from '@/lib/i18n';
import type { PageEventSingleQueryResult } from 'sanity.types';
import EventStations, { type EventStationsData } from './EventStations';
import ExternalTextLink from './ExternalTextLink';

// Sliced off the generated query result rather than hand-written, so a field
// dropped from pageEventSingleQuery's projection is a compile error here
// instead of `undefined` at runtime. NonNullable because the route has already
// returned NotFoundContent by the time this renders.
//
// This only became possible once the route annotated its fetch: the query is
// built from interpolated helpers, so `sanityFetch` inferred `any` and there
// was no real type to slice.
type EventQueryResult = NonNullable<PageEventSingleQueryResult>;

type EventData = Pick<
	EventQueryResult,
	| 'title'
	| 'subtitle'
	| 'eventDatetime'
	| 'endDatetime'
	| 'dateStatus'
	| 'eventType'
	| 'distanceKm'
	| 'isFree'
	| 'location'
	| 'locationLink'
	| 'locationRef'
	| 'heroImage'
	| 'highlights'
	| 'categories'
	| 'statusList'
	| 'format'
	| 'content'
> &
	EventStationsData;

type EventDict = Dictionary['events'];

// A Server Component: nothing here holds state, and every piece that needs the
// browser (EventStations' scroll-spy and quest accordion, ImageBlock, the venue
// clock) carries its own 'use client'. Keeping the shell on the server takes
// this whole tree out of the client bundle on all 178 event pages.
export default function PageEventSingle({
	data,
	locale,
	t,
	relatedSlot,
}: {
	data: EventData;
	locale: Locale;
	t: EventDict;
	relatedSlot?: React.ReactNode;
}) {
	const {
		title,
		subtitle,
		eventDatetime,
		dateStatus,
		statusList,
		format: eventFormat,
		heroImage,
		categories,
		endDatetime,
		stations,
	} = data;

	const dateFnsLocale = DATE_FNS_LOCALES[locale];

	// `title` is the codex ("161 RR"), an internal serial; `subtitle` is the
	// human name. The name leads and the codex becomes spec data -- the same
	// call EventTicket makes, and this page used to make the opposite one, so a
	// run's card and its own page disagreed about what it was called.
	const heading = subtitle || title;
	const codex = subtitle ? title : null;
	const category = categories?.[0]?.title;

	// One resolve for the whole page: the helper cleans the stega metadata draft
	// mode encodes into the enum -- see its note -- and returning both answers
	// from one clean is what stops the firmness and the label being paired
	// wrongly.
	const dateStatusInfo = resolveEventDateStatus(dateStatus, t);
	const dateIsFirm = dateStatusInfo.isFirm;
	const formattedDate =
		dateIsFirm && eventDatetime
			? formatRichDate(eventDatetime, t.dateFormat, dateFnsLocale)
			: dateStatusInfo.label;

	// One instant for the whole render. Freshness comes from the route's
	// `revalidate`, not a client clock -- a clock here would have to bring the
	// shell back across the client boundary and would correct the view only
	// after hydration.
	const now = new Date();
	const hasEnded = dateIsFirm
		? isEventEnded(eventDatetime, endDatetime, now)
		: false;
	const daysUntil =
		dateIsFirm && !hasEnded ? getDaysUntilEvent(eventDatetime, now) : null;
	const stateLabel = hasEnded
		? t.status.ended
		: daysUntil === null
			? null
			: formatDaysUntilLabel(daysUntil, t);

	return (
		<div className="min-h-main">
			{/* Gated on the asset, not the wrapper: heroImage goes truthy the moment
			    an editor touches any field on it. */}
			{heroImage?.image?.asset && (
				<ImageBlock
					imageObj={heroImage as any}
					alt={heading || ''}
					sizes="100vw"
					priority
				/>
			)}

			<section className="reveal p-x-max pt-16 lg:pt-24" style={REVEAL_SOFT}>
				<div className="max-w-4xl">
					{category && (
						<p className="t-spec text-foreground/60 mb-4 uppercase">
							{category}
						</p>
					)}
					<h1 className="t-h-1 text-foreground text-balance uppercase">
						{heading}
					</h1>
					{codex && (
						<p className="t-spec text-foreground/60 mt-3 uppercase">{codex}</p>
					)}
				</div>

				<div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
					<p className="t-h-3 uppercase">{formattedDate}</p>
					{(stateLabel || hasArrayValue(statusList)) && (
						<div className="flex flex-wrap gap-2">
							{stateLabel && (
								<EventStatusPill
									className="py-2"
									data={{ eventStatus: { title: stateLabel } }}
								/>
							)}
							{statusList?.map((item) => (
								<EventStatusPill
									key={item._key || item.eventStatus?.title}
									className={cn('py-2', hasEnded && 'opacity-40')}
									// An ended event must not advertise a live registration
									// link, so the pill keeps its label and loses its href.
									data={hasEnded ? { ...item, link: null } : item}
								/>
							))}
						</div>
					)}
				</div>
			</section>

			<EventSpecs data={data} dateFnsLocale={dateFnsLocale} t={t} />

			<EventBody data={data} t={t} />
			{relatedSlot}
		</div>
	);
}

// The horizontal band that replaced the old 1fr/1fr rail. `flex-wrap`, not a
// fixed column count: most events fill two or three of these cells and a
// five-column grid left four visibly empty holes. Renders nothing at all --
// hairline included -- when there is no cell to show, the same rule
// eventsBlock's empty window follows.
function EventSpecs({
	data,
	dateFnsLocale,
	t,
}: {
	data: EventData;
	dateFnsLocale: (typeof DATE_FNS_LOCALES)[Locale];
	t: EventDict;
}) {
	const {
		locationRef,
		location,
		locationLink,
		distanceKm,
		eventType,
		isFree,
		endDatetime,
		dateStatus,
	} = data;

	const displayLocation = locationRef?.name || location;
	const displayLocationLink = locationRef?.mapLink || locationLink;
	// Gated on the same firmness as every other date on this page: without it a
	// cancelled event's masthead reads CANCELLED while the band below states
	// when it finishes.
	const endsAt =
		endDatetime && resolveEventDateStatus(dateStatus, t).isFirm
			? formatRichDate(endDatetime, t.dateFormat, dateFnsLocale)
			: null;
	// No cast: `eventType` is a real union in the generated result type, so
	// indexing the dictionary with it directly is what makes a fifth schema
	// value fail to compile until someone adds the label. A `as keyof typeof`
	// here would silently drop the cell instead.
	const eventTypeLabel = eventType ? t.spec.eventType[eventType] : null;

	// Only the cells that have a value, so the band never renders an empty
	// column. `label` is the key: it is unique per cell and already required.
	const cells = [
		displayLocation && {
			label: t.spec.venue,
			value: (
				<>
					<ExternalTextLink
						label={displayLocation}
						href={displayLocationLink}
						ariaLabel={interpolate(t.aria.viewLocation, {
							location: displayLocation,
						})}
					/>
					{/* The venue as a place rather than a string. Imported from the
					    Lazy wrapper on purpose -- the clock carries date-fns plus both
					    locale bundles. */}
					<span className="t-spec text-foreground/60 mt-1.5 block uppercase">
						<LocationCurrentTime />
					</span>
				</>
			),
		},
		typeof distanceKm === 'number' && {
			label: t.spec.distance,
			value: interpolate(t.spec.distanceValue, { km: distanceKm }),
		},
		eventTypeLabel && { label: t.spec.type, value: eventTypeLabel },
		isFree && { label: t.spec.entry, value: t.spec.free },
		endsAt && { label: t.spec.ends, value: endsAt },
	].filter(Boolean) as { label: string; value: React.ReactNode }[];

	if (cells.length === 0) return null;

	return (
		<section className="reveal p-x-max mt-6 lg:mt-8" style={REVEAL_SOFT}>
			<dl className="border-foreground/20 flex flex-wrap gap-x-12 gap-y-8 border-b pb-6">
				{cells.map((cell) => (
					<div key={cell.label} className="min-w-0">
						<dt className="t-spec text-foreground/60 mb-2 uppercase">
							{cell.label}
						</dt>
						<dd className="t-h-3 uppercase">{cell.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function EventBody({ data, t }: { data: EventData; t: EventDict }) {
	const { highlights, content, format: eventFormat, stations } = data;
	// Derived here rather than passed: every input is already in scope, so a
	// prop could only ever disagree with them.
	const isMultiLocation =
		eventFormat === 'multi-location' ||
		(!eventFormat && hasArrayValue(stations));
	const hasContent = hasArrayValue(content);
	const hasHighlights = hasArrayValue(highlights);

	return (
		<>
			{hasHighlights && (
				<section className="p-x-max mt-12 lg:mt-16">
					<p className="t-spec text-foreground/60 mb-3 uppercase">
						{t.detail.goodToKnow}
					</p>
					<ul className="max-w-[60ch] space-y-2">
						{highlights!.map((highlight, index) => (
							<li key={index} className="t-b-1">
								<span className="text-foreground/60 uppercase">
									{highlight.label}:
								</span>{' '}
								{highlight.value}
							</li>
						))}
					</ul>
				</section>
			)}

			{isMultiLocation && <EventStations data={data} t={t} />}

			{hasContent && (
				<section className="p-x-max mt-12 lg:mt-16">
					<p className="t-spec text-foreground/60 mb-4 uppercase">
						{t.detail.notes}
					</p>
					{/* .wysiwyg because CustomPortableText ships no typography of its
					    own -- without it the headings and lists here rendered as
					    browser defaults. */}
					<div className="wysiwyg max-w-[68ch]">
						<CustomPortableText blocks={content as any} />
					</div>
				</section>
			)}
		</>
	);
}
