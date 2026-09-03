import CustomLink from '@/components/CustomLink';
import { ArrowRight } from '@/components/SvgIcons';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
	type SanityColor,
} from '@/lib/image-utils';
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';

// Typed structurally rather than off the query result: typegen widens the two
// brand-colour derefs to `{} | Color | null` and the link's resolved `href` to
// `unknown` (resolvedHrefGroq is a select() it cannot narrow), so the generated
// shape does not fit its own consumers. Naming the fields keeps the looseness to
// the two values that actually need it.
export type EventStatusListItem = {
	link?: { href?: unknown; isNewTab?: boolean | null } | null;
	eventStatus?: {
		title?: string | null;
		statusTextColor?: SanityColor | null;
		statusBgColor?: SanityColor | null;
	} | null;
};

/**
 * One status chip, shared by the /events rows and the home-page ticket. It was
 * two near-identical copies until an arrow-nudge was added to one of them and
 * the same pill started easing on one page and snapping on the other.
 *
 * Colours come from the referenced brand-colour documents, with
 * `ensureAccessibleTextColor` deciding the foreground against the authored
 * background; the var() fallbacks keep it legible when a status has no colours
 * set. `className` is the callers' only escape hatch — /events uses it for row
 * padding and to dim ended events.
 */
export default function EventStatusPill({
	data,
	className,
}: {
	data: EventStatusListItem;
	className?: string;
}) {
	const { link, eventStatus } = data || {};
	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus;
	// Narrowed rather than cast: `href` comes back as `unknown` because
	// resolvedHrefGroq is a select() typegen cannot fold, and a status whose link
	// resolves to nothing should render as a plain pill.
	const linkHref = typeof link?.href === 'string' ? link.href : null;

	return (
		<span
			className={cn(
				'group/pill t-b-2 relative flex items-center gap-0.5 rounded-4xl px-2.5 py-1 uppercase',
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
			{linkHref && (
				<>
					<ArrowRight className="size-3 transition-transform duration-300 ease-out group-hover/pill:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/pill:translate-x-0" />
					<CustomLink
						className={cn('p-fill rounded-4xl', OVERLAY_LINK_FOCUS)}
						link={{ href: linkHref, isNewTab: link?.isNewTab ?? false }}
						aria-label={title ?? undefined}
					/>
				</>
			)}
		</span>
	);
}
