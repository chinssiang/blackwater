import { cache } from 'react';
import dynamic from 'next/dynamic';
import type { UpcomingEventsQueryResult } from 'sanity.types';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { EventTicketSlide } from '@/components/EventTicket';
import SectionHeadingLink from '@/components/SectionHeadingLink';
import { sanityFetch } from '@/sanity/lib/live';
import {
	upcomingEventsQuery,
	UPCOMING_EVENTS_TAGS,
} from '@/sanity/lib/queries';
import { getDictionary } from '@/lib/dictionary.server';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { getUpcomingFrom, selectUpcomingEvents } from '@/lib/event-date';
import { resolveHref } from '@/lib/routes';
import type { Locale } from '@/lib/i18n';
const EventsCarousel = dynamic(() => import('@/components/EventsCarousel'));

const getCachedUpcomingEvents = cache(
	async (locale: string): Promise<{ data: UpcomingEventsQueryResult }> =>
		sanityFetch({
			query: upcomingEventsQuery,
			params: { locale, upcomingFrom: getUpcomingFrom() },
			tags: [...UPCOMING_EVENTS_TAGS],
		})
);

type EventsBlockProps = {
	data: {
		heading?: string;
		windowDays?: number | null;
		limit?: number | null;
		callToAction?: {
			label?: string | null;
			link?: { href?: unknown; isNewTab?: boolean | null } | null;
		} | null;
		sectionAppearance?: SectionAppearance;
	};
	locale: Locale;
	headingLevel?: 'h1' | 'h2';
	className?: string;
};

export default async function EventsBlock({
	data,
	locale,
	headingLevel,
	className,
}: EventsBlockProps) {
	const { heading, windowDays, limit, callToAction, sectionAppearance } =
		data || {};

	const { data: events } = await getCachedUpcomingEvents(locale);
	// Read once and threaded down, so every ticket in the strip counts from the
	// same instant and the selection cannot disagree with what a ticket renders.
	const now = new Date();
	const rows = selectUpcomingEvents(events, { now, windowDays, limit });

	if (rows.length === 0) return null;

	const t = (await getDictionary(locale)).events;
	const dateFnsLocale = DATE_FNS_LOCALES[locale];

	// The authored CTA is an OVERRIDE, not the only source: unset, this still
	// links to the events index with the translated label, so existing content in
	// both datasets keeps the link without anyone editing it.
	//
	// `href` arrives as `unknown` -- resolvedHrefGroq is a select() typegen
	// cannot narrow -- so it is checked rather than cast, exactly as HeroBlock
	// does for its own CTA. Truthiness as well as type: a link authored with an
	// empty URL field resolves to "", which is a string and would otherwise beat
	// the fallback and render the label as inert plain text. The fallback itself
	// always yields a path -- pEvents is registered with `slug: false`.
	const ctaHref =
		typeof callToAction?.link?.href === 'string' && callToAction.link.href
			? callToAction.link.href
			: resolveHref({ documentType: 'pEvents', locale });

	return (
		<SectionShell
			appearance={sectionAppearance}
			heading={heading}
			headingLevel={headingLevel}
			// On the heading's baseline rather than in the carousel's nav row, where
			// it read as carousel chrome. Rendering it here also keeps it out of
			// <EventsCarousel>, which is a lazily-loaded CLIENT component -- so this
			// markup is server-rendered rather than shipped as client props.
			//
			// The class string and the href narrowing live at this call site because
			// there is exactly one of them. The moment a second module wants a
			// heading link (productsBlock is the obvious next one), lift both into a
			// shared component rather than copying this -- two visually identical
			// links that drift is the same failure SectionShell was extracted to end.
			headingAction={
				<SectionHeadingLink
					href={ctaHref}
					isNewTab={callToAction?.link?.isNewTab ?? false}
				>
					{callToAction?.label || t.viewAll}
				</SectionHeadingLink>
			}
			className={className}
			bleed
		>
			<EventsCarousel
				label={t.carousel.label}
				previousLabel={t.carousel.previous}
				nextLabel={t.carousel.next}
			>
				{rows.map((event, index) => (
					<EventTicketSlide
						key={event._id}
						event={event}
						index={index}
						locale={locale}
						now={now}
						t={t}
						dateFnsLocale={dateFnsLocale}
					/>
				))}
			</EventsCarousel>
		</SectionShell>
	);
}
