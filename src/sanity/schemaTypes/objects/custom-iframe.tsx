'use client';

import { LinkIcon } from '@sanity/icons';
import { sanitizeEmbedSnippet } from '@/lib/sanitize-embed';
import type { PreviewProps } from 'sanity';

type IframePreviewProps = PreviewProps & { embedSnippet?: string };

const Preview = (props: IframePreviewProps) => {
	const { embedSnippet, renderDefault } = props;
	if (!embedSnippet) {
		return <div>Missing Embed Snippet</div>;
	}

	// Sanitized, exactly as the frontend renderer does. This preview runs inside
	// the Studio, so an unsanitized snippet is script execution in another
	// editor's authenticated session -- strictly worse than the same snippet on
	// the public site. Both paths share one sanitizer so they cannot drift.
	const sanitized = sanitizeEmbedSnippet(embedSnippet);

	return (
		<div className="iframe-preview">
			{renderDefault({ ...props, title: 'Iframe Embed' })}
			{sanitized ? (
				<div dangerouslySetInnerHTML={{ __html: sanitized }} />
			) : (
				<div>Embed snippet contains no renderable iframe</div>
			)}
			<style jsx>{`
				:global(.iframe-preview iframe) {
					width: 100%;
				}
			`}</style>
		</div>
	);
};

export default function customIframe({ ...props } = {}) {
	return {
		type: 'object',
		title: 'Iframe',
		name: 'iframe',
		icon: LinkIcon,
		fields: [{ title: 'Embed Snippet', name: 'embedSnippet', type: 'text' }],
		preview: {
			select: {
				embedSnippet: 'embedSnippet',
			},
		},
		components: {
			preview: Preview,
		},
		...props,
	};
}
