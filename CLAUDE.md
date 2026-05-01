# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (runs typegen first via predev hook)
npm run build        # Build for production
npm run typegen      # Extract Sanity schema and generate TypeScript types
npm run lint         # Run ESLint
npm run analyze      # Build and open Webpack Bundle Analyzer
```

Sanity Studio is embedded at `/sanity` and runs alongside the Next.js app on the same port.

To regenerate Sanity TypeScript types after schema changes:
```bash
npm run typegen
# This runs: sanity schema extract --path=src/sanity/extract.json && sanity typegen generate
```

## Architecture

This is a **Next.js 16 (App Router) + Sanity v5** project. Content is managed in Sanity and rendered via Next.js. The stack uses React 19, Tailwind CSS v4, Radix UI, and Motion (Framer Motion successor).

### Directory Structure

- `src/app/(frontend)/` — All public-facing routes using Next.js route groups
- `src/app/sanity/` — Embedded Sanity Studio at `/sanity`
- `src/app/api/` — API routes (draft mode, revalidation, email)
- `src/sanity/` — All Sanity configuration and schema
- `src/components/` — Shared React components
- `src/lib/` — Utilities, providers, metadata helpers
- `src/hooks/` — Custom React hooks (also some `.js` files in `src/components/`)

### Sanity Integration

**Schema naming conventions:**
- `g-*` = global singletons (header, footer, announcement)
- `p-*` = page singletons or document types (home, contact, blog, events)
- `settings-*` = settings singletons (general, colors, menus, integrations)

Schema types live in `src/sanity/schemaTypes/` split into `singletons/`, `documents/`, and `objects/`. The full list is exported from `src/sanity/schemaTypes/index.ts`.

**Singleton documents** (non-duplicatable, single-instance): `gHeader`, `gFooter`, `gAnnouncement`, `pHome`, `pContact`, `p404`, `settingsGeneral`, `settingsIntegration`. These are configured in `sanity.config.ts` to remove "duplicate" and new-document actions.

**GROQ queries** are centralized in `src/sanity/lib/queries.ts` using `defineQuery()` from `next-sanity`. All queries are composed from reusable field fragments (`baseFields`, `linkFields`, `imageMetaFields`, etc.).

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

The `[slug]` catch-all route handles `pGeneral` document type pages. Events (`/event/[slug]`) and blog posts (`/blog/[slug]`) have their own route directories.

**Site-wide data** (`siteDataQuery`) fetches header, footer, announcement, sharing settings, and integrations in the root layout and passes to `<Layout>`.

### PageModules System

`src/components/PageModules.tsx` is a switch-based renderer that maps Sanity `_type` values to React components. Currently renders `freeform` → `<Freeform>`. When adding new page module types, add the GROQ field selector to `pageModuleFields` in `queries.ts` and a case in `PageModules.tsx`.

### Key Shared Components

- `<SanityImage>` (`src/components/SanityImage.tsx`) — Renders a single Sanity image with LQIP placeholder and metadata-driven sizing. Use for individual Sanity images.
- `<ImageBlock>` (`src/components/ImageBlock.tsx`) — Block-level image component with responsive mobile/desktop images, custom aspect ratios, and captions. Uses `<SanityImage>` internally. Use for image blocks from Sanity page modules.
- `<CustomPortableText>` — Renders Sanity Portable Text blocks with custom components for headings, links, CTAs, images, and iframes.
- `<CustomLink>` — Handles internal/external links from Sanity `link` objects.
- `src/components/ui/` — shadcn/ui-style components (Button, Input, Select, etc.) built on Radix UI.

### Utilities (`src/lib/utils.ts`)

Central utility file with:
- `cn()` — Tailwind class merging (clsx + tailwind-merge)
- `buildImageSrc()` / `buildImageSrcSet()` — Sanity image URL builder helpers
- `resolveHref()` — Maps Sanity document type + slug to URL path
- `buildRgbaCssString()` — Converts Sanity color objects to CSS rgba strings
- Many format/validation/array helpers

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

After modifying any Sanity schema file, run `npm run typegen` to update `src/sanity/extract.json` and regenerate `sanity.types.ts`. The `predev` hook runs this automatically before `npm run dev`, but not before `npm run build`.

### Troubleshooting

- `Error: Failed to communicate with the Sanity API` → Run `sanity logout && sanity login`
- If `SANITY_API_READ_TOKEN` is missing at runtime, `src/sanity/lib/live.ts` will throw immediately on startup
