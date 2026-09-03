import { ArrowRight } from 'lucide-react';
import CustomLink from '@/components/CustomLink';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
} from '@/lib/image-utils';
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';

/**
 * One authored status pill, shared by the two /events views.
 *
 * Lifted out of PageEvents when the calendar became its second consumer: both
 * views render the same pills from the same `statusList`, and a status that
 * looked different depending on which view you were in would be the same drift
 * SectionShell was extracted to end.
 *
 * Two near-identical copies still exist outside this route — `StatusItem` in
 * `EventsBlock.tsx` and `EventStatusBadge` in `PageEventSingle.tsx` — and that
 * is unfinished business, not a decision. Nothing here needs `'use client'`, so
 * a Server Component can render it; consolidating is a separate change because
 * it has to reconcile their differences (padding, a whole-pill link, and the
 * badge's missing contrast check) rather than assume them away. Until then, do
 * not assume a change here reaches the home-page strip or the event page.
 *
 * `data` stays loosely typed because typegen widens the two brand-colour derefs
 * to `{} | Color | null` and the link's resolved `href` to `unknown`
 * (resolvedHrefGroq is a `select()` it cannot narrow), so the generated row
 * shape does not fit a hand-written prop type. `StatusListItem` in
 * `EventsBlock.tsx` is the better answer and is where a consolidation should
 * start.
 */
export function EventStatusItem({
	data,
	className,
}: {
	data: any;
	className?: string;
}) {
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
				color:
					ensureAccessibleTextColor(statusTextColor, statusBgColor) ||
					'var(--foreground)',
				backgroundColor: buildRgbaCssString(statusBgColor) || 'var(--muted)',
			}}
		>
			{title}
			{link?.href && (
				<>
					<ArrowRight className="size-3" />
					<CustomLink
						className={cn('p-fill rounded-4xl', OVERLAY_LINK_FOCUS)}
						link={link}
						aria-label={title}
					></CustomLink>
				</>
			)}
		</span>
	);
}
