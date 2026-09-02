import { stegaClean } from '@sanity/client/stega';
import CustomPortableText from '@/components/CustomPortableText';
import CustomLink from '@/components/CustomLink';
import ImageBlock from '@/components/ImageBlock';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { Button } from '@/components/ui/Button';
import { revealStagger } from '@/lib/animate';
import { cn, hasArrayValue } from '@/lib/utils';

// The page opener: eyebrow, heading, paragraph and an optional call to action
// over an optional background image.
//
// Entrance is the `reveal` utility, not Motion. Both make invisible the default
// state and need something to execute to undo it, so a hero the browser never
// paints -- or one whose JS never hydrates -- would strand the page's own
// heading at opacity: 0. `reveal` puts the hidden value in @starting-style
// instead, so it is only ever a transition start point. The Motion mount
// animation this replaced sat on exactly that heading, which is how the trap was
// found -- don't reintroduce one here.

type HeroBlockProps = {
	data: {
		eyebrow?: string | null;
		heading?: string | null;
		paragraph?: any;
		backgroundImage?: any;
		callToAction?: {
			label?: string | null;
			link?: { href?: unknown; isNewTab?: boolean | null } | null;
		} | null;
		sectionAppearance?: SectionAppearance;
	};
	/**
	 * `h1` when this hero is the page's own title — the homepage, where nothing
	 * above it claims one. PageGeneral already renders an h1 for the page title,
	 * so a hero there is a section heading and stays h2 (the default).
	 */
	headingLevel?: 'h1' | 'h2';
	className?: string;
};

export default function HeroBlock({
	data,
	headingLevel = 'h2',
	className,
}: HeroBlockProps) {
	const {
		eyebrow,
		heading,
		paragraph,
		backgroundImage,
		callToAction,
		sectionAppearance,
	} = data || {};

	const Heading = headingLevel;
	// `href` arrives as `unknown`: resolvedHrefGroq is a select() typegen cannot
	// narrow. A CTA whose link resolves to nothing renders as no CTA at all.
	const ctaHref =
		typeof callToAction?.link?.href === 'string'
			? callToAction.link.href
			: null;
	const ctaLabel = callToAction?.label;

	// Trimmed and stega-cleaned before anything decides whether there is a
	// heading. `src/lib/page-modules.ts` used to do this upstream and was deleted
	// with the old hero fallback; nothing replaced it, so raw truthiness let a
	// heading an editor had blanked to spaces both defeat the emptiness bail
	// below AND render `<h1>   </h1>` -- an a11y failure a crawler reads rather
	// than falling through to the next heading. Draft mode also appends invisible
	// stega characters, which would make any heading look non-empty. A predicate,
	// not the rendered value: the raw `heading` is what gets rendered, so visual
	// editing keeps its stega metadata.
	const hasHeading = !!stegaClean(heading)?.trim();

	// `hasArrayValue`, not raw truthiness: Sanity leaves `paragraph: []` behind
	// when an editor deletes the last portable-text block, and `[]` is truthy --
	// so `!paragraph` could never fire the bail below, and the render gate emitted
	// an empty `.wysiwyg` box. Hoisted to a boolean rather than called inline at
	// both sites because `paragraph` is `any`, and the type guard would narrow it
	// to `unknown[]` where CustomPortableText wants PortableTextBlock[] (the
	// explicit `: boolean` is what stops that aliased narrowing).
	const hasParagraph: boolean = hasArrayValue(paragraph);

	// Same bail as the other modules: an empty hero would still reserve a full
	// viewport of blank page, which is worse than not rendering.
	if (
		!eyebrow &&
		!hasHeading &&
		!hasParagraph &&
		!backgroundImage?.image &&
		!(ctaHref && ctaLabel)
	) {
		return null;
	}

	return (
		<SectionShell
			appearance={sectionAppearance}
			className={cn(
				'min-h-main relative isolate flex flex-col justify-center overflow-hidden',
				className
			)}
		>
			{backgroundImage?.image && (
				// -z-10 with `isolate` above: the image sits behind the copy without
				// escaping into the stacking context of whatever follows the section.
				<div aria-hidden className="absolute inset-0 -z-10">
					<ImageBlock
						imageObj={backgroundImage}
						alt=""
						fill="cover"
						sizes="100vw"
						// No `priority`, for the reason ProductsBlock spells out: exactly
						// one image per page is the LCP candidate and a module cannot know
						// whether the page above it already claimed that.
					/>
				</div>
			)}

			{/* Measure cap. The copy is a column, not a banner: as direct flex
			    children of the section these stretch to `maxWidthClass`, which
			    defaults to `w-full` inside a `p-x-max` inset -- up to
			    --container-max (2000px), roughly 200 characters a line for the
			    paragraph. The background image stays outside this wrapper so it
			    remains full-bleed. An authored `sectionAppearance.maxWidth` still
			    applies on the section, above this. */}
			<div className="max-w-2xl mx-auto">
				{eyebrow && (
					<p className="t-spec reveal mb-3 uppercase" style={revealStagger(0)}>
						{eyebrow}
					</p>
				)}

				{hasHeading && (
					<Heading
						className="t-h-1 reveal text-balance uppercase"
						style={revealStagger(1)}
					>
						{heading}
					</Heading>
				)}

				{hasParagraph && (
					<div className="wysiwyg reveal mt-4" style={revealStagger(2)}>
						<CustomPortableText blocks={paragraph} />
					</div>
				)}

				{ctaHref && ctaLabel && (
					<div className="reveal mt-6" style={revealStagger(3)}>
						<Button asChild size="lg">
							<CustomLink
								link={{
									href: ctaHref,
									isNewTab: callToAction?.link?.isNewTab ?? false,
								}}
							>
								{ctaLabel}
							</CustomLink>
						</Button>
					</div>
				)}
			</div>
		</SectionShell>
	);
}
