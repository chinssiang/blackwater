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
- `src/app/api/` — API routes (draft mode, revalidation, email, page views)
- `src/app/fonts/` — Web font files
- `src/sanity/` — All Sanity configuration and schema
- `src/sanity/schemaTypes/` — Schema split into `singletons/`, `documents/`, `objects/`, `components/`
- `src/sanity/deskStructure/` — Sanity Studio desk customization
- `src/sanity/migrations/` — Schema migration scripts
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

**Singleton documents** (non-duplicatable, single-instance): `gHeader`, `gFooter`, `gAnnouncement`, `gAuthor`, `pHome`, `pContact`, `pFaq`, `pSizeGuide`, `p404`, `pCuratedIndex`, `settingsGeneral`, `settingsColor`, `settingsMenu`, `settingsIntegrations`, `settingsRedirect`. Configured in `sanity.config.ts` to remove "duplicate" and new-document actions.

**Document types** (multi-instance, slug-based):

- `pGeneral` — Generic pages at `/<slug>`
- `pBlog` / `pBlogIndex` / `pBlogCategory` — Blog system (routes currently disabled)
- `pCurated` / `pCuratedCategory` / `pCuratedCollection` — Curated/product system
- `pEvent` / `pEvents` / `pEventCategory` / `pEventRole` / `pEventStatus` — Event system
- `pBrand` — Brand entries
- `gTeamMember` — Team member profiles
- `gLocation` — Event venues (referenced by `pEvent`; carries `address` + `geo` for structured data)
- `gFaq` — Global FAQ entries (document-level i18n via `documentInternationalization`; referenced by the `faqList` module and listed on the FAQ page)
- `gSizeChart` — Global garment size charts (deliberately **not** document-localized: measurements are locale-invariant, so numbers are stored once and only the text is translated via inline internationalized arrays — the fit `note` and each measurement's `label`). Referenced by `pProduct.sizeChart` (which opens the chart in a dialog on the product page, falling back to a `/size-guide` link when the chart has no table to show) and listed on `/size-guide`. Authoring mirrors the rendered table: `sizes[]` are the columns (free text, e.g. `XS…2XL`, or a single `One Size`) and each `rows[]` entry is **one measurement**, holding a `label` plus one `values[]` cell per size. A cell is `{ size, min, max? }`, so a chart mixes fit ranges (`34–36`) with single measurements (`32`) and both ends stay numeric for the cm/in toggle. **Cells are matched to columns by `size`, never by array position** — reordering or inserting a size can't shift a row's numbers under the wrong heading, and `values[]` order is irrelevant. A `Rule.custom` on `rows` blocks publishing unless every measurement covers exactly the chart's `sizes` (no gaps, strays, or repeats), so a typo'd size is a loud error rather than a phantom column. There is no preset measurement vocabulary — adding a measurement is content work, not a code change.

**Localization:** Two locales (`en`, `zh_tw`) defined in `src/lib/i18n.ts`. Page/global docs are localized at the **document level** via the `documentInternationalization` plugin (`src/sanity/i18n-types.ts` lists translatable types; fetched per-locale via the `byLocale()` GROQ helper). Short, referenced strings (e.g. `gLocation.name`, `pEventStatus.title`, `settingsGeneral.alternateName`) use **inline `internationalizedArray`** instead, resolved with `coalesce(field[language == $locale][0].value, field[language == "en"][0].value)`.

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
- `/curated` — Curated index; `/curated/products/[slug]`, `/curated/categories/[slug]`, `/curated/collections/[slug]`
- `/events` — Events listing; `/events/[slug]` — single event
- `/events-crew` — Event crew tracking (month-based with member filter)
- `/email-signature` — Standalone email signature utility

**Site-wide data** (`siteDataQuery`) fetches header, footer, announcement, sharing settings, and integrations in the root layout and passes to `<Layout>`.

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
- `src/components/layout/` — Shell: `AdaSkip`, `Footer`, `Header`, `HeadTrackingCode`, `Main`, `ToolBar`.
- `src/components/ui/` — Radix UI-based: Accordion, Badge, Button, Checkbox, Dialog, DropdownMenu, Field, Input, InputGroup, Label, Pagination, Progress, RadioGroup, Select, Separator, Sheet, Spinner, Table, Tabs, Textarea, Tooltip.
- `src/components/PortableTable/` — Table rendering for Portable Text.

### Utilities (`src/lib/`)

- `utils.ts` — `cn()` (Tailwind merge), format helpers (`formatDateUsStandard`, `formatUrl`, `formatHandleize`, etc.), validate helpers (`validateEmail`, `validateUsPhone`), array helpers (`arrayIntersection`, `arrayUniqueValues`, `arraySortObjVal*`), DOM helpers (`scrollDisable`, `scrollEnable`, `debounce`, `sleeper`).
- `image-utils.ts` — `buildImageSrc()`, `buildImageSrcSet()`, `buildRgbaCssString()`.
- `routes.ts` — `DOCUMENT_ROUTES`, `resolveHref()`, `buildDocumentHrefGroq()`, `checkIfLinkIsActive()`.
- `size-measurements.ts` — size-chart units and number formatting: `SIZE_UNITS` (also the order the cm/in control renders in), `SIZE_UNIT_OPTIONS`, `resolveUnit()`, `formatMeasurement()`, `formatRange()` (renders `min–max`, or just `min` when `max` is unset).
- `animate.ts` — Motion animation presets: `pageTransitionFade`, `fadeAnim`.
- `defineEventJsonLd.ts` — schema.org `Event` JSON-LD builder (multi-location subEvents; emits endDate, PostalAddress + GeoCoordinates from `locationRef`, keywords, offers).
- `defineSiteJsonLd.ts` — schema.org `Organization` + `SportsClub` and `WebSite` JSON-LD builder (areaServed, knowsLanguage, alternateName, address).
- `defineFaqJsonLd.ts` — `FAQPage` JSON-LD builder; `collectFaqItems()` flattens `faqList` modules into items.
- `defineBreadcrumbJsonLd.ts` — `BreadcrumbList` JSON-LD builder (1-based positions, absolute URLs).
- `defineMetadata.ts` — Next.js metadata builder from Sanity SEO fields.
- `icons.ts` — Maps social platform names to icon identifiers (facebook, instagram, linkedin, spotify, strava, x, youtube, github).
- `providers/` — `ReactQueryProvider` (TanStack React Query wrapper).
- `gtag/` — Google Analytics helpers.

### Hooks (`src/hooks/`)

- `useKey.js` — Keyboard event listener.
- `useOutsideClick.js` — Click outside detection.
- `useReveal.ts` — Entrance-reveal props for Motion components, honoring `prefers-reduced-motion`.
- `useScrollSpy.ts` — IntersectionObserver scroll-spy for in-page section navs + horizontal-strip auto-scroll; also exports `readRootPxVar()`. Used by `EventStationsNav` and `SizeGuideNav`.
- `useWindowDimensions.js` — Window size tracking.
- `useWindowScroll.js` — Scroll position tracking.

### API Routes (`src/app/api/`)

- `/contact-form/submit` — Contact form submission (email dispatch).
- `/draft-mode/enable` — Enables Sanity draft mode.
- `/revalidate-tag` — On-demand ISR via tag invalidation.
- `/view-page` — Page view tracking.
- `/shopify/revalidate` — Shopify webhook receiver (HMAC-verified) that revalidates Storefront fetch tags.
- `/shopify/search` — Admin-API product search proxy for the Studio's Shopify picker.

### Shopify Integration (`src/lib/shopify/`)

Products are **hybrid**: Sanity owns everything editorial (slug/routes, title, images, content, taxonomy, size charts, SEO, i18n) and Shopify owns commerce (price, compare-at, availability, variants, purchase URL). The only coupling is `pProduct.shopify.handle`, picked in the Studio via `ShopifyProductInput` (search UI backed by `/api/shopify/search`; degrades to a plain string field when `SHOPIFY_ADMIN_API_TOKEN` is unset). Handles must be set per language version of a product.

- `types.ts` — client-safe types + pure helpers (`formatShopifyPrice`, variant selection/URL logic, `LOCALE_SHOPIFY_CONTEXT` mapping locales to Markets `@inContext` — `zh_tw` → TW market, `en` → store default). Client components import **only** from here.
- `client.ts` — server-only Storefront GraphQL transport. Env is read at call time, so the whole integration is optional: without `SHOPIFY_STORE_DOMAIN`/`SHOPIFY_STOREFRONT_API_TOKEN`, everything renders from the manual Sanity fields.
- `product.ts` — soft-failing server fetchers (`server-only` via its `getDictionary` import). `getProductCommerce(handle, locale)` powers the detail page; `getCardCommerce`/`applyCardPrices`/`withLiveCardPrices` batch-fetch listing-card prices (aliased `product(handle:)` lookups — the Storefront API has no by-handles query) and rewrite each card's `price` string in place so `ProductCard` stays Shopify-unaware. Handles are `stegaClean`ed at the boundary; a Shopify outage or unknown handle logs and falls back to manual fields, never 500s.

Caching: every Storefront fetch is tagged `shopify` + `shopify:product:<handle>` with a 1-hour backstop TTL; `/api/shopify/revalidate` (register webhooks per its header comment) makes admin edits land in seconds. On the detail page, manual `soldOut` remains an editorial override on top of live availability, and `purchaseLink` overrides the Shopify buy URL (which otherwise carries `?variant=` from the picker). The variant picker (`VariantPicker.tsx`) keeps unavailable values selectable so the per-variant back-in-stock state stays reachable.

### Sanity Studio Structure

The Studio sidebar is structured via `src/sanity/structure.ts` and `src/sanity/deskStructure/`. The Studio is accessible at `/sanity` and includes the Presentation Tool for visual editing, Media plugin for asset management, and Vision for GROQ queries.

### Environment Variables

Required in `.env`:

```
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
SITE_URL
SANITY_API_READ_TOKEN       # Needs read+write access
SANITY_REVALIDATE_SECRET
EMAIL_DISPLAY_NAME
EMAIL_SERVER_USER
EMAIL_SERVER_PASSWORD
EMAIL_SERVER_HOST
EMAIL_SERVER_PORT
KLAVIYO_PRIVATE_API_KEY     # Newsletter + product back-in-stock subscribe routes
```

Optional (Shopify integration — see `.env.example` for setup pointers):

```
SHOPIFY_STORE_DOMAIN        # your-store.myshopify.com
SHOPIFY_STOREFRONT_API_TOKEN
SHOPIFY_ADMIN_API_TOKEN     # read_products; Studio picker only
SHOPIFY_WEBHOOK_SECRET      # webhook signing secret for /api/shopify/revalidate
SHOPIFY_API_VERSION         # optional pin override (defaults in code)
```

### Type Generation

After modifying any Sanity schema file, run `npm run typegen` to update `src/sanity/extract.json` and regenerate `sanity.types.ts`. The `predev` hook runs this automatically.

### Troubleshooting

- `Error: Failed to communicate with the Sanity API` → Run `sanity logout && sanity login`
- If `SANITY_API_READ_TOKEN` is missing at runtime, `src/sanity/lib/live.ts` will throw immediately on startup
