import { defineField } from 'sanity';

/**
 * The SEO + Social Sharing field group for FIELD-level localized document types.
 *
 * Replaces the shared `sharing()` object (objects/sharing.js) for these types:
 * its metaTitle/metaDesc are plain strings, which cannot carry two languages on
 * one document. Kept as a factory for the same reason `sharing()` was one — the
 * group is a paired contract with `i18nSharingFields` in queries.ts, and the two
 * halves have to stay in step.
 *
 * `descFallback` / `imageFallback` name what the query coalesces to after these
 * fields, purely so the help text matches what the page actually does.
 */
type SeoFieldsOptions = {
	/** e.g. 'Excerpt' — omit when the type has no prose field to fall back to. */
	descFallback?: string;
	/** e.g. 'Hero image' — omit when the type has no image to fall back to. */
	imageFallback?: string;
};

export const seoFieldset = {
	name: 'seo',
	title: 'SEO + Social Sharing',
	options: { collapsible: true, collapsed: true },
};

export function seoFields({ descFallback, imageFallback }: SeoFieldsOptions = {}) {
	return [
		defineField({
			name: 'disableIndex',
			title: 'Disable Index',
			type: 'boolean',
			description: 'Instruct search engines not to index or follow this page',
			initialValue: false,
			fieldset: 'seo',
		}),
		defineField({
			name: 'seoTitle',
			title: 'SEO Title',
			type: 'internationalizedArrayString',
			description: 'Overrides the meta title per language. Falls back to Title.',
			fieldset: 'seo',
		}),
		defineField({
			name: 'seoDescription',
			title: 'SEO Description',
			type: 'internationalizedArrayText',
			description: `Overrides the meta description per language. Use no more than 160 characters.${
				descFallback ? ` Falls back to ${descFallback}.` : ''
			}`,
			fieldset: 'seo',
		}),
		defineField({
			name: 'shareGraphic',
			title: 'Share Graphic',
			type: 'image',
			description: `1200 x 630px. Falls back to ${
				imageFallback ? `${imageFallback}, then ` : ''
			}the site default.`,
			fieldset: 'seo',
		}),
	];
}
