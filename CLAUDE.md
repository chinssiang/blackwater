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

**Singleton documents** (non-duplicatable, single-instance): `gHeader`, `gFooter`, `gAnnouncement`, `gAuthor`, `pHome`, `pContact`, `p404`, `pCuratedIndex`, `settingsGeneral`, `settingsColor`, `settingsMenu`, `settingsIntegrations`, `settingsRedirect`. Configured in `sanity.config.ts` to remove "duplicate" and new-document actions.

**Document types** (multi-instance, slug-based):
- `pGeneral` — Generic pages at `/<slug>`
- `pBlog` / `pBlogIndex` / `pBlogCategory` — Blog system (routes currently disabled)
- `pCurated` / `pCuratedCategory` / `pCuratedCollection` — Curated/product system
- `pEvent` / `pEvents` / `pEventCategory` / `pEventRole` / `pEventStatus` — Event system
- `pBrand` — Brand entries
- `gTeamMember` — Team member profiles

**GROQ queries** are centralized in `src/sanity/lib/queries.ts` using `defineQuery()` from `next-sanity`. Composed from reusable fragments: `baseFields`, `linkFields`, `menuFields`, `imageMetaFields`, `imageBlockMetaFields`, `callToActionFields`, `portableTextContentFields`, `freeformField`, `pageModuleFields`, `formField`.

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
- `/curated` — Curated index; `/curated/products/[slug]`, `/curated/categories/[slug]`, `/curated/collections/[slug]`
- `/events` — Events listing; `/events/[slug]` — single event
- `/events-crew` — Event crew tracking (month-based with member filter)
- `/email-signature` — Standalone email signature utility

**Site-wide data** (`siteDataQuery`) fetches header, footer, announcement, sharing settings, and integrations in the root layout and passes to `<Layout>`.

### Routing

`src/lib/routes.ts` is the single source of truth for document type → URL resolution. `DOCUMENT_ROUTES` drives both `resolveHref()` (JS helper) and `buildDocumentHrefGroq()` (GROQ query builder). Add new routes here only — not scattered across files.

### PageModules System

`src/components/PageModules.tsx` is a switch-based renderer that maps Sanity `_type` values to React components. Currently renders `freeform` → `<Freeform>`. When adding new page module types, add the GROQ field selector to `pageModuleFields` in `queries.ts` and a case in `PageModules.tsx`.

### Key Shared Components

- `<SanityImage>` (`src/components/SanityImage.tsx`) — Renders a single Sanity image with LQIP placeholder and metadata-driven sizing.
- `<ImageBlock>` (`src/components/ImageBlock.tsx`) — Block-level image with responsive mobile/desktop images, custom aspect ratios, and captions. Uses `<SanityImage>` internally.
- `<CustomPortableText>` — Renders Sanity Portable Text with custom components for headings, links, CTAs, images, and iframes.
- `<CustomLink>` — Handles internal/external links from Sanity `link` objects.
- `<CustomForm>` — Renders form fields from Sanity `formField` schema via controlled inputs.
- `<JsonLd>` — Injects JSON-LD schema.org markup (event and site variants).
- `<BlogCard>` — Card component for blog post listings.
- `<Caption>` — Shared caption for image/media blocks.
- `<LocationCurrentTime>` — Displays location name with live local time.
- `<LogoSvg>` — SVG logo component.
- `<SvgIcons>` — SVG icon set.
- `<TextReveal>` / `<Typewriter>` — Motion-based text animation components.
- `<Menu>` / `<MenuDropdown>` / `<MobileMenu>` — Navigation components.
- `<DraftModeToast>` — Draft mode indicator banner.
- `src/components/layout/` — Shell: `AdaSkip`, `Footer`, `Header`, `HeadTrackingCode`, `Main`, `ToolBar`.
- `src/components/ui/` — Radix UI-based: Accordion, Button, Checkbox, Dialog, Field, Input, InputGroup, Label, Progress, RadioGroup, Select, Separator, Sheet, Table, Textarea, Tooltip.
- `src/components/PortableTable/` — Table rendering for Portable Text.

### Utilities (`src/lib/`)

- `utils.ts` — `cn()` (Tailwind merge), format helpers (`formatDateUsStandard`, `formatUrl`, `formatHandleize`, etc.), validate helpers (`validateEmail`, `validateUsPhone`), array helpers (`arrayIntersection`, `arrayUniqueValues`, `arraySortObjVal*`), DOM helpers (`scrollDisable`, `scrollEnable`, `debounce`, `sleeper`).
- `image-utils.ts` — `buildImageSrc()`, `buildImageSrcSet()`, `buildRgbaCssString()`.
- `routes.ts` — `DOCUMENT_ROUTES`, `resolveHref()`, `buildDocumentHrefGroq()`, `checkIfLinkIsActive()`.
- `animate.ts` — Motion animation presets: `pageTransitionFade`, `fadeAnim`.
- `defineEventJsonLd.ts` — schema.org `Event` JSON-LD builder (supports multi-location via subEvents).
- `defineSiteJsonLd.ts` — schema.org `Organization` JSON-LD builder.
- `defineMetadata.ts` — Next.js metadata builder from Sanity SEO fields.
- `icons.ts` — Maps social platform names to icon identifiers (facebook, instagram, linkedin, spotify, strava, x, youtube, github).
- `providers/` — `ReactQueryProvider` (TanStack React Query wrapper).
- `gtag/` — Google Analytics helpers.

### Hooks (`src/hooks/`)

- `useKey.js` — Keyboard event listener.
- `useOutsideClick.js` — Click outside detection.
- `useWindowDimensions.js` — Window size tracking.
- `useWindowScroll.js` — Scroll position tracking.

### API Routes (`src/app/api/`)

- `/contact-form/submit` — Contact form submission (email dispatch).
- `/draft-mode/enable` — Enables Sanity draft mode.
- `/revalidate-tag` — On-demand ISR via tag invalidation.
- `/view-page` — Page view tracking.

### Sanity Studio Structure

The Studio sidebar is structured via `src/sanity/structure.ts` and `src/sanity/deskStructure/`. The Studio is accessible at `/sanity` and includes the Presentation Tool for visual editing, Media plugin for asset management, and Vision for GROQ queries.

### Environment Variables

Required in `.env`:
```
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
NEXT_PUBLIC_SANITY_STUDIO_URL
SITE_URL
SANITY_STUDIO_PREVIEW_ORIGIN
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
