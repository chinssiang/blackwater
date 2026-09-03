import CustomLink from '@/components/CustomLink';
import { ArrowRight } from '@/components/SvgIcons';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
	type MaybeSanityColor,
} from '@/lib/image-utils';
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';

// Typed structurally rather than off the query result, because the surfaces that
// render a status read different projections of the same fields -- and because
// typegen widens the two brand-colour derefs to `{} | Color | null` and the
// link's resolved `href` to `unknown` (resolvedHrefGroq is a select() it cannot
// narrow), so no generated shape fits its own consumers. Naming the fields keeps
// the looseness to the two values that actually need it.
export type EventStatusListItem = {
	_key?: string | null;
	link?: { href?: unknown; isNewTab?: boolean | null } | null;
	eventStatus?: {
		title?: string | null;
		// MaybeSanityColor, because typegen projects each brand-colour deref as
		// `{} | Color | null`. The colour helpers in image-utils accept and narrow
		// that shape themselves, so no call site needs a cast.
		statusTextColor?: MaybeSanityColor;
		statusBgColor?: MaybeSanityColor;
	} | null;
};

/**
 * One status chip, shared by the /events rows, the event page and the ticket
 * stub. It was three near-identical copies until an arrow-nudge was added to one
 * of them and the same pill started easing on one page and snapping on another.
 *
 * Colours come from the referenced brand-colour documents, with
 * `ensureAccessibleTextColor` deciding the foreground against the authored
 * background.
 *
 * The two var() fallbacks are load-bearing as a PAIR, not just an empty-state
 * nicety. When a status authors no background this pill's surface is
 * var(--muted) -- a theme token the server cannot resolve -- so the helper
 * returns false rather than guess, and var(--foreground) is what makes the
 * result legible in both themes (7.73:1 dark, 18.16:1 light against --muted).
 * Do not "simplify" either side to a literal colour, and do not fall back to the
 * authored ink here: that is the exact bug the helper's early return prevents.
 * See the comment in ensureAccessibleTextColor.
 *
 * `className` is the callers' only escape hatch: the base padding is the
 * ticket's (`py-1`), and the /events row and the event page pass `py-2` plus,
 * on /events, the dimming for an ended event.
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
