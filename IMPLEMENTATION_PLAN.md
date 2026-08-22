# Shopify ↔ Sanity Product Integration Plan

## Goal

Product detail pages reflect Shopify admin automatically (price, availability, purchase
URL), while Sanity stays the home of everything editorial. Kill the hand-maintained
`price` string and `soldOut` toggle drift.

## Architecture Decision

**Hybrid: Sanity owns editorial, Shopify owns commerce, joined at render time by
product handle.**

- Each `pProduct` gets a `shopify` field storing the Shopify **product handle** (and
  optionally a variant GID). This is the only coupling between the two systems.
- The Next.js server fetches live commerce data (price, compare-at, availability,
  variants) from the **Shopify Storefront GraphQL API** inside the product page's
  server component, cached with `fetch` tags.
- Shopify **webhooks** (`products/update`, `products/delete`,
  `inventory_levels/update`) hit a Next.js route that calls `revalidateTag()` — same
  pattern as the existing Sanity `/api/revalidate-tag` route. Pages are static-fast but
  never stale after an admin edit.
- We do **not** sync Shopify data into the Sanity dataset (no Sanity Connect app, no
  mirrored `shopify.product` documents) — see "Why not sync" below.

### Data ownership matrix

| Data | Source of truth | How it reaches the page |
| --- | --- | --- |
| Price, compare-at price, currency | Shopify | Storefront API at render, tag-cached |
| Availability / sold out | Shopify (`availableForSale`) | Storefront API; replaces manual `soldOut` |
| Variants / options (if shown) | Shopify | Storefront API |
| Purchase URL | Derived from handle (`https://<store>/products/<handle>`), `purchaseLink` as manual override | Computed server-side |
| Title, slug, routing | Sanity | Unchanged (site URLs stay `/products/<sanity-slug>`) |
| Images / art direction | Sanity (`mainImage`, LQIP pipeline) | Unchanged |
| Editorial (content, whyUseIt, whoIsItFor, whenReachForIt, metadata) | Sanity | Unchanged |
| Taxonomy (categories, brands, collections), size chart, related products | Sanity | Unchanged |
| Localization (en / zh_tw) | Sanity document i18n | Unchanged; both locale docs point at the same handle |
| SEO / sharing | Sanity | Unchanged |

### Why runtime fetch instead of syncing into Sanity

- **Sanity Connect for Shopify** (the official sync app) mirrors products into the
  dataset. It's the right call for large catalogs queried heavily via GROQ, but here:
  it syncs to **one dataset per store** (awkward with our dev/prod datasets), fixes the
  document shape, and inventory freshness still lags the sync. Our catalog is small and
  curated; we need exactly three live facts (price, availability, URL).
- Runtime fetch + webhook revalidation gives strictly fresher data with ~2 small files
  of infrastructure and no third-party app. If we later want full product data in GROQ
  (e.g. Shopify-driven listing pages), Sanity Connect can be added without undoing this.

### Which Shopify APIs

- **Storefront API** (public storefront token, server-side anyway): all page reads.
  Generous rate limits; with ISR caching, usage is negligible.
- ~~**Admin API** (private token, server-only): only for the Studio product-search picker
  (Stage 4) and optional webhook registration script.~~ Superseded — see the amendment
  at the end of this file. The picker runs on the Storefront API; no Admin API is used.
- Pin `SHOPIFY_API_VERSION` (quarterly releases); upgrade deliberately.

### Environment variables (add to `.env` + Vercel)

```
SHOPIFY_STORE_DOMAIN=<store>.myshopify.com
SHOPIFY_STOREFRONT_PRIVATE_TOKEN= # private Storefront token (Headless channel)
SHOPIFY_API_VERSION=2026-01     # pinned
SHOPIFY_WEBHOOK_SECRET=         # Stage 3
```

Setup prerequisite: add the **Headless** sales channel in the Shopify admin, create a
storefront, enable its Storefront API permissions (`unauthenticated_read_product_listings`,
`unauthenticated_read_product_inventory`) and copy the **private** access token (all
calls are server-side; public tokens are throttled per buyer IP). Full walkthrough:
`docs/SHOPIFY-SETUP.md`.

---

## Stage 1: Shopify client + schema link

**Goal**: Typed Storefront API client and the `shopify` link field on `pProduct`.
**Success Criteria**:
- `src/lib/shopify/client.ts` — plain `fetch` GraphQL wrapper (no new deps): takes a
  query + variables, injects domain/token/version from env, throws descriptive errors
  on GraphQL/userErrors, supports `next: { revalidate, tags }` passthrough.
- `src/lib/shopify/queries.ts` — `productByHandle` query (price range, compare-at,
  `availableForSale`, variants w/ selectedOptions, `onlineStoreUrl`) and
  `productsByHandles` batch query (`nodes` lookup for listing pages).
- `src/lib/shopify/types.ts` — response types, `formatShopifyPrice()` helper
  (Intl.NumberFormat, respects `currencyCode`).
- `pProduct` schema: new `shopify` object — `handle` (string, for now hand-pasted),
  optional `variantGid`. Manual `price` / `soldOut` / `purchaseLink` stay and become
  labeled as fallbacks ("used when no Shopify product is linked").
- `npm run typegen` clean; existing pages unaffected.
**Tests**: client unit tests (env missing → throws; GraphQL errors surfaced); price
formatting cases (TWD/USD, no trailing `.00` for zero-decimal display choice).
**Status**: Complete

## Stage 2: Live data on the product detail page

**Goal**: `/[locale]/products/[slug]` renders Shopify-truth price/availability.
**Success Criteria**:
- `getProductCommerce(handle)` server helper: fetches with
  `tags: ['shopify', 'shopify:product:<handle>']`, `revalidate: 3600` as backstop.
- Precedence in `PageProductSingle`: linked handle → Shopify data; no handle → existing
  manual fields (zero regression for unlinked products).
- Variant picker: option groups from Shopify `options[]`; selected combination
  resolves the variant driving price, compare-at, availability, and buy URL.
  Single-default-variant products render exactly as today (no picker).
- Sold-out state + `BackInStockForm` visibility driven by `availableForSale` of the
  selection (manual `soldOut` still forces it on as an editorial override).
- Purchase button URL: `purchaseLink` override → else Shopify `onlineStoreUrl` /
  derived product URL; referral params still appended.
- Listing cards (`ProductCard` surfaces price): index/category/collection pages batch
  one `productsByHandles` call per render — no per-card fetches.
- Shopify fetch failure degrades gracefully (falls back to manual fields, logs; page
  never 500s because commerce data was unreachable).
**Tests**: precedence unit tests (linked/unlinked/fetch-failed); manual verify one
linked product page shows Shopify price and flips to sold-out when stock zeroed.
**Status**: Complete

## Stage 3: Webhook-driven freshness

**Goal**: Admin edits in Shopify appear on the site within seconds, not on TTL.
**Success Criteria**:
- `src/app/api/shopify/revalidate/route.ts`: verifies `X-Shopify-Hmac-Sha256` (raw
  body + `SHOPIFY_WEBHOOK_SECRET`, timing-safe compare), maps
  `products/update|delete` payload handle → `revalidateTag('shopify:product:<handle>')`,
  `inventory_levels/update` (no handle in payload) → broad `revalidateTag('shopify')`.
- Webhooks registered in Shopify admin (documented in the route file header, mirroring
  the Sanity revalidate route's setup comments).
- Invalid HMAC → 401, logged; replay of same event is harmless (idempotent).
**Tests**: HMAC verification unit tests (valid/invalid/missing); manual end-to-end:
change a price in Shopify admin → page updates without redeploy.
**Status**: Complete

## Stage 4: Studio product picker (editor UX)

**Goal**: Editors link a Shopify product by searching, not pasting handles.
**Success Criteria**:
- `src/app/api/shopify/search/route.ts` (server-only Admin API `products` search,
  returns id/handle/title/status/thumbnail only — published catalog data).
- Custom Sanity input component on `shopify.handle`: search-as-you-type, stores
  handle + GID + a title/thumbnail snapshot for the Studio preview; shows a "linked"
  card with status (active/draft) and an "open in Shopify admin" link.
- `pProduct` preview subtitle shows 🔗 when linked.
- Validation: warning when both a handle and a manual `price` are set.
**Tests**: manual — search, link, preview renders; unlinked flow unchanged.
**Status**: Complete

## Stage 5: Handle inheritance across translations

**Goal**: A translated product never silently loses live commerce because an editor
forgot to mirror the handle onto that language version.
**Success Criteria**:
- `shopifyHandleField` in `queries.ts` coalesces `shopify.handle` to a slug-matched
  sibling document's handle, preferring `en`. Projected once, in `productCardFields`,
  so every product query inherits it.
- `p-product.ts` handle description tells editors to set it once.
- `/zh_tw/products/communion-t-new-balance-redux` renders `NT$1,480` and a variant
  picker where it previously rendered the bare manual string `1,480`.
**Tests**: manual — both locales of a product with the handle set on `en` only;
`npm run typegen` shows `shopifyHandle` still typed `string | null`.
**Status**: Complete

## Stage 6: On-site cart & Shopify checkout

**Goal**: This site is the store. Browsing, variant choice and the cart stay on our
domain; the shopper leaves only for Shopify's hosted checkout. Replaces the outbound
Online Store link, which was also broken — products aren't published to that channel
and the storefront is password-gated, so it 302'd to `/password`.
**Success Criteria**:
- `src/lib/shopify/cart.ts` — `getCart` / `createCart` / `addCartLines` /
  `updateCartLine` / `removeCartLine`. Uncached (`no-store`, no tags); market pinned
  once via `buyerIdentity.countryCode`, no `@inContext` on cart calls; errors
  propagate instead of soft-failing.
- `src/app/api/shopify/cart/route.ts` — GET + POST (zod union: add/update/remove),
  cart id in an httpOnly cookie, expired-cart recovery, per-IP rate limit.
- `CartProvider` / `CartButton` / `CartDrawer` under `src/components/cart/`.
- Product page: "Add to cart" opens the drawer. `purchaseLink` and the sold-out
  branch are unchanged.
- Orphans removed: `shopifyVariantUrl`, `ProductCommerce.url`, `onlineStoreUrl`.
**Tests**: manual — curl the route (add/accumulate/update/remove/persist, 400 on a
bad merchandise id, 409 on update with no cart); browser in both locales (add →
drawer, stepper → subtotal, decrement to 0 → empty state, reload → cart persists,
Shopify thumbnails load without CSP violations); `purchaseLink` product still shows
an outbound "Buy it ↗" with UTM params.
**Status**: Complete

## Later / optional — explicitly out of scope

- Klaviyo's native Shopify back-in-stock trigger replacing the custom list flow.
- Sanity Connect sync if listing pages should be driven by the Shopify catalog.
- Migration script deleting manual `price`/`soldOut` once all products are linked.
- Unlinked products still render the raw manual `price` string, which carries no
  currency (e.g. `1,880`). Either require a currency in the field or format it.

---

## Confirmed decisions (2026-08-07)

1. **Shopify Markets multi-currency**: all Storefront queries carry `@inContext`.
   Locale → market mapping lives in one constant in `src/lib/shopify/`:
   `zh_tw` → `{ country: TW, language: ZH_TW }`, `en` → store default market.
   Next.js caches per variables object, so contexts are cached independently;
   revalidation tags stay per-handle (invalidating all contexts at once).
2. **Variant/size selection is in scope for Stage 2**: option groups (e.g. Size)
   render as a picker; price, availability, and the buy URL (`?variant=<id>`) follow
   the selected variant. Products with only the default variant show no picker.
   Back-in-stock form appears when the selected variant (or whole product) is
   unavailable; manual `soldOut` stays as a page-level editorial override.
3. **Purchase stays link-out to Shopify** — no on-site cart. Stage 5 unchanged.

---

## Amendment (2026-08): Shopify credential model change

Stages 1–4 above shipped as recorded and are left unedited. This amendment records
a change on Shopify's side that invalidated one of their assumptions.

**What happened.** On 2026-01-01 Shopify removed custom-app creation from the Shopify
admin ("Settings → Apps and sales channels → Develop apps"). That flow was the only
source of a static `shpat_` Admin API access token, which Stage 4's Studio picker
depended on. Apps are now created in the Dev Dashboard, which issues a Client ID +
Client Secret; Admin tokens must be minted via the client-credentials grant and expire
every 24 hours. Existing admin-created apps still work — this store has none.

**What we did.** Rather than adopt client-credentials token minting, **Stage 4's Admin
API dependency was removed entirely**. `/api/shopify/search` now runs on the Storefront
API via the existing `shopifyStorefrontFetch` transport: `product(handle:)` for exact
lookups, `search(… types: [PRODUCT], prefix: LAST)` for free text. `SHOPIFY_ADMIN_API_TOKEN`
is retired.

**Why.**

- The integration needs one credential instead of three, and the Storefront token was
  already mandatory for page rendering.
- The Admin-only safety scaffolding the route carried (`status:active` ANDed into every
  query, search-term quoting, handle sanitizing) existed solely to make an Admin
  credential safe behind an endpoint that cannot identify its caller. A public
  Storefront token makes the invariant structural rather than remembered.
- Because `status:active` was already forced, the picker never surfaced drafts, so
  nothing was lost — the `status` field it returned could only ever be `ACTIVE`, making
  the Studio's DRAFT/ARCHIVED badges dead code. They were removed.
- It fixes a real bug class: Admin `status:active` ≠ resolvable by the storefront. A
  product active but unpublished to the Storefront token's sales channel used to be
  linkable in the Studio while the product page silently fell back to manual fields.
  The picker and the page now see exactly the same set of products.

**Cost.** Products must be published to the Headless storefront's sales channel to be
pickable — which was already required for their prices to render. Draft products cannot
be pre-linked, which `status:active` already prevented; handles can still be pasted by
hand via the degraded input.

**If Admin API access is ever needed again** (inventory quantities, draft products,
scripted webhook registration), add a `src/lib/shopify/admin.ts` that mints and caches
a client-credentials token. Nothing in this change stands in the way.

---

## Product-family field-level i18n merge (2026-08-13)

One document per product/collection — prose in `internationalizedArray`s (incl.
Portable Text), commerce identity stored once, Shopify-style. Replaces the
document-level model whose duplicated invariant fields caused real bugs (the
currencyless `1,480` price; Component SS T's zh doc carrying Communion T's handle).

## Stage A: Schema + Studio (field-level product family)
**Status**: Complete — `fieldTypes` gains `portableTextSimple` + built-in
`languageFilter`; `pProduct`/`pProductCollection` drop `language()`+`sharing()`
for i18n arrays + a category-style seo fieldset; slugs use `isUniqueAcrossType`;
picker filters deleted (they matched a product `language` field that no longer
exists); desk lists are plain documentTypeLists.

## Stage B: Transition-tolerant queries + frontend
**Status**: Complete — projections carry `select(defined(language) => …)` tails
so un-merged data still renders (proven: full build + browse against old-shape
dev data before migrating). Visibility/hreflang/sitemap now key off
`title[].language`; the sitemap fix also restored the missing
`/zh_tw/products/categories/*` URLs (pre-existing bug).

## Stage C: Merge migration (dev)
**Status**: Complete — `scripts/merge-product-i18n.mjs` (dry-run by default,
`--execute` to write): merged 78 canonicals, repointed 2 referencing docs,
deleted 74 zh docs + 76 `translation.metadata`, in one transaction. Re-run is a
no-op. Dev dataset backed up first (`../../backups/dev-*.ndjson.gz`).

## Stage D: Prod choreography
**Status**: Not Started — at the next deploy:
1. **Announce a content freeze on products/collections** and confirm no drafts
   exist. This is not optional politeness: between deploy and migration the
   schema uses `isUniqueAcrossType`, so every existing en/zh sibling pair
   (~68 on prod) shares a slug and *fails* slug validation. An editor who edits
   a product in that window cannot publish it, the edit persists as a draft,
   and the migration's draft guard then refuses to run — the only way out is
   discarding their work. The window also has the Studio listing each product
   twice with no language tag, and `price` validation no longer waiving a
   translation whose handle is inherited. Keep the window minutes, not hours.
2. `npx sanity dataset export prod` (backup).
3. Deploy this build (tolerant queries prerender correctly from old prod data).
4. `set -a; . ./.env.local; set +a; SANITY_DATASET=prod node scripts/merge-product-i18n.mjs` (dry-run,
   check the plan **and the "carried from zh siblings" list**), then `--execute`.
   Guards abort on drafts (of any type, including ones referencing zh docs) and
   on genuine field conflicts.
5. Spot-check both locales + `/sitemap/products.xml`.

## Stage E: Post-prod cleanup
**Status**: Not Started — after Stage D only: strip the transition tails
(`select(defined(language) => …)`, `shopifyHandleField`'s sibling coalesce,
`productLocaleFilter`'s old-shape branches), then simplify `CLAUDE.md`'s
transition notes and retire the merge script.

---

# Audit Must-Fix Plan (2026-08-22)

Fixes for the eight must-fix findings from the full-site audit (revalidation tags,
Klaviyo, consent, routing, schema). Design decision for finding 1: **per-page tags**
(each page's `tags` array lists every type its GROQ query dereferences), not
webhook-side expansion — it matches the existing pattern (`products/[slug]` already
tags `pProductCategory` + `gSizeChart`), keeps the dependency declared beside the
query that creates it, and needs zero webhook changes.

## Stage 1: Revalidation tag coverage
**Goal**: Every Sanity edit that can change a prerendered page invalidates it.
**Changes**:
- Home + `[slug]` general: add `gFaq`, `settingsBrandColors` (faqList derefs
  `questions[]->`; sectionAppearance derefs `backgroundColor->`/`textColor->`).
- `/events`: add `gLocation`, `pEventStatus`, `pEventCategory`, `settingsBrandColors`.
- `/events/[slug]`: same four.
- `/events-crew` (both fetches): add `gLocation`, `pEventCategory`, `settingsBrandColors`.
- Product pages using `productCardFields` (index, all, categories, collections): add `pBrand`.
- `/products/[slug]`: add `gTag`, `pBrand`.
- `SITE_DATA_TAGS`: add `pGeneral`, `pProduct`, `pEvent` (nav labels fall back to
  `internalLink->title`; cart recommendations deref `pProduct`).
**Success criteria / verify**: `npm run lint` + `npm run build` pass; grep confirms each
page's tags are a superset of its query's dereferenced types.
**Status**: Complete

## Stage 2: Klaviyo newsletter hardening
**Goal**: `/api/newsletter/subscribe` can no longer write to arbitrary lists, can't be
scripted freely, and stops rejecting valid emails.
**Changes**:
- Resolve the list ID server-side from `gNewsletter.klaviyoListID` (`stega: false`),
  mirroring `back-in-stock`; stop accepting `listId` from the client (client stops
  sending it).
- Add the same in-memory per-IP throttle the other write routes use.
- Guard `req.json()` (400 on malformed body).
- Fix `validateEmail` regex: allow `+` etc. in the local part and TLDs > 3 chars.
**Success criteria / verify**: build passes; regex unit-checked against
`user+tag@gmail.com`, `you@example.info`, and rejects `foo@bar`, `foo`.
**Status**: Complete

## Stage 3: Consent invariant + CSP
**Goal**: One gtag talker, gated by consent; GA4 works for EEA visitors.
**Changes**:
- Move the SPA `gtag.pageview` effect from `Layout` into `HeadTrackingCode`, gated on
  `IS_PROD && consent.analytics`, iterating every `gaID` (fixes withdrawal leak and the
  `[0]`-only pageviews).
- Add `https://region1.google-analytics.com` to CSP `connect-src`.
**Success criteria / verify**: grep shows no `gtag` usage outside `HeadTrackingCode`/
`lib/gtag`; build passes.
**Status**: Complete

## Stage 4: Route + schema one-liners
**Goal**: `/events` stops redirecting; category slugs are actually unique.
**Changes**:
- `routes.ts`: `pEvents` path `/events/` → `/events` in both `DOCUMENT_ROUTES` and the
  `resolvedHrefGroq` literal.
- `p-product-category.ts`: `slug()` → `slug({ isUnique: isUniqueAcrossType })`.
- `npm run typegen` (schema + query literals changed).
**Success criteria / verify**: grep shows no `'/events/'` left in routes.ts; typegen +
build pass.
**Status**: Complete

## Stage 5: Should-fix — revalidation & caching
**Goal**: Publishes take effect on the first request; no unbounded cache growth.
- `revalidateTag(tag, 'max')` → `{ expire: 0 }` in both webhook routes (was
  stale-while-revalidate, so every publish was one request behind).
- `[...rest]` soft-404: `robots: noindex` so 200-response not-founds stop being indexed.
- `generateStaticParams` slug fetches: pass real tags (were defaulting to `sanity`,
  which nothing invalidates — a stale slug list can skip prerendering new docs).
- `sitemap.ts`: route the raw client fetch through tags instead of no-cache.
**Status**: Not Started

## Stage 6: Should-fix — Klaviyo UX & payloads
**Goal**: Errors are distinguishable; success always renders; variant identity survives.
- Both clients read the response body and surface 429 / config errors distinctly.
- Newsletter success panel falls back to dictionary copy when Sanity fields are blank.
- Back-in-stock sends the variant GID + the requested option values (so a
  never-stocked combination is still segmentable).
- `custom_source` reflects the actual form placement.
**Status**: Not Started

## Stage 7: Should-fix — consent completeness
**Goal**: The banner's promises match what the page does.
- Expire `_ga*`/`_gid`/`_gcl_au` on withdrawal.
- stegaClean the GA/GTM ids; render only the first id per vendor (extra ids were
  silently dropped by next/script's id-keyed dedupe) and warn in dev.
- Gate GTM on analytics OR marketing; gate Vercel Analytics on a decision.
- Share the consent cookie across apex/www.
- Fix the stale "gates Klaviyo onsite tracking" editor description.
**Status**: Not Started

## Stage 8: Should-fix — routing, metadata, dead code
**Goal**: No indexable duplicates, no link-picker dead ends, no stale copies.
- Localized metadata + canonical for `/products/all` and `/products/collections`.
- Sitemap `x-default` only when the default locale actually renders.
- Fallback-locale pages canonical to the locale that owns the content.
- `pProductCategory` Presentation locations via `fieldLevelLocations`.
- Link-picker drift: `pFaq`/`pNewsletter` added to `internalLink.to[]`, `pNewsletter`
  to the GROQ literal, blog types dropped from the picker.
- Delete the stale duplicate `defineEventJsonLd`; drop the `as any` cast in
  PageEvents; fix the stale i18n comment in buildEventName.
- Shopify webhook: topic allowlist.
**Status**: Not Started
