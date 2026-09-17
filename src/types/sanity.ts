import type { AllSanitySchemaTypes } from '@/../sanity.types';
import type { Locale } from '@/lib/i18n';

/**
 * Every `_type` this project's schema actually defines.
 *
 * Derived from the generated union rather than listed, and narrowed to entries
 * carrying an `_id` — that is what separates a DOCUMENT type from the inline
 * object types (`link`, `customImage`, the page modules) that share the union.
 * Sanity's own system types are excluded; nothing here ever tags one.
 */
export type SanityDocumentType = Exclude<
	Extract<AllSanitySchemaTypes, { _id: string }>['_type'],
	`sanity.${string}` | `media.${string}` | `mux.${string}`
>;

/**
 * A cache tag `sanityFetch` accepts.
 *
 * Typed rather than `string[]` because nothing else catches drift here:
 * `/api/revalidate-tag` fires `revalidateTag(body._type)` off the Sanity webhook
 * payload, so a hardcoded tag that no longer names a real schema type simply
 * stops matching — lint, tests and the build all stay green while that content
 * quietly stops revalidating. The union comes from `sanity.types.ts`, so
 * renaming a type fails `tsc` at every stale tag site instead.
 *
 * Three families beyond the schema types, all real and all deliberate:
 *
 * - `shopify` and `shopify:product:<handle>` — fired by
 *   `/api/shopify/revalidate` off the Shopify webhook. Commerce data has no
 *   Sanity `_type`, so it cannot come from the generated union.
 * - `locale:<locale>` — `getCachedSiteData` keys its per-request site data by
 *   locale, so the two locales' chrome can be invalidated independently.
 * - `<type>:<slug>` — the slug-narrowed form the webhook also fires when the
 *   changed document has one.
 */
export type SanityRevalidateTag =
	| SanityDocumentType
	| `${SanityDocumentType}:${string}`
	| 'shopify'
	| `shopify:product:${string}`
	| `locale:${Locale}`;
