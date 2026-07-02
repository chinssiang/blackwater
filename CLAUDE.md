# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server on port 3001 with Turbopack (runs typegen first via predev hook)
npm run build        # Build for production
npm run typegen      # Extract Sanity schema and generate TypeScript types
npm run lint         # Run ESLint
```

Sanity Studio is embedded at `/sanity` and runs alongside the Next.js app on the same port (3001 in dev).

To regenerate Sanity TypeScript types after schema changes:

```bash
npm run typegen
# This runs: sanity schema extract && sanity typegen generate
```

## Architecture

This is a **Next.js 16 (App Router) + Sanity v5** project. Content is managed in Sanity and rendered via Next.js. The stack uses React 19, Tailwind CSS v4, Radix UI, and Motion (Framer Motion successor).

### Directory Structure

- `src/app/(frontend)/` — All public-facing routes. Localized site routes live under the nested `[locale]/(site)/` segment (e.g. `src/app/(frontend)/[locale]/(site)/products/page.tsx`); only `email-signature/` and `events-crew/` sit directly under `(frontend)/`
- `src/app/sanity/` — Embedded Sanity Studio at `/sanity`
- `src/app/api/` — API routes (draft mode, revalidation, email, page views, newsletter, product submission)
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

- `g-*` = global content types — some are singletons (header, footer, announcement, mobile menu, toolbar, newsletter), others are multi-instance documents (team-member, location, faq, tag)
- `p-*` = page singletons or document types
- `settings-*` = settings singletons (general, brand colors, menus, integrations, redirect, consent)

**Singleton documents** (non-duplicatable, single-instance — the `singletonDocuments` array in `sanity.config.ts`): `gHeader`, `gFooter`, `gMobileMenu`, `gToolbar`, `gAnnouncement`, `gNewsletter`, `pHome`, `pContact`, `pFaq`, `p404`, `pNewsletter`, `pProductIndex`, `settingsGeneral`, `settingsIntegration`, `settingsConsent`. Configured in `sanity.config.ts` to remove "duplicate" and new-document actions. (The `gAuthor`, `settingsBrandColors`, `settingsMenu`, and `settingsRedirect` schemas exist but are not in the singleton list.)

**Document types** (multi-instance, slug-based):

- `pGeneral` — Generic pages at `/<slug>`
- `pBlog` / `pBlogIndex` / `pBlogCategory` — Blog system (routes currently disabled)
- `pProduct` / `pProductCategory` / `pProductCollection` — Product system
- `pEvent` / `pEvents` / `pEventCategory` / `pEventRole` / `pEventStatus` — Event system
- `pBrand` — Brand entries
- `gTeamMember` — Team member profiles
- `gTag` — Tag entries
- `gLocation` — Event venues (referenced by `pEvent`; carries `address` + `geo` for structured data)
- `gFaq` — Global FAQ entries (document-level i18n via `documentInternationalization`; referenced by the `faqList` module and listed on the FAQ page)

**Localization:** Two locales (`en`, `zh_tw`) defined in `src/lib/i18n.ts`. Page/global docs are localized at the **document level** via the `documentInternationalization` plugin (`src/sanity/i18n-types.ts` lists translatable types; fetched per-locale via the `byLocale()` GROQ helper). Short, referenced strings (e.g. `gLocation.name`, `pEventStatus.title`, `settingsGeneral.alternateName`) use **inline `internationalizedArray`** instead, resolved with `coalesce(field[language == $locale][0].value, field[language == "en"][0].value)`.

**GROQ queries** are centralized in `src/sanity/lib/queries.ts` using `defineQuery()` from `next-sanity`. Composed from reusable fragments: `baseFields`, `linkFields`, `menuFields`, `imageMetaFields`, `imageBlockMetaFields`, `callToActionFields`, `portableTextContentFields`, `freeformField`, `faqListField`, `gFaqItemFields`, `pageModuleFields`, `formField`.

**Data fetching** uses `sanityFetch` from `src/sanity/lib/live.ts` (wraps `defineLive` from `next-sanity`). This enables live content updates. Usage pattern in pages:

```ts
const { data } = await sanityFetch({ query: someQuery, tags: ['docType'] });
```

**Visual Editing / Draft Mode** is enabled via Sanity Presentation Tool. When draft mode is active, `<VisualEditing />` and `<DraftModeToast />` are rendered. The presentation resolver at `src/sanity/lib/presentation-resolver.ts` maps routes to Sanity document types.

### Page Architecture

Each page route follows this pattern:

1. Server component in `src/app/(frontend)/[locale]/(site)/[route]/page.tsx` — fetches data via `sanityFetch`
2. `generateMetadata()` — fetches data with `stega: false` for clean metadata
3. `generateStaticParams()` — for dynamic slug routes, fetches all slugs at build time
4. Render delegates to a `_components/Page*.tsx` client or server component

**Active frontend routes** (all under `[locale]/(site)/` unless noted; the default locale `en` has no URL prefix, other locales are prefixed, e.g. `/zh_tw/products`):

- `/` — Home (`pHome`)
- `/[slug]` — Generic pages (`pGeneral`)
- `/[...rest]` — Catch-all that renders the localized 404 content for unmatched paths
- `/contact` — Contact page
- `/faq` — FAQ page (`pFaq`; renders the full set of locale-matched `gFaq` entries)
- `/newsletter` — Newsletter page (`pNewsletter`)
- `/products` — Product index (`pProductIndex`); `/products/[slug]`, `/products/all`, `/products/categories`, `/products/categories/[slug]`, `/products/collections`, `/products/collections/[slug]`
- `/events` — Events listing; `/events/[slug]` — single event
- `/events-crew` — Event crew tracking (month-based with member filter; directly under `(frontend)/`, not localized)
- `/email-signature` — Standalone email signature utility (directly under `(frontend)/`, not localized)

**Site-wide data** (`siteDataQuery`) fetches header, footer, announcement, sharing settings, and integrations in the root layout and passes to `<Layout>`.

### Routing

`src/lib/routes.ts` is the single source of truth for document type → URL resolution. `DOCUMENT_ROUTES` drives both `resolveHref()` (JS helper) and `buildDocumentHrefGroq()` (GROQ query builder). Add new routes here only — not scattered across files.

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
- `<BlogCard>` — Card component for blog post listings.
- `<Caption>` — Shared caption for image/media blocks.
- `<LocationCurrentTime>` — Displays location name with live local time.
- `<WordmarkSvg>` — SVG logo component.
- `<SvgIcons>` — SVG icon set.
- `<TextReveal>` / `<Typewriter>` — Motion-based text animation components.
- `<Menu>` / `<MenuDropdown>` / `<MobileMenu>` — Navigation components.
- `<LanguageSwitcher>` — Locale switcher.
- `<LocaleProvider>` / `<ThemeProvider>` — Context providers for locale and theme.
- `<Freeform>` — Renders the `freeform` page module.
- `<ProductSubmission>` — Product submission form.
- `<Popover>` — Popover component.
- `<DraftModeToast>` — Draft mode indicator banner.
- `src/components/consent/` — Cookie consent: `ConsentBanner`, `ManageCookiesButton` (backed by `settingsConsent` and `src/lib/consent.ts`).
- `src/components/layout/` — Shell: `AdaSkip`, `Footer`, `Header`, `HeadTrackingCode`, `HtmlShell`, `Main`, `Newsletter`, `ToolBar`.
- `src/components/ui/` — Radix UI-based: Accordion, Badge, Button, Checkbox, Dialog, DropdownMenu, Field, Input, InputGroup, Label, Pagination, Progress, RadioGroup, Select, Separator, Sheet, Spinner, Table, Textarea, Tooltip.
- `src/components/PortableTable/` — Table rendering for Portable Text.

### Utilities (`src/lib/`)

- `utils.ts` — `cn()` (Tailwind merge), format helpers (`formatDateUsStandard`, `formatUrl`, `formatHandleize`, etc.), validate helpers (`validateEmail`, `validateUsPhone`), array helpers (`arrayIntersection`, `arrayUniqueValues`, `arraySortObjVal*`), DOM helpers (`scrollDisable`, `scrollEnable`, `debounce`, `sleeper`).
- `image-utils.ts` — `buildImageSrc()`, `buildImageSrcSet()`, `buildRgbaCssString()`.
- `routes.ts` — `DOCUMENT_ROUTES`, `resolveHref()`, `buildDocumentHrefGroq()`, `checkIfLinkIsActive()`.
- `animate.ts` — Motion animation presets: `pageTransitionFade`, `fadeAnim`.
- `defineEventJsonLd.ts` — schema.org `Event` JSON-LD builder (multi-location subEvents; emits endDate, PostalAddress + GeoCoordinates from `locationRef`, keywords, offers).
- `defineSiteJsonLd.ts` — schema.org `Organization` + `SportsClub` and `WebSite` JSON-LD builder (areaServed, knowsLanguage, alternateName, address).
- `defineFaqJsonLd.ts` — `FAQPage` JSON-LD builder; `collectFaqItems()` flattens `faqList` modules into items.
- `defineBreadcrumbJsonLd.ts` — `BreadcrumbList` JSON-LD builder (1-based positions, absolute URLs).
- `defineMetadata.ts` — Next.js metadata builder from Sanity SEO fields.
- `defineBaseMetadata.ts` — Site-level base metadata builder.
- `i18n.ts` — Locale definitions and path helpers (`LOCALES`, `localizePath`, `stripLocaleFromPath`, `byLocale`).
- `dictionary.ts` / `dictionary.server.ts` — UI string dictionaries per locale (from `src/dictionaries/`).
- `consent.ts` — Cookie consent helpers.
- `buildEventName.ts` — Event display-name builder.
- `event-date.ts` — Event date helpers.
- `icons.ts` — Maps social platform names to icon identifiers (facebook, instagram, linkedin, spotify, strava, x, youtube, github).
- `providers/` — `ReactQueryProvider` (TanStack React Query wrapper).
- `gtag/` — Google Analytics helpers.

### Hooks (`src/hooks/`)

- `useKey.js` — Keyboard event listener.
- `useOutsideClick.js` — Click outside detection.
- `useReveal.ts` — Entrance-reveal props for Motion components (honors `prefers-reduced-motion`).
- `useWindowDimensions.js` — Window size tracking.
- `useWindowScroll.js` — Scroll position tracking.

### API Routes (`src/app/api/`)

- `/contact-form/submit` — Contact form submission (email dispatch).
- `/draft-mode/enable` — Enables Sanity draft mode.
- `/newsletter/subscribe` — Newsletter signup.
- `/product-submission/submit` — Product submission form handling.
- `/revalidate-tag` — On-demand ISR via tag invalidation.
- `/view-page` — Page view tracking.

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
```

### Type Generation

After modifying any Sanity schema file, run `npm run typegen` to update `src/sanity/extract.json` and regenerate `sanity.types.ts`. The `predev` hook runs this automatically.

### Troubleshooting

- `Error: Failed to communicate with the Sanity API` → Run `sanity logout && sanity login`
- If `SANITY_API_READ_TOKEN` is missing at runtime, `src/sanity/lib/live.ts` will throw immediately on startup
