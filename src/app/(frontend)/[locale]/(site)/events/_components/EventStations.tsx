import ImageBlock from '@/components/ImageBlock';
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@/components/ui/Accordion';
import { cn, hasArrayValue } from '@/lib/utils';
import { interpolate, type Dictionary } from '@/lib/dictionary';
import type { PageEventSingleQueryResult } from 'sanity.types';
import EventStationsNav from './EventStationsNav';
import ExternalTextLink from './ExternalTextLink';

type EventQueryResult = NonNullable<PageEventSingleQueryResult>;

// Exported so PageEventSingle composes this slice into its own props instead of
// restating the same two fields -- the parent passes `data` straight through,
// so the two must not be able to disagree about its shape.
export type EventStationsData = Pick<
	EventQueryResult,
	'startEndLocation' | 'stations'
>;

type Station = NonNullable<EventQueryResult['stations']>[number];

type EventDict = Dictionary['events'];

// The multi-location subtree, lifted out of PageEventSingle when that became a
// Server Component. Exactly one of the 89 published events renders this, and
// because the shell is now server-side, the two client pieces it reaches for
// (EventStationsNav's scroll-spy and the quest Accordion) only appear in that
// one page's RSC payload -- when the shell was 'use client' they shipped to
// every event page.
export default function EventStations({
	data,
	t,
}: {
	data: EventStationsData;
	t: EventDict;
}) {
	const { startEndLocation, stations } = data;

	const hasStations = hasArrayValue(stations);
	// Narrowed into locals rather than asserted at each use: `hasStartFinish`
	// proves the fact to a reader but not to TypeScript, which cost five `!`s.
	const startName = startEndLocation?.name;
	const startLink = startEndLocation?.link;
	if (!hasStations && !startName) return null;

	// Only consumed under `hasStations`, so it is not built otherwise.
	const navItems = hasStations
		? [
				...(startName ? [{ id: 'start', label: startName }] : []),
				...(stations ?? []).map((station, index) => ({
					id: `station-${index}`,
					label:
						station.name ??
						interpolate(t.detail.station, { number: index + 1 }),
				})),
			]
		: [];

	return (
		<section className="mt-12 lg:mt-16">
			{hasStations && <EventStationsNav items={navItems} />}
			{startName && (
				<div
					id="start"
					className="border-foreground/20 px-contain scroll-mt-12 border-b py-8 lg:p-x-max"
				>
					<p className="t-spec text-foreground/60 mb-1 uppercase">
						{t.detail.startFinish}
					</p>
					<ExternalTextLink
						label={startName}
						href={startLink}
						className="t-h-3"
					/>
				</div>
			)}
			{stations?.map((station, index) => (
				<StationCard key={index} station={station} index={index} t={t} />
			))}
		</section>
	);
}

function StationCard({
	station,
	index,
	t,
}: {
	station: Station;
	index: number;
	t: EventDict;
}) {
	const {
		name,
		distance,
		locationName,
		locationLink,
		questTitle,
		questInstructions,
		questExampleImage,
		directionsIn,
		directionsOut,
	} = station;

	const hasExampleImage = Boolean(questExampleImage?.image?.asset);
	const questLabel = questTitle
		? `${t.detail.flavorChallenge} — ${questTitle}`
		: null;

	return (
		<div
			id={`station-${index}`}
			className="border-foreground/20 px-contain scroll-mt-12 border-b py-8 lg:p-x-max"
		>
			<div className="mb-6 min-w-0">
				<p className="t-spec text-foreground/60 mb-3 uppercase">
					{interpolate(t.detail.station, { number: index + 1 })}
					{distance && <span className="ml-2">{distance}</span>}
				</p>
				<h2 className="t-h-3 text-balance uppercase">{name}</h2>
			</div>

			{locationName && (
				<div className="mb-6">
					<p className="t-spec text-foreground/60 mb-1 uppercase">
						{t.detail.location}
					</p>
					<ExternalTextLink
						label={locationName}
						href={locationLink}
						className="t-b-1 wrap-break-word"
					/>
				</div>
			)}

			{questLabel &&
				(hasExampleImage ? (
					<Accordion
						type="single"
						collapsible
						className="border-foreground/20 mb-6 overflow-hidden rounded border"
					>
						<AccordionItem value="quest" className="border-b-0">
							<AccordionTrigger className="hover:bg-foreground/5 cursor-pointer rounded-none p-4 hover:no-underline [&>svg]:size-3">
								<div className="min-w-0 flex-1">
									<QuestSummary
										label={questLabel}
										instructions={questInstructions}
									/>
								</div>
							</AccordionTrigger>
							<AccordionContent className="border-foreground/20 border-t p-0">
								<ImageBlock
									imageObj={questExampleImage as any}
									alt={interpolate(t.detail.exampleImageAlt, {
										quest: questTitle ?? '',
									})}
									sizes="(min-width: 1024px) 50vw, 100vw"
								/>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				) : (
					<div className="border-foreground/20 mb-6 overflow-hidden rounded border p-4">
						<QuestSummary label={questLabel} instructions={questInstructions} />
					</div>
				))}

			<div
				className={cn(
					'grid gap-4',
					directionsIn && directionsOut ? 'lg:grid-cols-2' : ''
				)}
			>
				{directionsIn && (
					<div>
						<p className="t-spec text-foreground/60 mb-1 uppercase">
							{t.detail.gettingHere}
						</p>
						<p className="t-b-1 whitespace-pre-line">{directionsIn}</p>
					</div>
				)}
				{directionsOut && (
					<div>
						<p className="t-spec text-foreground/60 mb-1 uppercase">
							{t.detail.headingOut}
						</p>
						<p className="t-b-1 whitespace-pre-line">{directionsOut}</p>
					</div>
				)}
			</div>
		</div>
	);
}

// The two arms in StationCard differ only in their wrapper -- a disclosure when
// there is an example image, a plain bordered box otherwise -- so the summary
// itself lives here instead of being written out twice. A component rather than
// a local const, so it is built by whichever arm renders and not for stations
// that have no quest at all.
function QuestSummary({
	label,
	instructions,
}: {
	label: string;
	instructions?: string | null;
}) {
	return (
		<>
			<p className="t-spec text-foreground/60 mb-1 uppercase">{label}</p>
			{instructions && (
				<p className="t-b-1 whitespace-pre-line">{instructions}</p>
			)}
		</>
	);
}
