# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

See `package.json` scripts. Two things they don't tell you:

- Sanity Studio is embedded at `/sanity` and runs alongside the Next.js app on the same port.
- `npm run typegen` must be re-run after **any** Sanity schema change (`predev` does it automatically); it regenerates `src/sanity/extract.json` and `sanity.types.ts`.

## Architecture

This is a **Next.js 16 (App Router) + Sanity v5** project. Content is managed in Sanity and rendered via Next.js. The stack uses React 19, Tailwind CSS v4, Radix UI, and Motion (Framer Motion successor).

`scripts/` holds one-shot Node data scripts run directly against a dataset, for work `defineMigration`'s per-document callback can't do (e.g. `merge-product-i18n.mjs`, which has to read a document's translation siblings). Reusable migrations live in `src/sanity/migrations/` and run via the Sanity CLI.

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
- `gFaq` — Global FAQ entries (deliberately **not** document-localized: a question's identity and its place in the list are locale-invariant, so one document carries every language in inline internationalized arrays — the `question` and the `answer` — exactly like `gSizeChart`'s measurements. It carries **no `order` field**: order is a property of the page, not the entry, so `pFaq.questions` and the `faqList` module each hold their own ordered reference array. Referenced by the `faqList` module and listed on the FAQ page.)
- `gSizeChart` — Global garment size charts (deliberately **not** document-localized: measurements are locale-invariant, so numbers are stored once and only the text is translated via inline internationalized arrays — the fit `note` and each measurement's `label`). Referenced by `pProduct.sizeChart` (which opens the chart in a dialog on the product page, falling back to a `/size-guide` link when the chart has no table to show) and listed on `/size-guide`. Authoring mirrors the rendered table: `sizes[]` are the columns (free text, e.g. `XS…2XL`, or a single `One Size`) and each `rows[]` entry is **one measurement**, holding a `label` plus one `values[]` cell per size. A cell is `{ size, min, max? }`, so a chart mixes fit ranges (`34–36`) with single measurements (`32`) and both ends stay numeric for the cm/in toggle. **Cells are matched to columns by `size`, never by array position** — reordering or inserting a size can't shift a row's numbers under the wrong heading, and `values[]` order is irrelevant. A `Rule.custom` on `rows` blocks publishing unless every measurement covers exactly the chart's `sizes` (no gaps, strays, or repeats), so a typo'd size is a loud error rather than a phantom column. There is no preset measurement vocabulary — adding a measurement is content work, not a code change.

**Localization:** Two locales (`en`, `zh_tw`) defined in `src/lib/i18n.ts`. Page/global docs are localized at the **document level** via the `documentInternationalization` plugin (`src/sanity/i18n-types.ts` lists translatable types; fetched per-locale via the `byLocale()` GROQ helper). Short, referenced strings (e.g. `gLocation.name`, `pEventStatus.title`, `settingsGeneral.alternateName`) use **inline `internationalizedArray`** instead, resolved with `coalesce(field[language == $locale][0].value, field[language == "en"][0].value)` — in `queries.ts` that coalesce is the `locString()` / `locPT()` helper, not hand-written. Length is not the test, though: `gFaq.answer` is inline `internationalizedArrayPortableTextSimple`, because what decides this is whether the *document* has a locale. A page does; a referenced entry whose identity is the same in every language does not.

**The event family (`pEvent`, `pEvents`, `pEventCategory`) is FIELD-level localized too**, on the same machinery as the product family below — one document per event carries every language. The reason is different, though: an event is a single *occurrence*, so its start time, venue, crew roster and status can only have one value, and two documents per event meant two copies of facts that drifted (two events ended up with different start times per language). Prose lives in `internationalizedArray`s, including `internationalizedArrayPortableText` — `pEvent.content` is the FULL `portableText` type, so `'portableText'` is registered in `fieldTypes` alongside `'portableTextSimple'` in `sanity.config.ts`. Everything locale-invariant (dates, `locationRef`, categories, `statusList`, team assignments, images) exists once. Notes specific to events:

- **Both event sitemap entries need `locales`, not `language`** — `pEvent` derives it from `title[].language`, while `pEvents` (the index) advertises every locale because it renders an English fallback anywhere, the same treatment `pProductCategory` gets.
- **`/events-crew` sits outside the `[locale]` segment**, so it has no `$locale` to resolve against. Its queries use the `crewString()` helper in `queries.ts`, which coalesces **zh_tw first, then en** — the crew is Taiwan-based and the roster is written in Chinese. `locationRef.name` already worked this way; `title`, `subtitle`, `location`, `teamNotes` and `teamAssignments[].note` joined it. The crew view also used to count every translated event twice; one document per event fixed that.
- **The event queries carry no transition tails**, and since the product merge completed the product queries carry none either — see the note at the end of the product section below. Events were migrated in the same deploy as the code (`scripts/merge-event-i18n.mjs`), so there was never a window where old-shape event documents met new-shape queries.
- **`scripts/merge-event-i18n.mjs` groups siblings by their `translation.metadata` set, not by slug.** Two events were authored with a `-zhTW` slug on the Chinese side, so slug grouping would split them and publish two documents for one occurrence. Its Sanity client is created with `perspective: 'raw'` so that drafts are visible as `drafts.*` ids — under the client's default (`drafts`) perspective a draft is overlaid onto the published id, and the "publish or discard your drafts first" guard silently passes while the merge reads draft content instead of published.

**The product family (`pProduct`, `pProductCollection`, `pProductCategory`) is FIELD-level localized** — one document per product carries every language, mirroring Shopify's one-entity model. Prose lives in `internationalizedArray`s (including `internationalizedArrayPortableTextSimple`, registered via `fieldTypes` in `sanity.config.ts`); everything locale-invariant (Shopify handle, price, refs, images, `soldOut`) exists once, and references to products never involve a language choice. Consequences that differ from the doc-level types: a product's translated-ness is signalled by `title[].language` (drives visibility — a zh-only product is hidden from `en` listings and 404s on the `en` route — plus hreflang via `availableLocales` and the sitemap `locales` projection); slugs are validated with `isUniqueAcrossType` because the default check silently passes when there is no `language` field; the Studio shows one language at a time via the plugin's built-in `languageFilter` (the "Showing 1/2" control is `@sanity/language-filter`, registered automatically because `sanity.config.ts` passes `languageFilter.documentTypes`, derived from `FIELD_LEVEL_I18N_TYPES`; the selection persists per browser in `localStorage`). That config also sets **`buttonAddAll: false`** — with the filter narrowed, the plugin's "Add missing languages" button appears and does nothing, because it decides visibility from the unfiltered item count but only ever adds *visible* languages. The per-language `en`/`zh_tw` chips beside it do the same job correctly. **Both datasets are fully migrated** (`scripts/merge-product-i18n.mjs` reports nothing left to do), so the `select(defined(language) => …)` transition tails have been removed from `queries.ts`: the product projections now read the merged shape only. `defined(language)` survives in that file solely for the DOCUMENT-level types — `byLocale`, `availableLocalesField`, `pGeneral`, and the `pProductIndex` arm of `SITEMAP_PRODUCTS_QUERY` — so don't read a stray `language` check there as leftover product scaffolding. Note `pProductIndex` is document-level and is NOT part of this family.

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

Every route lives under `/[locale]/(site)/` except `/events-crew` and `/email-signature`, which sit outside the locale segment and therefore have no `$locale` to resolve against. `[...rest]` is a catch-all inside `(site)` that renders the localized 404 inline — `notFound()` can't render a styled boundary here.

**Site-wide data** (`siteDataQuery`) is fetched once per request via `getCachedSiteData` (`src/sanity/lib/siteData.ts`). `HtmlShell` (a Server Component) receives the full result; the client `<Layout>` receives only the `pickLayoutData()` slice — header, footer, newsletter, mobileMenu, toolbar, cart, siteTitle — because everything handed to `<Layout>` is serialized into every page's RSC payload. `announcement`, the rest of `sharing`, `consent`, `integrations` and `productSubmissionEmail` deliberately do not cross that boundary (the last three are consumed server-side or passed separately by `HtmlShell`).

**Every page under `[locale]` is prerendered (SSG), and one careless line takes them all back out.** A dynamic API anywhere in a layout opts its whole subtree out of static generation, so `[locale]/layout.tsx` must not call `cookies()`, `headers()` or `connection()` — a single `cookies()` there, reading the consent decision, was what kept all ~380 pages server-rendered on demand. Freshness comes from tags instead: `sanityFetch` already sets `revalidate: false` plus tags, so `/api/revalidate-tag` and `/api/shopify/revalidate` invalidate the prerendered HTML, not just the Data Cache. Two consequences worth knowing: the Shopify webhooks stop being optional (a missed one freezes a price in HTML until the next deploy), and `router.refresh()` is no longer a way to make the server re-decide anything — on a prerendered route it re-fetches the same cached payload. What stays dynamic, correctly: `[...rest]` (the 404 catch-all), and `products/all` + `events-crew` (both read `searchParams`).

**Cookie consent is read in the browser, never on the server** — that is the whole reason the above holds. `useConsent` (`src/hooks/useConsent.ts`) is a `useSyncExternalStore` over the `bw_consent` cookie with three states: `undefined` (not read yet — the server snapshot), `null` (no decision, prompt), or the decision. Both `ConsentBanner` and `HeadTrackingCode` read it, so prerendered HTML carries neither the banner nor any tracking script, and a returning visitor sees no banner flash. Writers call `writeConsentClient` then dispatch `CONSENT_CHANGED_EVENT`; everything else follows from the re-read. `HeadTrackingCode` is the only thing that talks to gtag, which is what keeps Consent Mode's one-`default`-before-any-`update` ordering a local invariant rather than a race — do not push consent signals from the banner as well.

**Entrance animations are CSS, not JS.** Page content fades in via the `reveal` utility in `globals.css` — add the class and, optionally, `--reveal-delay` / `--reveal-duration` / `--reveal-ease` through the `style` prop (`REVEAL_SOFT` and `revealStagger(index)` in `src/lib/animate.ts` carry the shared presets). Do **not** reach for a Motion mount animation or a keyframe animation for this: both make invisible the default and need something to execute to undo it, so a page the browser never paints — or one whose JS never hydrates — strands the price and buy button at `opacity: 0`. `reveal` instead leaves the element's own opacity alone and puts the hidden value in `@starting-style`, so it is only ever a transition start point. Read the comment on the utility before adding a delay: the delay window is the one span where content is still hidden, so keep it off anything a shopper must see or click. `.animate-page-in` (the per-navigation fade on `<main>`) works the same way for the same reason.

### Routing

`src/lib/routes.ts` is the single source of truth for document type → URL resolution. `DOCUMENT_ROUTES` drives `resolveHref()`; the GROQ equivalent is the hand-maintained `resolvedHrefGroq` literal beside it.

**`usePathname()` is not the same string at build time and in the browser, and route predicates must normalize for that.** `proxy.ts` rewrites the public `/products/x` onto the internal `/en/products/x`, and `generateStaticParams` prerenders that internal path — so a prerender sees the `/en` prefix and the client router never does. Any predicate that compares a `usePathname()` value therefore has to strip **every** locale prefix, the default included, or the build bakes one answer into the HTML and JS visibly corrects it after hydration. That is what shipped `/products` and `/size-guide` dark before flipping them to light, hid the `/newsletter` newsletter block only after hydration, left nav active-state out of every prerendered page, and put a broken `/zh_tw/en/...` language-switcher href on all 182 English pages. The split lives in `src/lib/i18n.ts`: **`stripLocaleFromPathname` for anything out of `usePathname()`, `stripLocaleFromHref` for an authored or resolved link target** — the two differ only on the default prefix, which is exactly where the mistake is invisible, since in an href `/en/...` is a real path segment (a `pGeneral` page slugged `en`) that must survive. `src/lib/routes.ts` wraps them as `normalizeRoutePath` / `normalizeHrefPath`; `checkIfLinkIsActive` needs one of each, because it compares a pathname against an href. Regression tests are in `src/lib/routes.test.ts`.

**Adding a routable page type touches four hand-maintained lists** — `DOCUMENT_ROUTES` and the `resolvedHrefGroq` literal (both in `routes.ts`; the literal is hand-written because Sanity's query extractor substitutes syntax rather than executing JS — arrow-function calls with a concise body *do* resolve, which is how `locString`/`byLocale` work, but `.map()`/`.join()`, block bodies, `+` and ternaries do not, and deriving this `select()` needs iteration), plus `internalLink.to[]` in `schemaTypes/objects/link.ts` and `pageDocumentOrder` in `schemaTypes/components/LinkObject.tsx`. Miss either of the last two and the page never appears in the Studio link picker, so editors cannot add it to a menu or CTA and the `resolvedHrefGroq` case is dead. Also add the type to `SITEMAP_PAGES_QUERY` and `presentation-resolver.ts`.

### PageModules System

`src/components/PageModules.tsx` is a switch-based renderer that maps Sanity `_type` values to React components. Renders `freeform` → `<Freeform>` and `faqList` → `<FaqList>`. When adding new page module types, add the GROQ field selector to `pageModuleFields` in `queries.ts` and a case in `PageModules.tsx`. The `faqList` module is available on `pHome.pageModules` and `pGeneral.pageModules`.

### SEO & Structured Data

- **Metadata** comes from each doc's `sharing` fields via `src/lib/defineMetadata.ts`; site-level metadata (title template, favicons, OG defaults) lives in the root layout.
- **JSON-LD** is injected via `<JsonLd>`, with per-schema builders in `src/lib/define*JsonLd.ts`. **It must be built from `stegaClean`-ed data** so draft mode doesn't leak stega characters into the markup. Use `collectFaqItems()` to pull FAQ items out of `faqList` modules.
- **Sitemap and robots are dynamic**, so `SITE_URL` must be set or absolute URLs break. `robots.ts` deliberately allows AI/answer-engine crawlers.
- **FAQ system**: author entries once in `gFaq` (Global → FAQ), then choose where each appears — the `faqList` module's reference array on a page, and/or `pFaq.questions` for `/faq`. **Both lists are opt-in and ordered by the editor**, so an entry listed nowhere renders nowhere, and one entry can sit in different positions on different pages. `pFaq` is still document-localized, so each locale's FAQ page owns its own list — adding an entry means adding it to both, the same trade `pSizeGuide` makes with `gSizeChart`. **An empty `pFaq.questions` is a WARNING, not an error**, so a FAQ page with no questions is publishable and renders only its title and intro. That is deliberate but temporary: a hard `required()` would make both prod `pFaq` documents unpublishable for the whole window between deploying this schema and running `scripts/merge-faq-i18n.mjs`, blocking unrelated edits to title/intro/SEO. Once prod is migrated the rule can be tightened back to `Rule.required().min(1)`.

### Key Shared Components

Most of `src/components/` is self-describing; these carry rules the code alone won't teach you.

- `<SizeChartTable>` — Renders one `gSizeChart` as a table. Exports `isRenderable()` so callers gate empty states on the same condition it bails on (it `stegaClean`s each size — draft mode encodes metadata into `sizes[n]`, so a raw truthiness test calls an empty chart renderable). Uses `border-separate` and a column-count-derived `minWidth` so the label column can pin while values scroll, and marks the scroll container as a focusable `role="region"` so keyboard users can reach clipped columns — see the notes in the file before changing any of these.
- `<LocationCurrentTime>` — Live local Taipei time on `/events*`. **Always import it from `@/components/LocationCurrentTimeLazy`**, never from the component file directly: it carries `date-fns` plus both locale bundles, and both render sites (Header, MobileMenu) sit in the always-mounted chrome — one static import anywhere puts that weight back into every route's shared chunk (measured: −61KB with both sites lazy).
- `<ProductCard>` — Shopify-unaware by design; its `price` is rewritten upstream by `applyCardPrices`.
- `ui/Carousel` — embla, not Radix, unlike everything else in `ui/`. The product gallery is its only consumer.

### Utilities (`src/lib/`)

Function-level detail is in the files; these are the non-obvious ones.

- `dateFnsLocale.ts` — the app-locale → date-fns locale map. A leaf module on purpose (NOT part of `i18n.ts`, which nearly everything imports — putting it there would drag both date-fns locale bundles into every consumer). Use it instead of hand-rolling `locale === 'zh_tw' ? zhTW : enUS`; its `satisfies Record<Locale, unknown>` breaks the build when a locale is added without a mapping.
- `defineMetadata.ts` — also exports `omitPageMetadata()` / `WithoutPageMetadata<T>`: listing pages spread their whole query result into a client component, so they strip `sharing` and `availableLocales` (read only by `generateMetadata`) at that boundary rather than serializing them into the RSC payload for nothing. The return type drops the keys too, so a component that later reaches for `data.sharing` fails to compile instead of getting `undefined` at runtime.
- `size-measurements.ts` — `SIZE_UNITS` doubles as the order the cm/in control renders in, so reordering it changes the UI.
- `utils.ts` — `appendReferralParams()` / `REFERRAL_SOURCE` are what put UTM params on an outbound `purchaseLink`.

### Hooks (`src/hooks/`)

- `useScrollLock.ts` — Locks document scroll while an overlay is open, and keeps that lock honest across the page lifecycle (`pagehide` releases it, `pageshow` lets the owner close itself on a bfcache restore). Used by `CartDrawer` and `MobileMenu`; **the lock is global, so new overlays must go through this** rather than calling `scrollDisable`/`scrollEnable` directly.
- `useScrollSpy.ts` — IntersectionObserver scroll-spy for in-page section navs + horizontal-strip auto-scroll; also exports `readRootPxVar()`.

### Commerce (Shopify + cart)

Products are **hybrid**: Sanity owns everything editorial (slug/routes, title, content, taxonomy, size charts, SEO, i18n) and Shopify owns commerce (price, compare-at, availability, variants, cart, checkout), coupled by `pProduct.shopify.handle`. The site is the store; the shopper only leaves at Shopify's hosted checkout.

**The rules that govern `src/lib/shopify/`, `src/app/api/shopify/`, `src/components/cart/` and the product detail page live in `.claude/rules/shopify-cart.md`**, which loads automatically on its `paths` frontmatter whenever those files are in play — several of its constraints (uncached carts, no `@inContext` on cart calls, the split `mainImage`/gallery ownership, the `cache()` argument-identity requirement) look like inconsistencies begging to be tidied up and must not be. Read it before touching any of those; if you are editing them and it has not loaded, open it explicitly.

### Environment Variables

The full list is in `.env.example`; the Shopify walkthrough is `docs/SHOPIFY-SETUP.md`. What those files don't say:

- **The Shopify vars are all optional.** Without `SHOPIFY_STORE_DOMAIN` plus a Storefront token, the whole integration no-ops and products render from the manual Sanity fields.
- `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` (Headless channel) is preferred over `SHOPIFY_STOREFRONT_API_TOKEN` — the public one is throttled per buyer IP.
- `SANITY_READ_WRITE_TOKEN` is **only** for the one-shot `scripts/`, never read by the app. `SANITY_API_READ_TOKEN` cannot mutate.
- `SHOPIFY_ADMIN_API_TOKEN` is retired and read nowhere — a 38-char `shpss_` value is an app *client secret*, not an access token, and belongs in neither.

### Troubleshooting

- `Error: Failed to communicate with the Sanity API` → Run `sanity logout && sanity login`
- If `SANITY_API_READ_TOKEN` is missing at runtime, `src/sanity/lib/live.ts` will throw immediately on startup
