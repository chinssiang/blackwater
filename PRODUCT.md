# Product

## Register

brand

## Users

Runners in Taipei, from first-timers to experienced racers. The site is read
mostly on phones, in two languages (English and Traditional Chinese / 台灣繁體).
Typical context: someone deciding which group run or race to join this week,
browsing gear the club actually vouches for, or looking for a way into the
community. They are choosing whether to show up, not completing a transaction.

## Product Purpose

Blackwater RC (台北跑團) is a Taipei-based running club. This site is its
bilingual community hub, not a store:

- an events calendar (weekly group runs, races, socials, and gamified trail "quests"),
- a curated running-gear guide (club-vetted picks with affiliate "Buy it" links, no cart),
- newsletter / email capture, and
- internal crew rostering for event operations.

Success is people finding the club and showing up: strong discoverability (the
project invests heavily in SEO/AEO and structured data so answer engines can cite
it) and a growing, returning community. There is no membership paywall, login, or
checkout.

## Brand Personality

Warm, insider, understated. The club talks to its members as peers ("we", "the
club", "why we reach for it"), never markets at customers. Welcoming and
explicitly beginner-friendly, curatorial in how it presents gear and events, and
quietly playful (trail events are literal quests). All of that lives inside an
austere, monochrome visual identity: the tension between warm words and a spare
black-and-white frame is the brand.

## Anti-references

- **Strava-style data/stats app.** No metrics-forward dashboards, charts, big
  number tiles, or counter-heavy chrome. Blackwater is a community and a
  curatorial voice, not a performance-tracking tool.

## Design Principles

1. **Peer, not brand.** Copy and UI address members as fellow runners; the tone
   is a knowledgeable friend, not a marketing department.
2. **Curatorial restraint.** Everything shown is vetted and presented with
   editorial confidence. Monochrome frame, warm words, few things done well.
3. **Local and bilingual first.** English and Traditional Chinese are peers, not
   an afterthought; the club is rooted in Taipei.
4. **Playful in the details, austere in the frame.** Personality shows in copy
   and small moments (quests, badges), never by loosening the spare visual system.
5. **Built to be found.** Clear structure and honest content are a discovery
   strategy; the site is made to be indexed, cited, and shared.

## Accessibility & Inclusion

- Target WCAG AA. Author-chosen colors already pass through an
  `ensureAccessibleTextColor()` contrast guard (`src/lib/image-utils.ts`).
- All motion respects `prefers-reduced-motion` (see `src/lib/animate.ts` and the
  reduced-motion off-switches in `src/globals.css`).
- Full bilingual parity (English / Traditional Chinese) is a first-class requirement.
