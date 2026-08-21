# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (runs typegen first via predev hook)
npm run build        # Build for production
npm run typegen      # Extract Sanity schema and generate TypeScript types
npm run lint         # Run ESLint
```

Sanity Studio is embedded at `/sanity` and runs alongside the Next.js app on the same port.

To regenerate Sanity TypeScript types after schema changes:

```bash
npm run typegen
# This runs: sanity schema extract && sanity typegen generate
```

## Architecture

This is a **Next.js 16 (App Router) + Sanity v5** project. Content is managed in Sanity and rendered via Next.js. The stack uses React 19, Tailwind CSS v4, Radix UI, and Motion (Framer Motion successor).

### Directory Structure

- `src/app/(frontend)/` — All public-facing routes using Next.js route groups
- `src/app/sanity/` — Embedded Sanity Studio at `/sanity`
- `src/app/api/` — API routes (draft mode, revalidation, email, page views, Klaviyo signups, Shopify search/cart/webhook)
- `src/app/fonts/` — Web font files
- `src/sanity/` — All Sanity configuration and schema
- `src/sanity/schemaTypes/` — Schema split into `singletons/`, `documents/`, `objects/`, `components/`
- `src/sanity/deskStructure/` — Sanity Studio desk customization
- `src/sanity/migrations/` — Sanity `defineMigration` scripts (run via the Sanity CLI)
- `scripts/` — One-shot Node data scripts run directly against a dataset, for work `defineMigration`'s per-document callback can't do (e.g. `merge-product-i18n.mjs`, which has to read a document's translation siblings)
- `src/components/` — Shared React components
- `src/components/layout/` — Layout shell components (Header, Footer, Main, etc.)
- `src/components/ui/` — shadcn/ui-style Radix UI components
- `src/lib/` — Utilities, providers, metadata helpers
- `src/hooks/` — Custom React hooks

### Sanity Integration

**Schema naming conventions:**

- `g-*` = global singletons (header, footer, announcement, author, team-member)
- `p-*` = page singletons or document types
- `settings-*` = settings singletons (general, color, menus, integrations, redirect)

**Singleton documents** (non-duplicatable, single-instance): the `singletonDocuments` array in `sanity.config.ts` is the authoritative list — `gHeader`, `gFooter`, `gMobileMenu`, `gToolbar`, `gAnnouncement`, `gNewsletter`, `pHome`, `pContact`, `pFaq`, `pSizeGuide`, `pNewsletter`, `p404`, `pProductIndex`, `settingsGeneral`, `settingsIntegration`, `settingsConsent`, `settingsCart` (document-localized; lives under Products in the Studio). Being in it removes the "duplicate" and new-document actions. Note that `gAuthor`, `settingsBrandColors`, `settingsMenu` and `settingsRedirect` are single-instance in practice but are **not** in that array, so the Studio still offers to duplicate them. Type names don't all follow their filenames — `settings-integrations.ts` defines `settingsIntegration` (singular) and `settings-color.ts` defines `settingsBrandColors`.

**Document types** (multi-instance, slug-based):

- `pGeneral` — Generic pages at `/<slug>`
- `pBlog` / `pBlogIndex` / `pBlogCategory` — Blog system (routes currently disabled)
- `pProduct` / `pProductCategory` / `pProductCollection` — Product system (field-level i18n — see Localization below)
- `pEvent` / `pEvents` / `pEventCategory` / `pEventRole` / `pEventStatus` — Event system
- `pBrand` — Brand entries
- `gTag` — Tags referenced from product metadata lists
- `gTeamMember` — Team member profiles
- `gLocation` — Event venues (referenced by `pEvent`; carries `address` + `geo` for structured data)
- `gFaq` — Global FAQ entries (document-level i18n via `documentInternationalization`; referenced by the `faqList` module and listed on the FAQ page)
- `gSizeChart` — Global garment size charts (deliberately **not** document-localized: measurements are locale-invariant, so numbers are stored once and only the text is translated via inline internationalized arrays — the fit `note` and each measurement's `label`). Referenced by `pProduct.sizeChart` (which opens the chart in a dialog on the product page, falling back to a `/size-guide` link when the chart has no table to show) and listed on `/size-guide`. Authoring mirrors the rendered table: `sizes[]` are the columns (free text, e.g. `XS…2XL`, or a single `One Size`) and each `rows[]` entry is **one measurement**, holding a `label` plus one `values[]` cell per size. A cell is `{ size, min, max? }`, so a chart mixes fit ranges (`34–36`) with single measurements (`32`) and both ends stay numeric for the cm/in toggle. **Cells are matched to columns by `size`, never by array position** — reordering or inserting a size can't shift a row's numbers under the wrong heading, and `values[]` order is irrelevant. A `Rule.custom` on `rows` blocks publishing unless every measurement covers exactly the chart's `sizes` (no gaps, strays, or repeats), so a typo'd size is a loud error rather than a phantom column. There is no preset measurement vocabulary — adding a measurement is content work, not a code change.

**Localization:** Two locales (`en`, `zh_tw`) defined in `src/lib/i18n.ts`. Page/global docs are localized at the **document level** via the `documentInternationalization` plugin (`src/sanity/i18n-types.ts` lists translatable types; fetched per-locale via the `byLocale()` GROQ helper). Short, referenced strings (e.g. `gLocation.name`, `pEventStatus.title`, `settingsGeneral.alternateName`) use **inline `internationalizedArray`** instead, resolved with `coalesce(field[language == $locale][0].value, field[language == "en"][0].value)`.

**The event family (`pEvent`, `pEvents`, `pEventCategory`) is FIELD-level localized too**, on the same machinery as the product family below — one document per event carries every language. The reason is different, though: an event is a single *occurrence*, so its start time, venue, crew roster and status can only have one value, and two documents per event meant two copies of facts that drifted (two events ended up with different start times per language). Prose lives in `internationalizedArray`s, including `internationalizedArrayPortableText` — `pEvent.content` is the FULL `portableText` type, so `'portableText'` is registered in `fieldTypes` alongside `'portableTextSimple'` in `sanity.config.ts`. Everything locale-invariant (dates, `locationRef`, categories, `statusList`, team assignments, images) exists once. Notes specific to events:

- **Both event sitemap entries need `locales`, not `language`** — `pEvent` derives it from `title[].language`, while `pEvents` (the index) advertises every locale because it renders an English fallback anywhere, the same treatment `pProductCategory` gets.
- **`/events-crew` sits outside the `[locale]` segment**, so it has no `$locale` to resolve against. Its queries use the `crewString()` helper in `queries.ts`, which coalesces **zh_tw first, then en** — the crew is Taiwan-based and the roster is written in Chinese. `locationRef.name` already worked this way; `title`, `subtitle`, `location`, `teamNotes` and `teamAssignments[].note` joined it. The crew view also used to count every translated event twice; one document per event fixed that.
- **Unlike the product queries, the event queries carry no transition tails.** Events are migrated in the same deploy as the code (`scripts/merge-event-i18n.mjs`), so there is no window where old-shape event documents meet new-shape queries. Where an event query reuses a shared helper that still has a product tail (`locString`, `i18nSharingFields`), the tail is inert — a merged event has no `language`, so `select(defined(language) => …)` yields null and `coalesce` skips it.
- **`scripts/merge-event-i18n.mjs` groups siblings by their `translation.metadata` set, not by slug.** Two events were authored with a `-zhTW` slug on the Chinese side, so slug grouping would split them and publish two documents for one occurrence. Its Sanity client is created with `perspective: 'raw'` so that drafts are visible as `drafts.*` ids — under the client's default (`drafts`) perspective a draft is overlaid onto the published id, and the "publish or discard your drafts first" guard silently passes while the merge reads draft content instead of published.

**The product family (`pProduct`, `pProductCollection`, `pProductCategory`) is FIELD-level localized** — one document per product carries every language, mirroring Shopify's one-entity model. Prose lives in `internationalizedArray`s (including `internationalizedArrayPortableTextSimple`, registered via `fieldTypes` in `sanity.config.ts`); everything locale-invariant (Shopify handle, price, refs, images, `soldOut`) exists once, and references to products never involve a language choice. Consequences that differ from the doc-level types: a product's translated-ness is signalled by `title[].language` (drives visibility — a zh-only product is hidden from `en` listings and 404s on the `en` route — plus hreflang via `availableLocales` and the sitemap `locales` projection); slugs are validated with `isUniqueAcrossType` because the default check silently passes when there is no `language` field; the Studio shows one language at a time via the plugin's built-in `languageFilter` (the "Showing 1/2" control is `@sanity/language-filter`, registered automatically because `sanity.config.ts` passes `languageFilter.documentTypes`, derived from `FIELD_LEVEL_I18N_TYPES`; the selection persists per browser in `localStorage`). That config also sets **`buttonAddAll: false`** — with the filter narrowed, the plugin's "Add missing languages" button appears and does nothing, because it decides visibility from the unfiltered item count but only ever adds *visible* languages. The per-language `en`/`zh_tw` chips beside it do the same job correctly. Product queries in `queries.ts` still carry transition tails (`select(defined(language) => …)`) so a build against un-merged data renders — see `scripts/merge-product-i18n.mjs`; strip them once the prod dataset is migrated.

**GROQ queries** are centralized in `src/sanity/lib/queries.ts` using `defineQuery()` from `next-sanity`. Composed from reusable fragments: `baseFields`, `linkFields`, `menuFields`, `imageMetaFields`, `imageBlockMetaFields`, `callToActionFields`, `portableTextContentFields`, `freeformField`, `faqListField`, `gFaqItemFields`, `gSizeChartFields`, `pageModuleFields`, `formField`.

**Data fetching** uses `sanityFetch` from `src/sanity/lib/live.ts` (wraps `defineLive` from `next-sanity`). This enables live content updates. Usage pattern in pages:

```ts
const { data } = await sanityFetch({ query: someQuery, tags: ['docType'] });
```

**Visual Editing / Draft Mode** is enabled via Sanity Presentation Tool. When draft mode is active, `<VisualEditing />` and `<DraftModeToast />` are rendered. The presentation resolver at `src/sanity/lib/presentation-resolver.ts` maps routes to Sanity document types.

### Page Architecture

Each page route follows this pattern:

1. Server component in `src/app/(frontend)/[route]/page.tsx` — fetches data via `sanityFetch`
2. `generateMetadata()` — fetches data with `stega: false` for clean metadata
3. `generateStaticParams()` — for dynamic slug routes, fetches all slugs at build time
4. Render delegates to a `_components/Page*.tsx` client or server component

**Active frontend routes:**

- `/` — Home (`pHome`)
- `/[slug]` — Generic pages (`pGeneral`)
- `/contact` — Contact page
- `/faq` — FAQ page (`pFaq`; renders the full set of locale-matched `gFaq` entries)
- `/size-guide` — Size guide (`pSizeGuide`; a sticky table-of-contents beside sections, each section rendering one tab per referenced chart. Section order drives the page; the Studio list sorts by title)
- `/newsletter` — Newsletter signup page (`pNewsletter`)
- `/products` — Product index (`pProductIndex`); `/products/all` (paginated), `/products/[slug]`, `/products/categories`, `/products/categories/[slug]`, `/products/collections`, `/products/collections/[slug]`
- `/events` — Events listing; `/events/[slug]` — single event
- `/events-crew` — Event crew tracking (month-based with member filter)
- `/email-signature` — Standalone email signature utility

Everything above lives under `/[locale]/(site)/` except `/events-crew` and `/email-signature`, which sit outside the locale segment. `[...rest]` is a catch-all inside `(site)` that renders the localized 404 inline — `notFound()` can't render a styled boundary here.

**Site-wide data** (`siteDataQuery`) fetches header, footer, announcement, sharing settings, and integrations in the root layout and passes to `<Layout>`.

**Entrance animations are CSS, not JS.** Page content fades in via the `reveal` utility in `globals.css` — add the class and, optionally, `--reveal-delay` / `--reveal-duration` / `--reveal-ease` through the `style` prop (`REVEAL_SOFT` and `revealStagger(index)` in `src/lib/animate.ts` carry the shared presets). Do **not** reach for a Motion mount animation or a keyframe animation for this: both make invisible the default and need something to execute to undo it, so a page the browser never paints — or one whose JS never hydrates — strands the price and buy button at `opacity: 0`. `reveal` instead leaves the element's own opacity alone and puts the hidden value in `@starting-style`, so it is only ever a transition start point. Read the comment on the utility before adding a delay: the delay window is the one span where content is still hidden, so keep it off anything a shopper must see or click. `.animate-page-in` (the per-navigation fade on `<main>`) works the same way for the same reason.

### Routing

`src/lib/routes.ts` is the single source of truth for document type → URL resolution. `DOCUMENT_ROUTES` drives both `resolveHref()` (JS helper) and `buildDocumentHrefGroq()` (GROQ query builder).

**Adding a routable page type touches four hand-maintained lists** — `DOCUMENT_ROUTES` and the `resolvedHrefGroq` literal (both in `routes.ts`; the literal cannot call `buildDocumentHrefGroq()` because Sanity's static query extractor can't evaluate function calls inside template literals), plus `internalLink.to[]` in `schemaTypes/objects/link.ts` and `pageDocumentOrder` in `schemaTypes/components/LinkObject.tsx`. Miss either of the last two and the page never appears in the Studio link picker, so editors cannot add it to a menu or CTA and the `resolvedHrefGroq` case is dead. Also add the type to `SITEMAP_PAGES_QUERY` and `presentation-resolver.ts`.

### PageModules System

`src/components/PageModules.tsx` is a switch-based renderer that maps Sanity `_type` values to React components. Renders `freeform` → `<Freeform>` and `faqList` → `<FaqList>`. When adding new page module types, add the GROQ field selector to `pageModuleFields` in `queries.ts` and a case in `PageModules.tsx`. The `faqList` module is available on `pHome.pageModules` and `pGeneral.pageModules`.

### SEO & Structured Data

- **Metadata** is built by `src/lib/defineMetadata.ts` from each doc's `sharing` fields (hreflang `alternates`, OG/Twitter, canonical, `googleBot` snippet directives). Site-level metadata (title template, favicons, OG defaults) lives in the root layout.
- **JSON-LD** is injected via `<JsonLd>`. Builders in `src/lib/`: `defineSiteJsonLd` (Organization+SportsClub & WebSite, site-wide in root layout), `defineEventJsonLd` (Event, on event detail), `defineFaqJsonLd` (FAQPage, on home/general/FAQ pages — use `collectFaqItems()` to pull items from `faqList` modules), `defineBreadcrumbJsonLd` (BreadcrumbList). The events index emits an inline `ItemList`. JSON-LD must be built from `stegaClean`-ed data so draft mode doesn't leak stega characters.
- **Sitemap** (`src/app/sitemap.ts`) and **robots** (`src/app/robots.ts`, which explicitly allows AI/answer-engine crawlers) are dynamic; `SITE_URL` must be set for absolute URLs.
- **FAQ system**: author entries once in `gFaq` (Global → FAQ), surface a subset via the `faqList` module's reference array (resolved by `gFaqItemFields`), or show all on `/faq`.

### Key Shared Components

- `<SanityImage>` (`src/components/SanityImage.tsx`) — Renders a single Sanity image with LQIP placeholder and metadata-driven sizing.
- `<ImageBlock>` (`src/components/ImageBlock.tsx`) — Block-level image with responsive mobile/desktop images, custom aspect ratios, and captions. Uses `<SanityImage>` internally.
- `<CustomPortableText>` — Renders Sanity Portable Text with custom components for headings, links, CTAs, images, and iframes.
- `<CustomLink>` — Handles internal/external links from Sanity `link` objects.
- `<CustomForm>` — Renders form fields from Sanity `formField` schema via controlled inputs.
- `<JsonLd>` — Injects JSON-LD schema.org markup (site/Organization, Event, FAQPage, BreadcrumbList, ItemList).
- `<FaqList>` — Renders an FAQ section (question headings + Portable Text answers) from resolved `gFaq` entries; used by the `faqList` module and the FAQ page.
- `<SizeChartTable>` — Renders one `gSizeChart` as a table (built on `ui/Table`): sizes across the header row, one body row per measurement. Exports `isRenderable()` so callers gate empty states on the same condition it bails on (it `stegaClean`s each size — draft mode encodes metadata into `sizes[n]`, so a raw truthiness test calls an empty chart renderable). Uses `border-separate` and a column-count-derived `minWidth` so the label column can pin while values scroll, and marks the scroll container as a focusable `role="region"` so keyboard users can reach clipped columns — see the notes in the file before changing any of these.
- `<BlogCard>` — Card component for blog post listings.
- `<Caption>` — Shared caption for image/media blocks.
- `<LocationCurrentTime>` — Displays location name with live local time.
- `<WordmarkSvg>` — SVG logo component.
- `<SvgIcons>` — SVG icon set.
- `<TextReveal>` / `<Typewriter>` — Motion-based text animation components.
- `<Menu>` / `<MenuDropdown>` / `<MobileMenu>` — Navigation components.
- `<DraftModeToast>` — Draft mode indicator banner.
- `<ProductCard>` — Listing card for a product (`products/_components/ProductCard.tsx`); Shopify-unaware, its `price` is rewritten upstream by `applyCardPrices`.
- `src/components/cart/` — `CartProvider` (state + actions contexts), `CartButton`, `CartCountBadge`, `CartDrawer` (thin `next/dynamic` wrapper) and `CartDrawerPanel` (the panel itself).
- `src/components/layout/` — Shell: `AdaSkip`, `Footer`, `Header`, `HeadTrackingCode`, `Main`, `ToolBar`.
- `src/components/ui/` — Radix UI-based: Accordion, Badge, Button, Carousel (embla, not Radix — the product gallery is its only consumer), Checkbox, Dialog, DropdownMenu, Field, Input, InputGroup, Label, Pagination, Progress, RadioGroup, Select, Separator, Sheet, Spinner, Table, Tabs, Textarea, Tooltip.
- `src/components/PortableTable/` — Table rendering for Portable Text.

### Utilities (`src/lib/`)

- `utils.ts` — `cn()` (Tailwind merge), format helpers (`formatDateUsStandard`, `formatUrl`, `formatHandleize`, etc.), validate helpers (`validateEmail`, `validateUsPhone`), outbound-link helpers (`REFERRAL_SOURCE`, `appendReferralParams()` — UTM params on `purchaseLink`), array helpers (`arrayIntersection`, `arrayUniqueValues`, `arraySortObjVal*`), DOM helpers (`scrollDisable`, `scrollEnable`, `debounce`, `sleeper`).
- `image-utils.ts` — `buildImageSrc()`, `buildImageSrcSet()`, `buildRgbaCssString()`.
- `routes.ts` — `DOCUMENT_ROUTES`, `resolveHref()`, `buildDocumentHrefGroq()`, `checkIfLinkIsActive()`.
- `size-measurements.ts` — size-chart units and number formatting: `SIZE_UNITS` (also the order the cm/in control renders in), `SIZE_UNIT_OPTIONS`, `resolveUnit()`, `formatMeasurement()`, `formatRange()` (renders `min–max`, or just `min` when `max` is unset).
- `animate.ts` — Motion animation presets (`fadeAnim`, `mobileMenu*`, `cartPanel`, `cartOverlay`) plus the tuning props for the CSS `reveal` utility: `REVEAL_SOFT` and `revealStagger(index)`.
- `defineEventJsonLd.ts` — schema.org `Event` JSON-LD builder (multi-location subEvents; emits endDate, PostalAddress + GeoCoordinates from `locationRef`, keywords, offers).
- `defineSiteJsonLd.ts` — schema.org `Organization` + `SportsClub` and `WebSite` JSON-LD builder (areaServed, knowsLanguage, alternateName, address).
- `defineFaqJsonLd.ts` — `FAQPage` JSON-LD builder; `collectFaqItems()` flattens `faqList` modules into items.
- `defineBreadcrumbJsonLd.ts` — `BreadcrumbList` JSON-LD builder (1-based positions, absolute URLs).
- `defineMetadata.ts` — Next.js metadata builder from Sanity SEO fields. Also exports `omitPageMetadata()` / `WithoutPageMetadata<T>`: listing pages spread their whole query result into a client component, so they strip `sharing` and `availableLocales` (read only by `generateMetadata`) at that boundary rather than serializing them into the RSC payload for nothing. The return type drops the keys too, so a component that later reaches for `data.sharing` fails to compile instead of getting `undefined` at runtime.
- `icons.ts` — Maps social platform names to icon identifiers (facebook, instagram, linkedin, spotify, strava, x, youtube, github).
- `providers/` — `ReactQueryProvider` (TanStack React Query wrapper).
- `gtag/` — Google Analytics helpers.

### Hooks (`src/hooks/`)

- `useKey.js` — Keyboard event listener.
- `useOutsideClick.js` — Click outside detection.
- `useScrollLock.ts` — Locks document scroll while an overlay is open, and keeps that lock honest across the page lifecycle (`pagehide` releases it, `pageshow` lets the owner close itself on a bfcache restore). Used by `CartDrawer` and `MobileMenu`; the lock is global, so new overlays must go through this rather than calling `scrollDisable`/`scrollEnable` directly.
- `useScrollSpy.ts` — IntersectionObserver scroll-spy for in-page section navs + horizontal-strip auto-scroll; also exports `readRootPxVar()`. Used by `EventStationsNav` and `SizeGuideNav`.
- `useWindowDimensions.js` — Window size tracking.
- `useWindowScroll.js` — Scroll position tracking.

### API Routes (`src/app/api/`)

- `/contact-form/submit` — Contact form submission (email dispatch).
- `/draft-mode/enable` — Enables Sanity draft mode.
- `/revalidate-tag` — On-demand ISR via tag invalidation.
- `/view-page` — Page view tracking.
- `/newsletter/subscribe` — Klaviyo newsletter signup.
- `/products/back-in-stock` — Klaviyo back-in-stock signup for a sold-out product/variant.
- `/product-submission/submit` — Product submission form (email dispatch), behind the `/products/*` FAB.
- `/shopify/revalidate` — Shopify webhook receiver (HMAC-verified) that revalidates Storefront fetch tags.
- `/shopify/search` — Storefront-API product search proxy for the Studio's Shopify picker.
- `/shopify/cart` — on-site cart: read, add, update quantity, remove. Cart id in an httpOnly cookie.

### Shopify Integration (`src/lib/shopify/`)

Products are **hybrid**: Sanity owns everything editorial (slug/routes, title, content, taxonomy, size charts, SEO, i18n) and Shopify owns commerce (price, compare-at, availability, variants, cart, checkout). **Imagery is the one split field.** Sanity's `mainImage` is the editorial hero — it is what listing cards, OG tags and the streaming placeholder use, and it is the only image an unlinked product has — but on the detail page a linked product's gallery comes from Shopify, which is where the full set of product photographs lives. Shopify images *replace* the hero there rather than appending to it, so the gallery has one source and never shows the same shot twice; `mainImage` remains the fallback whenever the handle is unlinked, unknown, or Shopify is unreachable. The coupling is `pProduct.shopify.handle`, picked in the Studio via `ShopifyProductInput` (search UI backed by `/api/shopify/search`; degrades to a plain string field when no Storefront token is set) — read in the other direction too, by the cart route resolving handle → slug (see Cart & checkout). Setup walkthrough: `docs/SHOPIFY-SETUP.md`.

The handle lives **once, on the single product document** — localized price/currency come from Markets `@inContext`, never from a second Shopify product. (Products used to be document-localized with the handle inherited across sibling documents; that inheritance and its failure modes — a `zh_tw` page silently dropping to the currencyless manual `price`, or carrying a *different* product's handle — died with the merge to field-level i18n. `shopifyHandleField` in `queries.ts` still carries the sibling coalesce as a transition tail only.)

- `types.ts` — client-safe types + pure helpers (`formatShopifyPrice`, variant selection, `LOCALE_SHOPIFY_CONTEXT` mapping locales to Markets `@inContext` — `zh_tw` → TW market, `en` → store default). Client components import **only** from here.
- `client.ts` — server-only Storefront GraphQL transport. Env is read at call time, so the whole integration is optional: without `SHOPIFY_STORE_DOMAIN` plus a Storefront token, everything renders from the manual Sanity fields. Prefers `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` (shop-level rate limit, correct for server-side calls) over the public `SHOPIFY_STOREFRONT_API_TOKEN` (throttled per buyer IP).
- `product.ts` — soft-failing server fetchers (`server-only` via its `getDictionary` import). `getProductCommerce(handle, locale)` powers the detail page and is `cache()`d because **two** Suspense boundaries read it — the buy column and the image gallery. That is not about saving a round trip (Next's Data Cache locks per key, so one request goes out regardless); it stops the second boundary blocking on that lock and re-parsing the payload, since request memoization is GET/HEAD-only and this is a POST. The corollary is that both boundaries must be passed the **identical** `handle` value: `cache()` keys on argument identity and runs before the internal `stegaClean`, so cleaning it at one call site splits the entry. `getCardCommerce`/`applyCardPrices`/`withLiveCardPrices` batch-fetch listing-card prices (aliased `product(handle:)` lookups — the Storefront API has no by-handles query) and return copies of the cards with only `price` rewritten, so `ProductCard` stays Shopify-unaware. The card query deliberately does **not** request images, so a listing grid's LCP never waits on Shopify. Handles are `stegaClean`ed at the boundary; a Shopify outage or unknown handle logs and falls back to manual fields, never 500s.
- `cart.ts` — Storefront cart operations (`getCart`, `createCart`, `addCartLines`, `updateCartLine`, `removeCartLine`). Unlike `product.ts` these **do not** soft-fail: a cart is the shopper's own state, so errors propagate to the route rather than showing a stale cart. Two rules that differ from the rest of the integration and must not be "made consistent": every cart request passes `cache: 'no-store'` with no tags (a cached cart would leak between shoppers), and cart calls carry **no `@inContext`** — the market is pinned once via `buyerIdentity.countryCode` at `cartCreate`, because reading a cart back under a different country than it was created with is a mismatch error the moment someone switches language.

### Cart & checkout

The site is the store: browsing, variants and the cart all live here, and the shopper only leaves at Shopify's hosted checkout (there is no self-hosted checkout on Shopify). The old outbound deep link to the Online Store is gone — it was also broken, since products aren't published to that channel and the store is password-gated.

- `/api/shopify/cart` — `GET` reads the cart, `POST` takes a zod discriminated union on `action` (`add` | `update` | `remove`). The cart id lives in the httpOnly `blackwater_cart` cookie (14 days): it is a capability, so page scripts must never see it. A cookie pointing at a cart Shopify has already expired (~10 days idle) is a normal path, not an error — `add` transparently creates a new cart, `update`/`remove` 409. Every response also passes through `withProductSlugs`, the one place this route touches Sanity: cart lines carry only Shopify's handle, so the Sanity slug each thumbnail links to is resolved per response (`productSlugsByShopifyHandleQuery`, cached under the `pProduct` tag) rather than stored on the line, where an editor's slug rename would leave it pointing at a 404. That read is decoration and is fenced as such — it carries `AbortSignal.timeout`, and any failure returns the cart unenriched, because it sits in front of the `Set-Cookie` that persists a newly created cart. It applies `productTitleVisible`, so a product untranslated in the requested locale resolves to no slug instead of a link into a 404 — which is why `GET` takes a `?locale=`. The enriched shape is `ShopifyCartResponse`, deliberately distinct from the `ShopifyCart` that `cart.ts` returns.
- `CartProvider` is mounted in `components/layout/index.tsx`, **not** in `[locale]/layout.tsx`: four routes (`/email-signature`, `/events-crew`, the not-found boundary) render the same chrome from outside the `[locale]` segment, and `CartButton` inside that chrome throws `useCart must be used within CartProvider` if the provider sits deeper. It holds the last server snapshot and replaces it wholesale on every mutation — no local quantity reconciliation, so totals always match what Shopify will charge. It hydrates in a mount effect rather than on the server, which keeps prerendered product pages static.
- `CartDrawer` follows `MobileMenu`'s raw Radix `Dialog` + Motion idiom (`z-popover`, `scrollDisable`/`scrollEnable`), **not** `ui/Sheet.tsx`, which is unused and animates differently. Its width is an explicit `max-w-[26rem]` because `globals.css` remaps Tailwind's container scale (`sm` is 600px here). Checkout is an `<a>`, never a form — the site's `form-action 'self'` CSP would block a cross-origin submit.
- Cart line thumbnails come from `cdn.shopify.com`, which is allowlisted in both `images.remotePatterns` and the CSP `img-src` in `next.config.mjs`.
- **Stock ceilings are learned, not read.** `quantityAvailable` needs the `unauthenticated_read_product_inventory` scope, which this token lacks, so nothing knows a variant's stock up front. Instead every cart mutation selects `warnings { code target }`: a `MERCHANDISE_NOT_ENOUGH_STOCK` warning names the capped cart line, `cart.ts` flags it as `atStockLimit`, and `CartProvider` remembers the ceiling for the session so the stepper's `+` disables at it. Enabling that scope would let the limit be shown before the first click; the learned ceiling stays as the fallback either way.
- **The cart trigger is global**: `CartButton` renders on every page that uses the site chrome, empty or not, so nobody gets stranded mid-purchase. It was once scoped to `/products/*` via an `isCommercePath()` predicate; that predicate is gone, not merely unused.
- **`settingsCart`** (Studio → Products → Cart, *not* under Settings) holds the empty-cart heading and an ordered `pProduct` reference list. It is **document-localized** (listed in `i18n-types.ts`) — kept per-language deliberately so each market can be merchandised differently. Products themselves are language-agnostic documents, so the picker is unfiltered and both Cart documents pick from the same product list; the query needs no locale re-resolution — `byLocale('settingsCart')` and a plain dereference are enough. An untranslated locale falls back to the English document, the same fallback `gHeader`/`gFooter` have. `getCachedSiteData` stays Sanity-only on purpose — see the note in that file.
- The cart panel is light in both themes, so the drawer carries **`.cart-surface`** (globals.css), which pins the tokens its contents use — including `--accent-foreground`, which the empty-state `ProductCard`s use for hover text and focus rings — to the same values `:root` declares. Without it the drawer is unreadable on a dark route; without `--accent-foreground` specifically, card hover and focus rings go invisible.
- The empty-state recommendation cards render **without a price**. A live one would mean a Shopify lookup inside `getCachedSiteData`, i.e. on every page of the site, and the manual `price` these cards carry is only a fallback that can be stale for a linked product.

Only the Storefront API is used — there is no Admin API dependency. The Studio picker runs on the same public Storefront token as the frontend, so it lists exactly the products published to that token's sales channel, i.e. the ones a product page can actually render commerce for. (Shopify removed admin-created custom apps on 2026-01-01; a `shpat_` Admin token is no longer obtainable and no longer needed.)

Caching: every **catalog** Storefront fetch is tagged `shopify` + `shopify:product:<handle>` with **no** backstop TTL (deliberate — see the comment on `REVALIDATE` in `product.ts`), so `/api/shopify/revalidate` (register webhooks per its header comment) is the only thing that gets admin edits onto the site without a redeploy. Cart fetches are exempt: they are uncached and untagged (see `cart.ts` above). On the detail page the buy button follows one precedence: manual `soldOut` → the on-site cart → `purchaseLink` → nothing. `soldOut` remains an editorial override on top of live availability. `purchaseLink` (an outbound link with UTM params, for products we don't sell through our own cart) is **demoted once a handle is linked** — linking moves the sale on-site, so a leftover link must not send shoppers back out — but it is not ignored outright: `commerce` is also `null` when Shopify is unreachable, and there the outbound link is the only buy path left. Linkage is now answerable from the document alone — one product, one handle — so `linkedToShopify()` in `p-product.ts` is a plain synchronous check with no network call (the old async sibling lookup and its 5-second cache died with the i18n merge). `price` and `purchaseLink` still carry a `Rule.custom(...).warning()` rather than a conditional `hidden`/`readOnly`, so both stay editable and a stale link can be cleared. The variant picker (`VariantPicker.tsx`) keeps unavailable values selectable so the per-variant back-in-stock state stays reachable.

**The image gallery** is a third streamed slot beside the buy column and related grid, wired as `gallerySlot` in `[slug]/page.tsx`. `ProductGalleryColumn` awaits the shared `getProductCommerce` and renders `ProductGallery` (embla, via `ui/Carousel.tsx` — its first consumer) when Shopify returned images, or `ProductMainImage` when it didn't. Three things there are load-bearing:

- **The `aspect-4/3` frame stays in `PageProductSingle`** and each `CarouselItem` re-declares that same ratio. The ratio on the slide is what gives the carousel its height — `CarouselContent` hardcodes `overflow-hidden` on the embla viewport and forwards `className` only to the inner track, so the viewport has no height of its own and `h-full` on a slide would collapse against it. Keep the two ratios in step; if they drift, the slide letterboxes inside an `overflow-hidden` box rather than shifting layout.
- **The Suspense fallback is `ProductMainImage` *without* `priority`.** Static generation emits fallback markup and resolved content into the same HTML, and a hoisted high-priority image preload survives React's swap — so `priority` on the fallback would fetch the Sanity hero at high priority on every page load only to discard it, competing with the Shopify image that actually paints. `priority` belongs on the first Shopify slide and on the direct non-`awaitsCommerce` render, and nowhere else. Verify by checking there is exactly one `rel="preload" as="image"` and that it points at `cdn.shopify.com`.
- **Slides use plain `object-contain`, never the `img-object-contain` utility.** next/image `fill` already emits the absolute positioning; the utility's `translate3d` centering and `width: calc(100% + 4px) !important` bleed hack would fight it, and tailwind-merge does not dedupe the two.

Note for local verification: the in-app preview browser has `requestAnimationFrame`, `IntersectionObserver` and `ResizeObserver` all inert, so embla cannot animate, cannot lazy-load off-screen slides, and cannot re-measure after a resize — and view transitions never complete, which leaves two copies of the page in the DOM at 0×0. Assert on `api.scrollTo(i, true)` (the `jump` argument bypasses the rAF loop) plus server HTML, not on animated scrolling.

### Sanity Studio Structure

The Studio sidebar is structured via `src/sanity/structure.ts` and `src/sanity/deskStructure/`. The Studio is accessible at `/sanity` and includes the Presentation Tool for visual editing, Media plugin for asset management, and Vision for GROQ queries.

### Environment Variables

Required in `.env`:

```
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
SITE_URL
SANITY_API_READ_TOKEN       # Read access; used by live.ts and the Studio client
SANITY_REVALIDATE_SECRET
EMAIL_DISPLAY_NAME
EMAIL_SERVER_USER
EMAIL_SERVER_PASSWORD
EMAIL_SERVER_HOST
EMAIL_SERVER_PORT
KLAVIYO_PRIVATE_API_KEY     # Newsletter + product back-in-stock subscribe routes
```

Optional (Shopify integration — full walkthrough in `docs/SHOPIFY-SETUP.md`):

```
SHOPIFY_STORE_DOMAIN        # your-store.myshopify.com
SHOPIFY_STOREFRONT_PRIVATE_TOKEN # private token from the Headless channel (preferred)
SHOPIFY_STOREFRONT_API_TOKEN # public token; fallback, throttled per buyer IP
SHOPIFY_WEBHOOK_SECRET      # webhook signing secret for /api/shopify/revalidate
SHOPIFY_API_VERSION         # optional pin override (defaults in code)
```

Only for the one-shot scripts under `scripts/` (never read by the app):

```
SANITY_READ_WRITE_TOKEN     # write access; SANITY_API_READ_TOKEN cannot mutate
```

`SHOPIFY_ADMIN_API_TOKEN` is retired and read nowhere — a 38-char `shpss_` value is an app *client secret*, not an access token, and belongs in neither.

### Type Generation

After modifying any Sanity schema file, run `npm run typegen` to update `src/sanity/extract.json` and regenerate `sanity.types.ts`. The `predev` hook runs this automatically.

### Troubleshooting

- `Error: Failed to communicate with the Sanity API` → Run `sanity logout && sanity login`
- If `SANITY_API_READ_TOKEN` is missing at runtime, `src/sanity/lib/live.ts` will throw immediately on startup
