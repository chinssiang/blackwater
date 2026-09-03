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
 * `<EventsBlock>` keeps its own near-identical copy on purpose — it is a Server
 * Component in a different tree, and the note there explains why its typing
 * differs. Two copies with a stated reason, not three by accident.
 *
 * `data` stays loosely typed for the reason that copy documents: typegen widens
 * the two brand-colour derefs to `{} | Color | null` and the link's resolved
 * `href` to `unknown` (resolvedHrefGroq is a `select()` it cannot narrow), so
 * the generated row shape does not fit a hand-written prop type.
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
