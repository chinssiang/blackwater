import type {
	ArbitraryTypedObject,
	PortableTextBlock,
} from '@portabletext/types';
import { stegaClean } from '@sanity/client/stega';
import type { ImageBlockObj } from '@/lib/image-utils';
import type { SectionAppearance } from '@/lib/section-appearance';
import { hasArrayValue } from '@/lib/utils';
import { toVimeoEmbedUrl } from '@/lib/vimeo';

// A leaf module for the reason hero-block.ts gives: the Node test suite can ask
// whether an editorialBlock renders without importing <EditorialBlock>'s
// client graph.

export type EditorialBlockData = {
	// Both resolved to booleans in GROQ (editorialBlockField), never the raw
	// radio strings.
	backgroundLayout?: boolean | null;
	imageRight?: boolean | null;
	eyebrow?: string | null;
	heading?: string | null;
	paragraph?: (PortableTextBlock | ArbitraryTypedObject)[] | null;
	image?: ImageBlockObj | null;
	callToAction?: {
		label?: string | null;
		// Exactly one target family is projected, by the CTA's `action`.
		link?: { href?: unknown; isNewTab?: boolean | null } | null;
		vimeoUrl?: string | null;
		videoFile?: { url?: string | null; mimeType?: string | null } | null;
	} | null;
	sectionAppearance?: SectionAppearance;
};

export type EditorialVideo =
	{ vimeoEmbedUrl: string } | { fileUrl: string; mimeType?: string | null };

export type EditorialCta =
	| { label: string; video: EditorialVideo }
	| { label: string; href: string; isNewTab: boolean };

/**
 * The CTA the block renders, or null when it has none it can open. It needs a
 * label AND a target: a playable video, which wins, or a resolved link. The one
 * definition both the component's button and `editorialBlockIsRenderable` read,
 * so the bail and the rendered button cannot disagree.
 */
export function resolveEditorialCta(
	callToAction: EditorialBlockData['callToAction']
): EditorialCta | null {
	const label = callToAction?.label;
	if (!label) return null;

	const vimeoEmbedUrl = toVimeoEmbedUrl(callToAction.vimeoUrl);
	if (vimeoEmbedUrl) return { label, video: { vimeoEmbedUrl } };

	const fileUrl = callToAction.videoFile?.url;
	if (fileUrl) {
		return {
			label,
			video: { fileUrl, mimeType: callToAction.videoFile?.mimeType },
		};
	}

	// `href` arrives as `unknown`: resolvedHrefGroq is a select() typegen cannot
	// narrow.
	const href = callToAction.link?.href;
	return typeof href === 'string' && href
		? { label, href, isNewTab: callToAction.link?.isNewTab ?? false }
		: null;
}

/**
 * Whether an editorialBlock will render anything at all — the same condition
 * the component bails on, exported on `heroBlockIsRenderable`'s model.
 */
export function editorialBlockIsRenderable(data: EditorialBlockData): boolean {
	const { eyebrow, heading, paragraph, image, callToAction } = data || {};
	return !!(
		image?.image ||
		eyebrow ||
		stegaClean(heading)?.trim() ||
		hasArrayValue(paragraph) ||
		resolveEditorialCta(callToAction)
	);
}
