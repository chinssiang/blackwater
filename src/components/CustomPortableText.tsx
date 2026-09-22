import { PortableText, PortableTextReactComponents } from '@portabletext/react';
import type {
	ArbitraryTypedObject,
	PortableTextBlock,
	PortableTextLink,
	PortableTextSpan,
} from '@portabletext/types';
import { sanitizeEmbedSnippet } from '@/lib/sanitize-embed';
import { cn } from '@/lib/utils';
import CustomLink from '@/components/CustomLink';
import ImageBlock from '@/components/ImageBlock';

const portableTextComponents: Partial<PortableTextReactComponents> = {
	block: {
		h1: ({ children }) => <h1>{children}</h1>,
		h2: ({ children }) => <h2>{children}</h2>,
		h3: ({ children }) => <h3>{children}</h3>,
		label: ({ children }) => <p className="text-sm uppercase">{children}</p>,
	},
	list: {
		bullet: ({ children }) => <ul>{children}</ul>,
		number: ({ children }) => <ol>{children}</ol>,
	},
	types: {
		image: (data) => {
			const { value } = data;
			if (!value?.asset) return;

			const { link } = value || {};
			// The prose column, not the generic `…, 33vw` default, which asked for
			// roughly half the pixels a body image is shown at.
			//
			// 900px is --container-md, the WIDEST constrained prose column this
			// component renders in (PageGeneral's `wysiwyg-page max-w-md`). The
			// narrower call sites -- the product page's `lg:max-w-[60ch]`, a
			// FaqBlock answer -- deliberately over-request against it rather than
			// under-request, since softness is the failure that brought us here and
			// the cap is 900px either way. A Freeform inside a full-bleed
			// SectionShell is the one case this still under-serves.
			//
			// Fixing that properly means the layout owner passing `sizes` down,
			// which is a prop this component does not have and no caller would
			// fill today; SectionShell's own `maxWidth` enum is where it would come
			// from (see MAX_WIDTH_CLASSES in section-appearance.ts).
			const imageSizes = '(max-width: 768px) 100vw, min(90vw, 900px)';

			if (link?.href) {
				return (
					<CustomLink link={link}>
						<ImageBlock imageObj={value} sizes={imageSizes} />
					</CustomLink>
				);
			}
			return <ImageBlock imageObj={value} sizes={imageSizes} />;
		},
		iframe: ({ value }) => {
			const { embedSnippet } = value;
			if (!embedSnippet) {
				return null;
			}
			// Shared with the Studio preview (schemaTypes/objects/custom-iframe.tsx),
			// so the two renderers of this field cannot drift apart.
			const sanitized = sanitizeEmbedSnippet(embedSnippet);
			if (!sanitized) {
				return null;
			}
			const widthMatch = sanitized.match(/width="\s*(\d+)"/);
			const heightMatch = sanitized.match(/height="\s*(\d+)"/);
			const width = widthMatch?.[1];
			const height = heightMatch?.[1];
			const aspectRatio =
				width && height ? Number(width) / Number(height) : 1.77;

			return (
				<div
					className="relative overflow-hidden [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
					style={{ aspectRatio }}
					dangerouslySetInnerHTML={{ __html: sanitized }}
				/>
			);
		},
	},
	marks: {
		link: ({ value, children }) => {
			return <CustomLink link={value}>{children}</CustomLink>;
		},
		callToAction: ({ value, children }) => {
			const { link, isButton } = value || {};
			return (
				<CustomLink link={link} className={cn({ btn: isButton })}>
					{children}
				</CustomLink>
			);
		},
	},
};

export default function CustomPortableText({
	blocks,
}: {
	// Not `PortableTextBlock[]`. TypeGen emits `children?:` as optional on every
	// generated block, while @portabletext/types' PortableTextBlock requires it,
	// so no query result satisfies that type. This is <PortableText>'s own
	// default value type, which the generated shapes do satisfy - and it is what
	// admits the custom `image` / `iframe` members handled below, which are
	// arbitrary typed objects rather than blocks.
	//
	// Nullable because most queries project portable text with a `[]{...}` that
	// yields null on an empty field; the guard below already returns null.
	blocks?: (PortableTextBlock | ArbitraryTypedObject)[] | null;
}) {
	if (!blocks) return null;

	return <PortableText value={blocks} components={portableTextComponents} />;
}
