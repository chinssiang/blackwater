import customIframe from '@/sanity/schemaTypes/objects/custom-iframe';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { link } from '@/sanity/schemaTypes/objects/link';
import { PortableTextNormalizer } from '@/sanity/schemaTypes/components/PortableTextNormalizer';
import { BlockquoteIcon, InfoOutlineIcon } from '@sanity/icons';
import { defineType } from 'sanity';
import type { ReactNode } from 'react';

type StyleProps = { children?: ReactNode };
type BlockquoteProps = StyleProps & { renderDefault: (props: BlockquoteProps) => ReactNode };

const H2 = (props: StyleProps) => <span>{props.children}</span>;
const H3 = (props: StyleProps) => <span>{props.children}</span>;
const H4 = (props: StyleProps) => <span>{props.children}</span>;
const H6 = (props: StyleProps) => <span>{props.children}</span>;
const Normal = (props: StyleProps) => <span>{props.children}</span>;
const Normal2 = (props: StyleProps) => <span>{props.children}</span>;
const Blockquote = (props: BlockquoteProps) => {
	return (
		<blockquote className="before:inline before:content-[open-quote] after:inline after:content-[close-quote]">
			{props.renderDefault(props)}
		</blockquote>
	);
};

export const portableText = defineType({
	name: 'portableText',
	type: 'array',
	components: {
		// Sanity infers `ArrayOfPrimitivesInputProps` for this slot but at
		// runtime portableText is an array of objects, so the normalizer's
		// shape is correct. Cast through unknown to bridge the inference gap.
		input: PortableTextNormalizer as unknown as never,
	},
	of: [
		{
			title: 'Block',
			type: 'block',
			styles: [
				{
					title: 'Heading 2',
					value: 'h2',
					component: H2,
				},
				{
					title: 'Heading 3',
					value: 'h3',
					component: H3,
				},
				{
					title: 'Heading 4',
					value: 'h4',
					component: H4,
				},
				{ title: 'Heading 6', value: 'h6', component: H6 },
				{ title: 'Paragraph', value: 'normal', component: Normal },
				{ title: 'Paragraph 2', value: 'normal-2', component: Normal2 },
			],
			lists: [
				{ title: 'Bullet', value: 'bullet' },
				{ title: 'Numbered', value: 'number' },
			],
			marks: {
				decorators: [
					{ title: 'Bold', value: 'strong' },
					{ title: 'Italic', value: 'em' },
					{ title: 'Underline', value: 'underline' },
				],
				annotations: [
					{
						name: 'blockquote',
						type: 'object',
						title: 'Quote',
						icon: BlockquoteIcon,
						fields: [
							{
								name: 'author',
								type: 'string',
							},
							{
								name: 'title',
								type: 'string',
							},
							{
								name: 'isHidden',
								type: 'boolean',
								initialValue: true,
							},
						],
						components: { annotation: Blockquote },
					},
					link({
						showLabel: false,
						options: {
							modal: { type: 'dialog' },
						},
					}),
					link({
						title: 'Button',
						name: 'callToAction',
						showLabel: false,
						icon: InfoOutlineIcon,
						options: {
							modal: { type: 'dialog' },
						},
					}),
				],
			},
		},
		customImage({ hasLinkOption: true, hasCaptionOption: true }),
		customIframe(),
	],
});
