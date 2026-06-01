# SEO / AEO Launch Checklist

The codebase ships the technical SEO + structured-data foundation (metadata, hreflang
sitemap, robots with AI crawlers, Organization/SportsClub + Event + FAQ + Breadcrumb
JSON-LD). **That work is necessary but not sufficient** — the site only ranks / gets
cited once it's deployed, filled with content, and indexed. Work through this list.

> Goal: a search for **Blackwater RC** surfaces the site; **台北跑團** ranks over time;
> AI assistants (ChatGPT, Perplexity, Google AI Overviews) can cite us.

---

## 1. Deploy to production (gate — nothing counts on localhost)

- [ ] Deploy to the live domain.
- [ ] Set `SITE_URL` to the canonical production URL (e.g. `https://www.blackwaterrc.com`).
      Canonical tags, `sitemap_index.xml`, `robots.txt`, and all JSON-LD use it.
- [ ] Confirm `https://<domain>/robots.txt` lists the AI crawler rules + the sitemap line.
- [ ] Confirm `https://<domain>/sitemap_index.xml` and its child sitemaps load.

## 2. Enter content in Sanity Studio (empty fields = nothing to match)

**Settings → General** (fill EN + 中文):

- [ ] `siteTitle` — e.g. "Blackwater RC"
- [ ] `alternateName` — **台北跑團** (zh_tw), English alt if any
- [ ] `siteDescription` — lead with the answer, e.g.
      _"台北跑團 (Blackwater RC) is a Taipei-based running club hosting weekly group runs,
      races, and community events for runners of all levels."_
- [ ] `areaServed` — "Taipei, Taiwan" / "台灣台北"
- [ ] `address` (locality/region), `contactEmail`, `socialLinks` (all profiles → `sameAs`), `siteLogo`
- [ ] Per-page **SEO + Sharing**: `metaTitle` + `metaDesc` on Home, Events, Contact, FAQ
      (don't repeat the brand in `metaTitle` — the template appends it).

**Global → FAQ (`gFaq`)** — author entries once, then **Translate** to 中文:

- [ ] "Where do you run in Taipei?", "How do I join?", "Are beginners welcome?", "Is there a fee?"
- [ ] Add a **FAQ module** to the Home page (pick a 3–4 question subset).
- [ ] Create the **FAQ Page** singleton (Primary Pages → FAQ Page) + translate it.

**Events** — set `eventType`, `endDatetime`; on `gLocation` fill `address` + `geo` (lat/lng).

## 4. Google Search Console (accelerates indexing — the real gate)

- [ ] Add + verify the domain property.
- [ ] Submit `sitemap_index.xml`.
- [ ] "Request indexing" for the homepage + key pages (URL Inspection).
- [ ] After a few days, check **Pages** (indexed status) and **Enhancements** (FAQ, Breadcrumb,
      Events rich-result reports).

## 5. Validate structured data on live URLs

- [ ] [Rich Results Test](https://search.google.com/test/rich-results) on Home, an Event, `/faq`.
      Expect: `Organization`/`SportsClub` (with alternateName/areaServed/knowsLanguage),
      `FAQPage`, `Event` (start+end+location address/geo), `BreadcrumbList`.
- [ ] [Schema.org validator](https://validator.schema.org/) — no errors.
- [ ] View source: each `<head>` JSON-LD reflects the active locale (`inLanguage`, localized text).

## 6. Off-site authority (moves the needle more than markup)

- [ ] **Google Business Profile** — create/claim (name, Taipei location, website link).
      Biggest lever for local + brand knowledge panel.
- [ ] Consistent name + link on all social profiles (Instagram, Strava, etc.).
- [ ] Earn mentions/backlinks: event listings, partner sites, press referencing
      "Blackwater RC / 台北跑團" with a link.

---

## Realistic expectations

| Query / signal                               | When                                           |
| -------------------------------------------- | ---------------------------------------------- |
| **"Blackwater RC"** (exact brand) → our site | days–weeks after indexing                      |
| FAQ / breadcrumb / event rich results        | weeks (after Google re-crawls + trusts markup) |
| **"台北跑團"** (generic phrase) ranking      | months — driven by authority + competition     |
| AI assistants citing us                      | after crawl + enough authority; not guaranteed |

Structured data does **not** rank the site by itself — it makes us eligible for rich
results and helps AI understand/cite us. Ranking = indexing + relevance + authority.

## Re-run after schema changes

After any Sanity schema edit: `npm run typegen`, then `npm run build`.
