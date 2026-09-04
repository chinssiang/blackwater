import { ArrowRight } from 'lucide-react';
import CustomLink from '@/components/CustomLink';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
	type SanityColor,
} from '@/lib/image-utils';
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';

/**
 * One authored status pill — the single implementation for every surface that
 * renders a `pEvent.statusList` entry: both `/events` views, the event page and
 * the home-page strip.
 *
 * It lived in three copies before, which is how they drifted: two spellings of
 * the padding, two link treatments, and — the reason this was worth
 * consolidating rather than leaving alone — the event page's copy called
 * `buildRgbaCssString` for the TEXT colour, skipping `ensureAccessibleTextColor`
 * entirely. An authored colour that fails contrast was corrected on `/events`
 * and left unreadable on `/events/[slug]`, for the same status document.
 *
 * Lives in `src/components/` rather than a route folder for the reason
 * `<ProductCard>` does: the moment a consumer outside the route needs it, a
 * route-local home is the wrong one. It is not a Client Component — nothing here
 * uses hooks — so the two Server Components render it directly.
 *
 * The link is an overlay (`p-fill`) rather than wrapping the pill, so a pill can
 * sit inside a row that already has its own stretched link without nesting one
 * `<a>` in another.
 */

/**
 * Typed structurally rather than off the query result: typegen widens the two
 * brand-colour derefs to `{} | Color | null` and the link's resolved `href` to
 * `unknown` (resolvedHrefGroq is a `select()` it cannot narrow), so the
 * generated row shape does not fit its own consumers. Callers pass query rows
 * through `as StatusListItem`; naming the fields keeps the looseness to the two
 * values that actually need it, rather than the `any` the route-local copy used.
 */
export type StatusListItem = {
	/** Present on every Sanity array item; callers use it as the React key. */
	_key?: string | null;
	link?: { href?: unknown; isNewTab?: boolean | null } | null;
	eventStatus?: {
		title?: string | null;
		statusTextColor?: SanityColor | null;
		statusBgColor?: SanityColor | null;
	} | null;
};

export function EventStatusItem({
	data,
	className,
}: {
	data: StatusListItem;
	className?: string;
}) {
	const { link, eventStatus } = data || {};
	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus;
	// Narrowed rather than cast: `href` comes back as `unknown` because
	// resolvedHrefGroq is a `select()` typegen cannot fold, and a status whose
	// link resolves to nothing should render as a plain pill.
	const linkHref = typeof link?.href === 'string' ? link.href : null;

	return (
		<span
			className={cn(
				't-b-2 relative flex items-center gap-0.5 rounded-4xl px-2.5 py-2 uppercase',
				className
			)}
			style={{
				// The author's text colour when it clears AA against their
				// background, a legible neutral when it does not.
				color:
					ensureAccessibleTextColor(statusTextColor, statusBgColor) ||
					'var(--foreground)',
				backgroundColor: buildRgbaCssString(statusBgColor) || 'var(--muted)',
			}}
		>
			{title}
			{linkHref && (
				<>
					<ArrowRight className="size-3" />
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
