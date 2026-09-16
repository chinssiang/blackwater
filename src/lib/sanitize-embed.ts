import sanitizeHtml from 'sanitize-html';

/**
 * A leaf module on purpose, NOT part of `lib/utils.ts`.
 *
 * `utils.ts` exports `cn` and the shared class constants, so effectively every
 * component imports it. Putting `sanitize-html` there would pull the parser into
 * every one of those bundles for the sake of two call sites. Same reasoning that
 * keeps `dateFnsLocale.ts` out of `i18n.ts` and `tabsTriggerVariants.ts` out of
 * `ui/Tabs.tsx`.
 */

/** Generous cap on an unbounded Sanity `text` field that is parsed on render. */
const MAX_SNIPPET_LENGTH = 20_000;

/**
 * Sanitize an editor-pasted embed snippet down to a bare `<iframe>`.
 *
 * The `iframe` portable-text block stores a raw snippet an editor copies from
 * YouTube, Vimeo, a map provider and so on, and BOTH the site and the Studio
 * preview write it straight into the DOM. Anything but an `<iframe>` is
 * therefore script execution — in the visitor's browser (`<img onerror>`,
 * `<svg onload>`), or, for the Studio preview, in another editor's
 * authenticated session, which is the more serious of the two.
 *
 * Allowing only `iframe`, and only these attributes, drops every event handler
 * and `srcdoc` with them. The remaining capability — pointing an iframe at an
 * arbitrary https origin — is the feature itself.
 *
 * `allowedSchemes` is narrowed to https: sanitize-html's default list also
 * permits http, ftp and mailto, and an http embed is a mixed-content warning on
 * every page that carries it.
 */
export function sanitizeEmbedSnippet(html?: string | null): string {
	if (!html) return '';

	return sanitizeHtml(html.slice(0, MAX_SNIPPET_LENGTH), {
		allowedTags: ['iframe'],
		allowedAttributes: {
			iframe: [
				'src',
				'width',
				'height',
				'title',
				'loading',
				'allow',
				'allowfullscreen',
				'frameborder',
				'referrerpolicy',
			],
		},
		allowedSchemes: ['https'],
	});
}
