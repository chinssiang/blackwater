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
- **Admin API** (private token, server-only): only for the Studio product-search picker
  (Stage 4) and optional webhook registration script. Never called from page renders.
- Pin `SHOPIFY_API_VERSION` (quarterly releases); upgrade deliberately.

### Environment variables (add to `.env` + Vercel)

```
SHOPIFY_STORE_DOMAIN=<store>.myshopify.com
SHOPIFY_STOREFRONT_API_TOKEN=   # Storefront API access token (custom app)
SHOPIFY_API_VERSION=2026-01     # pinned
SHOPIFY_WEBHOOK_SECRET=         # Stage 3
SHOPIFY_ADMIN_API_TOKEN=        # Stage 4 only (product search in Studio)
```

Setup prerequisite: create a **custom app** in Shopify admin (Settings → Apps →
Develop apps), enable Storefront API scopes (`unauthenticated_read_product_listings`,
inventory/price scopes), copy tokens.

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

## Stage 5 (later / optional — explicitly out of scope now)

- On-site cart & checkout (Storefront API cart mutations) if we outgrow link-out.
- Multi-currency / zh-TW pricing via Shopify Markets (`@inContext` directive).
- Klaviyo's native Shopify back-in-stock trigger replacing the custom list flow.
- Sanity Connect sync if listing pages should be driven by the Shopify catalog.
- Migration script deleting manual `price`/`soldOut` once all products are linked.

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
