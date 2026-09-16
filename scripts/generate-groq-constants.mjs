/**
 * Emits GROQ constants that Sanity TypeGen can statically analyse.
 *
 * TypeGen resolves template interpolations by reading source, but it cannot
 * evaluate function calls. `src/lib/routes.ts` builds the link-resolution
 * expression by mapping over DOCUMENT_ROUTES, so any query interpolating it
 * fails to resolve — and because that expression feeds `linkFields`, which feeds
 * `menuFields`, `callToActionFields` and `portableTextContentFields`, the
 * failure cascades into nearly every page query, which then silently type as
 * `unknown`.
 *
 * Emitting the computed result as a plain string literal keeps DOCUMENT_ROUTES
 * the single source of truth while giving TypeGen something it can parse.
 *
 * Run with `node --experimental-strip-types`, which is what lets this .mjs
 * import a .ts module directly. It does NOT resolve tsconfig `paths` and it does
 * require file extensions — which is why it imports the two LEAF modules
 * (`document-routes.ts`, `i18n.ts`), both of which import nothing, rather than
 * `routes.ts`, which reaches the app graph through `@/` aliases.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'src/sanity/lib/groq-constants.generated.ts');

/** Make a runtime string safe to embed inside a template literal. */
function toTemplateLiteral(value) {
	const escaped = value
		.replace(/\\/g, '\\\\')
		.replace(/`/g, '\\`')
		.replace(/\$\{/g, '\\${');
	return `\`${escaped}\``;
}

const { buildResolvedHrefGroq } = await import('../src/lib/document-routes.ts');
const { DEFAULT_LOCALE, LOCALES } = await import('../src/lib/i18n.ts');

const contents = `// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: src/lib/routes.ts · Generator: scripts/generate-groq-constants.mjs
// Refresh with \`npm run generate:groq\` (also runs via \`predev\`, \`prebuild\` and
// \`typegen\`). \`src/sanity/lib/groq-constants.test.ts\` fails when it is stale.
//
// Sanity TypeGen cannot evaluate function calls when resolving GROQ template
// interpolations, so the expression built from DOCUMENT_ROUTES is materialised
// here as a plain string literal. Edit src/lib/routes.ts, not this file.
//
// \`as const\` is load-bearing: a plain template literal widens to \`string\`, which
// widens every query interpolating it and drops them back to an untyped result.

/** Resolves an internal link object to its locale-aware href. */
export const RESOLVED_HREF_GROQ = ${toTemplateLiteral(buildResolvedHrefGroq(LOCALES, DEFAULT_LOCALE))} as const;
`;

// Written only when the content actually changed. The output is imported by
// queries.ts, so it sits in essentially every route's import graph — and
// Turbopack's and webpack's filesystem caches validate on mtime, so a no-op
// rewrite invalidates them on every predev/prebuild/typegen.
const existing = await fs.readFile(OUT_FILE, 'utf8').catch(() => null);
if (existing === contents) {
	console.log(`✓ ${path.relative(ROOT, OUT_FILE)} already current`);
} else {
	await fs.writeFile(OUT_FILE, contents, 'utf8');
	console.log(`✓ Wrote ${path.relative(ROOT, OUT_FILE)}`);
}
