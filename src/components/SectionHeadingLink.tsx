import CustomLink from '@/components/CustomLink';
import { cn, INLINE_LINK_FOCUS } from '@/lib/utils';

// The "see all" link that sits on a SectionShell heading's baseline.
//
// Lifted here on the second consumer, which is the trigger EventsBlock's own
// comment set: "The moment a second module wants a heading link ... lift both
// into a shared component rather than copying this -- two visually identical
// links that drift is the same failure SectionShell was extracted to end."
// EventsBlock and the event detail page's related strips are consumers one and
// two; productsBlock is the obvious third.
//
// Rendered by the caller into SectionShell's `headingAction`, NOT inside the
// carousel: EventsCarousel is a lazily-loaded client component, so keeping this
// out of it means the markup is server-rendered instead of shipped as props.
export default function SectionHeadingLink({
	href,
	isNewTab = false,
	children,
}: {
	href?: string | null;
	isNewTab?: boolean;
	children: React.ReactNode;
}) {
	// Renders nothing without a target, so callers hand the href straight over
	// instead of each guarding it. resolveHref is typed `string | undefined`
	// even where it always yields a path.
	if (!href) return null;
	return (
		<CustomLink
			link={{ href, isNewTab }}
			className={cn(
				't-spec text-foreground/60 hover:text-foreground shrink-0 rounded uppercase transition-[color,box-shadow]',
				INLINE_LINK_FOCUS
			)}
		>
			{children}
		</CustomLink>
	);
}
