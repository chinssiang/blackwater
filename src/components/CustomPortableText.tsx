import sanitizeHtml from 'sanitize-html';
import { PortableText, PortableTextReactComponents } from '@portabletext/react';
import type {
	PortableTextBlock,
	PortableTextSpan,
	PortableTextLink,
} from '@portabletext/types';
import { cn } from '@/lib/utils';
import CustomLink from '@/components/CustomLink';
import ImageBlock from '@/components/ImageBlock';

const portableTextComponents: Partial<PortableTextReactComponents> = {
	block: {
		h1: ({ children }) => <h1>{children}</h1>,
		h2: ({ children }) => <h2>{children}</h2>,
		h3: ({ children }) => <h3>{children}</h3>,
		h4: ({ children }) => <h4>{children}</h4>,
		h5: ({ children }) => <h5>{children}</h5>,
		h6: ({ children }) => <h6>{children}</h6>,
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
			if (link?.href) {
				return (
					<CustomLink link={link}>
						<ImageBlock imageObj={value} />
					</CustomLink>
				);
			}
			return <ImageBlock imageObj={value} />;
		},
		iframe: ({ value }) => {
			const { embedSnippet } = value;
			if (!embedSnippet) {
				return null;
			}
			const sanitized = sanitizeHtml(embedSnippet, {
				allowedTags: ['iframe'],
				allowedAttributes: {
					iframe: [
						'src', 'width', 'height', 'frameborder',
						'allow', 'allowfullscreen', 'title',
						'loading', 'referrerpolicy',
					],
				},
			});
			if (!sanitized) {
				return null;
			}
			const widthMatch = sanitized.match(/width="\s*(\d+)"/);
			const heightMatch = sanitized.match(/height="\s*(\d+)"/);
			const width = widthMatch?.[1];
			const height = heightMatch?.[1];
			const aspectRatio = width && height ? Number(width) / Number(height) : 1.77;

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
	blocks: PortableTextBlock[];
}) {
	if (!blocks) return null;

	return <PortableText value={blocks} components={portableTextComponents} />;
}
