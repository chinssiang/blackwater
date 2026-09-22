# Design

The visual system for Blackwater RC, and the canonical reference for it. Read this
before any UI work.

- **`PRODUCT.md`** — strategy, register, users, brand personality, anti-references.
- **`CLAUDE.md`** — architecture: Sanity, routing, page modules, data fetching.
- **`.claude/rules/shopify-cart.md`** — commerce and cart contracts.

Every value below is quoted from the source. Where a rule exists because something
broke, the failure is named — that is the part you cannot re-derive by reading the
code. Hand-maintained: do **not** regenerate this file from the codebase, which
would discard the rationale and the anti-patterns.

## Reader and task

Runners in Taipei, mostly on a phone, in English or Traditional Chinese — the two
locales are peers, not an original and a translation. They are deciding whether to
show up: which run to join this week, whether the club is for them, occasionally
whether to buy a piece of the club's kit. Austere monochrome frame, warm insider
copy; the tension between the two is the brand. Nothing here is a dashboard — see
`PRODUCT.md`'s anti-reference.

## Theme and surfaces

**Dark by default, site-wide.** `ThemeProvider.tsx` passes next-themes a
`forcedTheme` that is a ternary and therefore **always set**, so the `defaultTheme`
and `enableSystem` props beside it are inert. There is no user-facing theme switch,
and there cannot be one while `forcedTheme` is present — next-themes ignores
`setTheme` entirely. A `d`-key hotkey sat there calling it for months, doing
nothing, before it was removed.

**Two routes are forced light**, themselves and every descendant —
`LIGHT_THEME_PATHS = ['/products', '/size-guide']` in `src/lib/routes.ts`, matched
through `isLightThemePath()` on a locale-stripped path. Both token sets are live;
design new work for both.

There are **four theming scopes**, not two:

| Scope                             | Where          | What it does                                                         |
| --------------------------------- | -------------- | -------------------------------------------------------------------- |
| `:root`                           | `globals.css`  | the light set                                                        |
| `.dark`                           | on `<html>`    | the dark set                                                         |
| `.cart-surface`                   | the cart panel | pins twelve light values so the panel reads the same on a dark route |
| `.section-ink` / `.section-paper` | `SectionShell` | Sanity-authored per-section colour                                   |

**The mechanism to understand before touching any of them:** `@theme inline`
compiles `text-foreground` to `color: var(--foreground)` and `bg-background` to
`background-color: var(--background)`, each **read at the element carrying the
class**. So a utility on a descendant always beats a `color` inherited from an
ancestor. Setting `color` alone on a section left `<ProductCard>`'s own
`text-foreground` lines untouched and its `bg-background` image frame black. Every
off-theme surface therefore **redefines tokens**, and stopping at ink and paper is
not enough — leaving `--border` and `--muted-foreground` themed makes dividers
invisible and muted copy fail AA (concretely: `ui/Accordion`'s `border-b` and its
`text-muted-foreground` chevron inside a light FAQ section on the dark theme).

## Color

**Achromatic by default.** Everything structural is OKLCH chroma 0. Colour appears
only as one accent and as author-controlled taxonomy/status swatches. Never `#000`
or `#fff` — the darkest ink is `oklch(0.145 0 0)` and the lightest paper
`oklch(0.9612 0 0)`.

Live tokens, exact values:

| Token                  | Light (`:root`)              | Dark (`.dark`)              |
| ---------------------- | ---------------------------- | --------------------------- |
| `--background`         | `oklch(0.9612 0 0)`          | `oklch(0.145 0 0)`          |
| `--foreground`         | `oklch(0.145 0 0)`           | `oklch(0.985 0 0)`          |
| `--card`               | `oklch(1 0 0)`               | `oklch(0.205 0 0)`          |
| `--popover`            | `oklch(1 0 0)`               | `oklch(0.205 0 0)`          |
| `--primary`            | `oklch(0.205 0 0)`           | `oklch(0.9491 0 0)`         |
| `--primary-foreground` | `oklch(0.985 0 0)`           | `oklch(0.205 0 0)`          |
| `--secondary`          | `oklch(0.97 0 0)`            | `oklch(0.269 0 0)`          |
| `--muted`              | `oklch(0.97 0 0)`            | `oklch(0.4313 0 0)`         |
| `--muted-foreground`   | `oklch(0.5 0 0)`             | `oklch(0.708 0 0)`          |
| `--accent`             | `oklch(0.97 0 0)`            | `oklch(0.269 0 0)`          |
| `--accent-foreground`  | `oklch(48.49% 0.291 264.12)` | `oklch(0.985 0 0)`          |
| `--destructive`        | `oklch(0.577 0.245 27.325)`  | `oklch(0.704 0.191 22.216)` |
| `--border`             | `oklch(0.75 0 0)`            | `oklch(1 0 0 / 10%)`        |
| `--input`              | `oklch(0.922 0 0)`           | `oklch(1 0 0 / 15%)`        |
| `--ring`               | `oklch(0.708 0 0)`           | `oklch(0.556 0 0)`          |

Two things that table makes visible and prose hides:

- **`--accent-foreground` is the only hue in the system, and it exists only on the
  light routes.** In `.dark` it is chroma 0. Anything relying on it reading as blue
  works on `/products` and `/size-guide` and nowhere else. `CONTROL_FOCUS` uses it
  deliberately, because `--ring` at `/50` is near-invisible on the light paper.
- **`--muted-foreground` light is `oklch(0.5)`, not shadcn's `oklch(0.556)`.** It
  was darkened because `0.556` (`#7e7e7e`) is 3.63:1 on `oklch(0.9612)` paper and
  fails AA; `0.5` (`#6b6b6b`) is ~4.8:1. Do not restore the upstream value.

**Author-controlled colour** comes from Sanity `settingsBrandColors`, referenced by
home, event category, event status and blog category. Applied as inline `rgba()`
via `buildRgbaCssString()` and always passed through `ensureAccessibleTextColor()`
(`src/lib/image-utils.ts`), the WCAG AA 4.5:1 guard. Use these for brand, status
and category accents only — never as global role tokens.

Rule of thumb: keep chrome monochrome, and let colour mean something — a status, a
category, one accent.

## Typography

Two faces, loaded via `next/font/local` in `src/components/layout/HtmlShell.tsx`
(files in `src/app/fonts/`), both shipping **weight 400 only** — so every rung's
`font-weight: 500` is browser-synthesized.

- **ABC Display** → `--font-default`. Display and body; the default for everything.
- **Basel Typewriter** → `--font-feature`. Exactly **one** consumer in the whole
  stylesheet: `.t-spec`.

Neither is a Tailwind theme key. There is no `font-default` or `font-feature`
utility class — the faces reach text through `html { font-family: var(--font-default) }`
and through each `t-*` rule restating `font-family` itself.

| Rung     | Face        | Weight | Size                                                            | Leading | Tracking | Role                      |
| -------- | ----------- | ------ | --------------------------------------------------------------- | ------- | -------- | ------------------------- |
| `t-h-1`  | default     | 500    | `--t-size-h1` `clamp(1.5rem, 1.4142rem + 0.3722vw, 1.75rem)`    | 1.1     | −0.04em  | page heading (24→28)      |
| `t-h-2`  | default     | 500    | `--t-size-h2` `clamp(1.375rem, 1.3321rem + 0.1861vw, 1.5rem)`   | 1.15    | −0.02em  | section heading (22→24)   |
| `t-h-3`  | default     | 500    | `--t-size-h3` `clamp(1.125rem, 1.0821rem + 0.1861vw, 1.25rem)`  | 1.2     | −0.02em  | card title (18→20)        |
| `t-l-0`  | default     | 500    | `clamp(1rem, 0.9786rem + 0.093vw, 1.0625rem)`                   | 1.2     | −0.02em  | prominent label (16→17)   |
| `t-b-1`  | default     | 400    | `--t-size-b1` `clamp(0.875rem, 0.8536rem + 0.093vw, 0.9375rem)` | 1.5     | −0.02em  | body (14→15)              |
| `t-b-2`  | default     | 400    | `clamp(0.75rem, 0.7286rem + 0.093vw, 0.8125rem)`                | 1.5     | −0.02em  | small body (12→13)        |
| `t-l-1`  | default     | 500    | `clamp(0.75rem, 0.7286rem + 0.093vw, 0.8125rem)`                | 1.25    | −0.04em  | label (12→13)             |
| `t-l-2`  | default     | 500    | `clamp(0.6875rem, 0.6661rem + 0.093vw, 0.75rem)`                | 1.3     | −0.04em  | small label (11→12)       |
| `t-spec` | **feature** | 500    | `clamp(0.6875rem, 0.6661rem + 0.093vw, 0.75rem)`                | 1.25    | −0.04em  | the counter-voice (11→12) |

`.wysiwyg` prose (Portable Text) runs a parallel ladder off the same `--t-size-*`
vars, plus two clamps with no `t-*` twin: `h4` at 16→17 and `h5`/`h6` at 15→16.
Its block rhythm is 20px between blocks, 36px above a heading that is not first.

**No rung declares `text-transform`.** The uppercase that reads as the house voice
is applied at call sites (`t-l-2 uppercase`, `t-h-2 uppercase`). `t-spec` is a
_face_, not a casing.

`t-l-1` and `t-b-2` share a size ramp and differ only in weight, leading and
tracking; `t-spec` and `t-l-2` share a ramp and differ in face and leading. That is
deliberate — they are different roles at the same size.

**Never write a raw `text-[13px]`, or reach for `text-sm`, for content type — pick a rung.** Four things the rules above will not tell you:

- **Every rung clamps across the same viewport window** (369px→1444px, flat outside it) so the whole ladder starts and stops moving together and no two rungs cross. Headings travel 2px (h1 4px), everything below 1px, on a 0.093vw-per-pixel slope — which is why the intercepts carry four decimals, since at three the rounding moved each rung's window by up to 10px. Retune in the `:root` block, never in a `t-*` rule.
- **A size gets a `--t-size-*` var only when two rules render the same role** — a token and its `.wysiwyg` prose twin. Roles rendered once keep their clamp inline. `.t-l-2` and `.t-spec` sit on the same rung, and `.t-l-0` and `.wysiwyg h4` land on the same 16→17px, yet each keeps its own declaration on purpose: pairing two roles that merely share a number today means a prose retune silently moves an event date.
- **These rules live in `@layer components`, so any Tailwind text utility beats them in the cascade** — that is the escape hatch for a deliberate local override. Font-size is the exception: `cn()` registers the nine class names with tailwind-merge as a **one-way** conflict against the `font-size` group (`TYPE_SCALE_CLASSES` in `src/lib/utils.ts`), so a `t-*` deletes an earlier `text-sm` — `<Button>`'s cva base, which used to kill a `t-l-2` silently and had four call sites restating the size to force it back — while an explicit `text-*` _after_ a token still wins. A new rung must be added to that list too; `src/lib/type-scale.test.ts` fails when it and `globals.css` disagree. Two limits: the rungs are plain classes in `@layer components`, not `@utility`, so **a variant like `lg:t-l-1` emits no CSS at all** — switch rungs with a ternary or a wrapper; and tailwind-merge only resolves within a modifier scope, so a token beside a responsive pair such as `<Input>`'s `text-base md:text-sm` keeps the `md:` half. Declaring the nine as `@utility` instead would retire the first limit and make tokens win the cascade outright — the known follow-up. It does **not** retire the merge registration, which is what keeps a deliberate later `text-*` able to override; and check what a `t-*` inside `.wysiwyg` prose would then outrank first. Renaming them onto Tailwind's `--text-*` namespace is _not_ the answer: `text-l2` is not a t-shirt size, so tailwind-merge files it under text-**colour**, which would delete the rung at the 112 call sites that pair one with `text-foreground/*`.
- **Line-height is a role, not a constant** — 1.5 on anything that wraps, 1.2–1.3 on labels, 1.1–1.2 on headings. It was `1` on all nine rungs until twelve call sites had independently patched it at five different values. Before adding a `leading-*`, check the rung is wrong rather than the call site special; `ProductCard`'s clamped **excerpt** is the only survivor that legitimately is (its leading sets a grid card's reserved height, not readability — the title carries none), and Header/ToolBar's `[&_a]:leading-header` is chrome-height centring rather than type.

## Spacing, layout, radius

**Containers**: Tailwind's `--container-*` scale is left at STOCK, and that is
load-bearing. It used to be rescaled in `@theme inline` (`md` 900px instead of
448, `lg` 1024 instead of 512, `3xl` 1800 instead of 768) to act as the site's
layout ladder — but Tailwind v4 resolves `w-*`, `min-w-*`, `max-w-*`, `basis-*`
and `columns-*` from that one namespace, so every named width in the repo meant
something other than its name: a shadcn `sm:max-w-lg` dialog rendered at 1024px,
a `max-w-md` prose column at 900px, and three files had grown hand-written
workarounds saying so. The section ladder had it worse — `m` and `s` came out
wider than `l` and `xl`. The site's own ceiling is **`--s-container-max`**
(2000px), outside that namespace; anything wanting a particular width states it
(`max-w-[900px]`) rather than borrowing a Tailwind name. Only `3xs` and `2xs` are
still overridden, to `initial`, so there is no rung below `xs`.

**Gutter and rhythm:** `--spacing-contain: max(3vw, 15px)`;
`--spacing-section: 80px`, 96px at `lg`. Header height is 42px, 52px at `lg`.

**Width and padding helpers** clamp content to the site's ceiling:
`--width-max: min(100vw - 2 * gutter, --s-container-max)` and
`--padding-max: (100vw - --width-max) / 2`. **One rung, not seven** — the
`--width-<step>` twins existed only to feed `p-x-sm`…`p-x-3xl`, all six
of which had reached zero call sites, and they were the only reason the container
scale above had to be rescaled at all; utilities and tokens went together.
`p-x-max` applies the padding form as `padding-inline` and `m-x-max` as
`margin-inline`; `--width-max` is also read directly (`w-(--width-max)` in
`WeatherWidget`). `SECTION_INSET` (`src/lib/utils.ts`) is `p-x-max`, the site's
standard inset **for a page root** — a full-width box centring its content on
`--s-container-max`. A `<SectionShell>` does not use it; a section's inset is the
`--section-inset` property instead, because the length depends on whether the
editor capped the section. See §Sections.

**Header-space utilities** — `pt-header-space-*`, `mt-header-space-*`,
`top-header-space-*`, `min-h-main-*` — all resolve through `--height-header` and
`--height-announcement`. Use these rather than hard-coding the header offset;
`<main>`'s own top padding is an unlayered rule in `globals.css` and a
`[data-hero-underlay]` hero cancels it via `body:has()`.

**Radius:** components clamp against `--radius-md` at two authored ceilings —
`rounded-[min(var(--radius-md),10px)]` for `xs` / `icon-xs` / small selects, and
`rounded-[min(var(--radius-md),12px)]` for `sm` / `icon-sm`. **Neither ceiling
actually binds today** — see the note under _Known dead or broken_ before changing
anything here. Prefer squared tokens over full pills.

**Z-index is a ladder, and every rung is in use.** Never write a raw `z-50`:

`z-header` 90 → `z-g-toolbar` 98 → `z-popover` 99 → `z-overlay` 100 →
`z-dialog` 101 → `z-tooltip` 102.

Tooltip sits top because it has to clear the dialog it was opened from. Note that
`position: sticky` always creates a stacking context, which is why
`WeatherWidgetRail` carries `z-g-toolbar` explicitly — without it the widget's own
z-index is trapped below the events month bar's `z-10`.

## Sections

Every page module renders through `<SectionShell>` (`src/components/SectionShell.tsx`),
the one place a Sanity `sectionAppearance` object becomes classes and styles. Three
things there are load-bearing and look like tidy-ups waiting to happen:

- **The authored colours are applied as _token_ overrides, not just `color`/`background-color`.** `globals.css` declares its palette under `@theme inline`, so `text-foreground` compiles to `color: var(--foreground)`, `text-foreground/60` to a `color-mix()` over that same var, and `bg-background` to `background-color: var(--background)` — each read at the element carrying the class. A utility on a descendant therefore always beats a `color` inherited from the section, which is why setting a text colour left `<ProductCard>`'s own `text-foreground` lines untouched and its `bg-background` image frame black. The shell redefines `--foreground`/`--background` (plus `--primary`, `--primary-foreground` and `--accent-foreground`, which in this palette are the same ink one step over — left themed, a `<Badge>` rendered near-white on near-white inside a white section). `--muted`, `--border` and `--ring` stay themed: they are surfaces and edges, not ink. Only what the editor actually set is remapped, so an uncoloured section is unchanged.
- **Spacing is four CSS custom properties plus the `section-spacing` utility, never generated class names.** Tailwind only emits utilities whose names appear literally in the source, so an interpolated `mt-${n}` never exists — the `SPACING_CLASSES` map this replaced was a stub containing four entries, and all thirty spacing options silently resolved to `null`. The shell writes `--section-pt`/`--section-pb`/`--section-pt-sm`/`--section-pb-sm` as lengths (`value * 0.25rem`, the Tailwind scale step) and the utility reads them, which is also what makes the `sm:` breakpoint reachable from an inline style. Always padding, never margin: a section painting a background needs the space inside its own box.
- **The horizontal inset is one published custom property, `--section-inset`, not a class.** The shell reads `isFullWidth` off the resolver and writes the property inline on every `<section>`: the centring `var(--padding-max)` — `(100vw − min(100vw − 2×--s-contain, --s-container-max)) / 2` — when the section spans its container, and the flat gutter `var(--s-contain)` when the editor capped it. The centring form belongs only on a full-width box: a capped section is already centred by its own `max-w-*` + `mx-auto`, so the two compound, and at 2560px a 320px section ends up 280px of padding a side around nothing. Below the container ceiling the two lengths are identical, which is why this only shows on very wide viewports. **A property rather than a class because three elements have to agree and only one is the shell's own markup** — a `bleed` section puts no inset on itself, so `EventsCarousel`'s track and nav row carry theirs, and a child cannot read a class on its ancestor. All three resolve `--section-inset`, through two utilities declared in `globals.css` — `p-x-section` (exported as `SECTION_CONTENT_INSET`, on the `<section>`, its bleed heading row and the carousel's nav row) and `p-l-section` (`SECTION_INSET_START`, the leading edge of the carousel track), both falling back to `--padding-max` for a consumer rendered outside a shell. Named utilities rather than `px-[var(--section-inset)]` at each call site, because Tailwind only emits an arbitrary value whose exact class name appears as a literal in the source — one composed from a shared const emits nothing and the inset collapses to zero. The carousel pair used to name `--padding-max` outright and silently stopped agreeing with the heading the moment an editor capped a `bleed` module. Never hand-write an inset onto a section, and never pair `p-x-max` with a `max-w-*` anywhere else. The max-width ladder itself is arbitrary values (`max-w-[768px]`) rather than named rungs — originally because the `--container-*` override made `max-w-3xl` mean 1800px, and still, now that the override is gone, because the ladder has to agree with `MAX_WIDTH_PX` (which sizes images inside a narrowed section) and no Tailwind rung sits at all five of those widths. The class/px agreement is a TYPE constraint rather than a test; `section-appearance.test.ts` covers only what the type cannot say, that the ladder ascends.

The heading renders as `t-h-2 uppercase`, deliberately not `t-h-3`: `t-h-3` is the
card-title rung, so a section heading in it was the exact size of the cards it
governed and the section read as one flat band.

## Components

**Base UI (`@base-ui/react`) is the primitive layer** under everything in
`src/components/ui/` and under `Popover`. The files are shadcn's Base UI
generation (`components.json` style `base-nova`) carrying this repo's own class
strings, with `cva` variants, `cn()`, and `data-slot` / `data-*` styling hooks.
Imports are per component (`@base-ui/react/dialog`), so there is no barrel for
`optimizePackageImports` to split.

Four things differ from the Radix this replaced, and all four fail silently:

- **`render` replaces `asChild`.** `<Dialog.Close render={<ChromeButton … />}>label</Dialog.Close>`: the component's children become the rendered element's children and the props are merged. `Button` is the exception — a link that should look like a button gets `buttonVariants()` on the anchor (through `cn()` so the caller's overrides still win) and never `<Button render={<a />}>`, which puts `role="button"` on the link; shadcn's Base UI docs say the same. `MobileMenu`'s CTA and `AdaSkip` are the references.
- **State is a bare attribute, never `data-state`.** Popups carry `data-open`/`data-closed` (plus `data-starting-style`/`data-ending-style` for CSS transitions), checkboxes and radios `data-checked`, tabs `data-active`, accordion triggers `data-panel-open`, select items `data-highlighted`. The `--radix-*` variables became `--transform-origin`, `--available-height`, `--anchor-width` and `--accordion-panel-height`. Checkbox and radio render a `<span>` beside a hidden `<input>`, which is where a passed `id` lands — so `<Label htmlFor>` keeps working — and why their disabled styling is `data-disabled:`, not `disabled:`.
- **Popups have a `Positioner`, and that is where the `z-index` goes.** It is the positioned element; a `z-*` on the `Popup` inside it takes no part in stacking. `Popover` sits at `z-popover` and `Tooltip` at `z-tooltip`, the top rung of the ladder in `globals.css` (a tooltip has to clear the dialog it was opened from). `Select` is the one off-ladder popup, at `z-50`, carried over unchanged from the Radix version.
- **The Motion-driven overlays follow Base UI's animation handbook.** `MobileMenu` and `CartDrawerPanel` gate `<Dialog.Portal keepMounted>` behind the controlled `open` inside `<AnimatePresence>` and compose `Popup`/`Backdrop` with `motion.div` through `render`; Base UI sees Motion's opacity animation via `getAnimations()` and waits for it before unmounting. Both pass `modal="trap-focus"`, which still traps focus and hides the page from assistive tech but leaves Base UI's own scroll lock off: `useScrollLock` owns the lock (see Hooks), and two locks writing the same `<html>`/`<body>` inline styles would race.

**`<Button>`** — six variants (`default`, `outline`, `secondary`, `ghost`,
`destructive`, `link`) and nine sizes (`xs`, `sm`, `default` h-9, `lg`, `xl`, plus
`icon`, `icon-xs`, `icon-sm`, `icon-lg`). Its base carries
`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]`, so anything
rendered as a `<Button>` is already transitioned and needs nothing local; 300ms
rather than Tailwind's 150ms because that curve front-loads its change and the same
span covers the focus ring growing in. `xl` is the one size that carries a type
rung (`t-b-1`). The `link` variant is underlined **at rest** with only the
decoration colour moving — see the `text-decoration-line` trap below.

**Form controls** are less uniform than they look, and the differences are real, not
drift to be tidied:

- **Ring width has two spellings**: `focus-visible:ring-3` on Input / Textarea /
  SelectTrigger / Button, `focus-visible:ring-[3px]` on Checkbox / RadioGroupItem.
  Same computed value; tailwind-merge treats them as different keys, so they do not
  cancel each other.
- **Radius differs per control**: Input `rounded`, Textarea and SelectTrigger
  `rounded-lg`, Checkbox `rounded-[4px]`, Radio `rounded-full`.
- **Disabled has two spellings for one reason**: Input / Textarea / Select use
  `disabled:`, Checkbox and Radio use `data-disabled:`, because Base UI renders a
  `<span role="checkbox">` beside a hidden `<input>` and the class lands on the span.
- **Invalid is uniform**: `aria-invalid:border-destructive` +
  `aria-invalid:ring-destructive/20` + `dark:aria-invalid:ring-destructive/40` +
  `aria-invalid:ring-3`.

**Focus is a family of four, and picking the wrong one is visible.** The three
constants live in `src/lib/utils.ts`; each is ring utilities **only**, so the
consumer declares its own `transition-*`:

| Constant              | For                                                         | Why not the others                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OVERLAY_LINK_FOCUS`  | an absolutely-positioned overlay link (stretched row, pill) | `ring-inset`, so the ring draws inside its container instead of being clipped                                                                                                                                              |
| `INLINE_LINK_FOCUS`   | a link in normal flow                                       | an inset ring on an 11px inline box draws over the glyphs and fragments across line boxes when the text wraps                                                                                                              |
| `CONTROL_FOCUS`       | a button, chip, select trigger, checkbox                    | `--ring` at `/50` is near-invisible on the light routes' paper, so this uses accent ink at 2px; each site restates the width because the primitives ship `ring-3` and tailwind-merge cannot reconcile the two in one scope |
| `state-focus-visible` | the `@utility` in `globals.css`                             | a dashed outline, not a ring — a separate idiom; do not mix it into a ring                                                                                                                                                 |

**Disabled is two-tier.** `globals.css` applies `state-disabled`
(`cursor: not-allowed; opacity: 0.3`) globally to `[disabled]` and
`[aria-disabled='true']`, while every `ui/` primitive additionally ships its own
`disabled:opacity-50` / `data-disabled:opacity-50`. Expect 0.3 on plain elements and
0.5 on primitives; do not "fix" one to match the other without checking both.

## Interaction states

**Interaction states are transitioned too, and the transition has to name the property that actually changes.** Anything that alters appearance on `hover:`, `focus-visible:`, `active:`, `group-hover:`, `data-[state=…]` or `aria-*` carries a transition on the element that changes — an instant state change next to the site's eased ones reads as a bug. Timing is descriptive, not invented: a bare `transition-colors` (Tailwind's 150ms) is the prevailing choice for colour, transforms run longer (`duration-300`–`700 ease-out`), and `<Button>` carries its own tuned `duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]` in its base, reasoned in a comment there — anything rendered as a `<Button>` is already transitioned and needs nothing local.

**Which treatment** is a settled vocabulary, not a per-call-site choice. Pick exactly one per element — stacking them reads as two separate things happening — and give something non-interactive no hover at all, since a state change with nothing behind it is a false affordance:

- **Default: `hover:opacity-60`.** Anything interactive that is not one of the two cases below.
- **A link whose text IS the content** — a venue name, a title — changes ink instead: `hover:text-foreground/60`. Dimming the whole element would also dim any icon beside it. `EventsBlock`'s venue line is the reference.
- **A link that ends in an arrow** nudges the arrow instead: `transition-transform duration-300 ease-out group-hover/<name>:translate-x-0.5`. `ProductCard` and `EventStatusPill` are the references. No shared constant is possible here — the group name has to appear literally for Tailwind to emit the rule — so this recipe is the reuse mechanism.
- **A cell or a row — a clickable box rather than a piece of text — takes a background tint: `transition-colors hover:bg-foreground/5`.** `EventsCalendar`'s day cells (`cellClass`) and its `DayEventRow`s are the references, and they deliberately share the same 5%: a row and the day cell that opens it must answer the pointer the same way. Dimming one of these with the `hover:opacity-60` default fades its status pills too, which reads as the row going inactive rather than as a target under the cursor. Gate it on the row actually being a link — `DayEventRow` keys it off `href`, since a row with no slug has nothing to open — and note that an ended row needs no second condition, because its `pointer-events-none` already stops the hover firing.

Four traps, each of which has actually bitten:

- **`transition-colors` covers `color`, `background-color`, `border-color`, `outline-color`, `text-decoration-color`, `fill` and `stroke` — and nothing else.** Not `opacity`, not `transform`, and not `box-shadow`, which is what every Tailwind `ring-*` utility compiles to. So `transition-colors` beside a `focus-visible:ring-2` fades the border while the ring snaps in next to it, and beside a `hover:opacity-60` does nothing at all. Spell out what moves: `transition-[color,box-shadow]` (`ui/RadioGroup.tsx` is the reference), `transition-opacity`, `transition-transform`.
- **One transition utility per element.** Two of them fight exactly the way `reveal` and `transition-colors` do below. This is also why a shared class constant must never contain a `transition-*`: `OVERLAY_LINK_FOCUS` and `INLINE_LINK_FOCUS` (`src/lib/utils.ts`) deliberately carry only the ring, because the consumer declares its own transition covering the ring _and_ whatever else it animates.
- **`text-decoration-line` is not animatable** — the browser creates no transition for it, so `hover:underline` snaps no matter what you add beside it. Underline the element permanently and animate the decoration _colour_ instead: `underline decoration-foreground/30 hover:decoration-foreground`, the pattern in `SizeChartDialog.tsx` and `PageEventsCrew.tsx`. Use `decoration-foreground/*` rather than a literal colour so the underline follows `SectionShell`'s authored section ink.
- **Never put a `transition-*` or `duration-*` utility on an element that also carries `reveal`.** `@utility reveal` sets the `transition` _shorthand_ for opacity and compiles into `@layer utilities`, so a Tailwind transition utility at equal specificity rewrites `transition-property` and leaves `@starting-style { opacity: 0 }` with nothing to run — the entrance dies silently, with no error and no visual clue beyond content appearing instantly. Put the state change on a child instead. `.animate-page-in` is _not_ exposed to this: `@layer components` closes partway through `globals.css` and that rule is unlayered, so it outranks the utilities layer. `cn()` will not save you either — `reveal` is not a registered tailwind-merge class group, so both classes survive and the cascade decides. Watch for elements that are both a `reveal` root and a `group` root — `ProductCard.tsx`'s `<article>` is one — since that is where someone reaches to smooth a card-level hover.

Transforms and movement additionally need a `motion-reduce:` guard; a colour or opacity fade may keep running under reduced motion, a translate or scale may not.

## Motion

**Entrance animations are CSS, not JS.** Page content fades in via the `reveal` utility in `globals.css` — add the class and, optionally, `--reveal-delay` / `--reveal-duration` / `--reveal-ease` through the `style` prop (`REVEAL_SOFT` and `revealStagger(index)` in `src/lib/animate.ts` carry the shared presets). Do **not** reach for a Motion mount animation or a keyframe animation for this: both make invisible the default and need something to execute to undo it, so a page the browser never paints — or one whose JS never hydrates — strands the price and buy button at `opacity: 0`. `reveal` instead leaves the element's own opacity alone and puts the hidden value in `@starting-style`, so it is only ever a transition start point. Read the comment on the utility before adding a delay: the delay window is the one span where content is still hidden, so keep it off anything a shopper must see or click. `.animate-page-in` (the per-navigation fade on `<main>`) works the same way for the same reason.

`REVEAL_SOFT` and `revealStagger(index)` in `src/lib/animate.ts` carry the shared
presets; the stagger **caps at index 6** (0.36s), because `/products/all` renders 24
cards and an uncapped 0.06s step left the last one invisible for 1.38s.

**Library:** Motion (`motion/react`). There is no single house easing — there are
four, each with a job:

| Easing                             | Where                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `cubic-bezier(0, 0.71, 0.2, 1.01)` | the `reveal` utility's default                                                  |
| `cubic-bezier(0, 0.5, 0.5, 1)`     | `REVEAL_SOFT`, the `fade-in` keyframe, `MOBILE_MENU_EASE` as `[0, 0.5, 0.5, 1]` |
| `[0.16, 1, 0.3, 1]`                | `EASE_OUT_EXPO`                                                                 |
| `cubic-bezier(0.22, 1, 0.36, 1)`   | `<Button>`'s base                                                               |

Durations: 0.2–0.3s for overlay enter/exit (`mobileMenuPanel`, `cartPanel`,
`cartOverlay`), 0.5–0.8s for reveals, 150ms (bare `transition-colors`) for colour
state changes. **No bounce, no elastic.**

**Reduced motion is required on every path.** CSS carries three off-switches
(`reveal`, `.animate-page-in`, `.field-hint-ring`); the Motion variants thread a
`reduce` custom prop. Read the preference with `usePrefersReducedMotion`
(`src/hooks/`), **never** Motion's own `useReducedMotion` — that is a one-shot
snapshot and never re-renders when the OS setting is toggled mid-session.

## Anti-patterns

Each of these has actually shipped. They are listed by the **failure they produce**,
not by the rule they break, because the failure is what you can check for.

**Silent — nothing errors, nothing looks obviously wrong:**

- **A `transition-*` or `duration-*` on an element that also carries `reveal`.** The
  entrance dies with no error and no visual clue beyond content appearing instantly.
  `cn()` will not save you; `reveal` is not a registered merge group. Put the state
  change on a child.
- **A responsive type rung — `lg:t-l-1`.** The rungs are plain classes in
  `@layer components`, not `@utility`, so the variant emits **no CSS at all**.
  Switch rungs with a ternary or a wrapper. Declaring the nine as `@utility`
  instead would retire this limit — the known follow-up.
- **An interpolated class name — `mt-${n}`, `text-${size}`.** Tailwind only emits
  utilities whose names appear literally in the source, so the class never exists.
  The `SPACING_CLASSES` map this replaced had four entries and all thirty spacing
  options resolved to `null`. Write a CSS custom property and a utility that reads it.
- **A colour set on a section, expecting descendants to follow.** A utility on a
  descendant beats inherited `color`. Redefine the tokens (see _Theme and surfaces_).
- **A raw `text-sm` or `text-[13px]` for content type.** Picks a size outside the
  ladder that will not move with the rest of it at any viewport.
- **Radix spellings.** `data-[state=active]`, `asChild`, `--radix-*` — all fail
  silently under Base UI. The tab pill renders unfilled on every route at once.

**Visible once you look:**

- **`transition-colors` beside a `focus-visible:ring-*`.** Every Tailwind `ring-*`
  compiles to `box-shadow`, which `transition-colors` does not cover — the border
  fades while the ring snaps in next to it. Spell out what moves:
  `transition-[color,box-shadow]`.
- **`hover:underline`.** `text-decoration-line` is not animatable, so it snaps no
  matter what sits beside it. Underline at rest and animate the decoration _colour_:
  `underline decoration-foreground/30 hover:decoration-foreground`.
- **Two transition utilities on one element.** They fight; the later one wins the
  `transition-property` and the earlier effect dies.
- **Two hover treatments stacked.** Reads as two separate things happening. Pick
  exactly one from the vocabulary above.
- **A hover on something non-interactive.** A state change with nothing behind it is
  a false affordance.
- **Dimming a row or cell with `hover:opacity-60`.** It fades the row's status pills
  too, which reads as the row going inactive rather than as a target under the
  cursor. Rows and cells take `hover:bg-foreground/5`.
- **A `z-*` on a Base UI `Popup`.** The `Positioner` is the positioned element; a
  z-index on the `Popup` takes no part in stacking.
- **A raw `z-50`.** Use the ladder.

**Breaks the page for someone:**

- **A Motion mount animation on above-the-fold content.** Both Motion and keyframe
  entrances make invisible the default and need something to execute to undo it — a
  page the browser never paints, or one whose JS never hydrates, strands the price
  and the buy button at `opacity: 0`. Use `reveal`.
- **A `reveal` delay on something a shopper must see or click.** The delay window is
  the one span where the content is still hidden.
- **A transform or scale with no `motion-reduce:` guard.** A colour or opacity fade
  may keep running under reduced motion; movement may not.
- **`<Button render={<a />}>`.** Puts `role="button"` on the link and hides it from
  screen readers' link lists. `render` is structurally `Omit`ted from the props type,
  so this is a compile error rather than a convention. A link that should look like a
  button gets `buttonVariants()` on the anchor, through `cn()` so caller overrides
  still win — `MobileMenu`'s CTA and `AdaSkip` are the references.
- **Reaching for a dead token.** See below.

## Page archetypes

Which composition a new page takes is decided by its type, not per call site.

| Archetype     | Routes                                           | Composition                                                                           |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Modular page  | `/`, `/[slug]`                                   | Sanity `pageModules`, every one through `<SectionShell>`; slot 0 owns the `<h1>`      |
| Listing       | `/products`, `/products/all`, `/events`          | a grid or list of cards, page-owned heading, own filters/toggle chrome                |
| Detail        | `/products/[slug]`, `/events/[slug]`             | page-owned `<h1>`, one LCP image owned by the page (a module never passes `priority`) |
| Fixed-content | `/faq`, `/size-guide`, `/contact`, `/newsletter` | page component, `.wysiwyg` prose where content is Portable Text                       |
| Locale-less   | `/events-crew`, `/email-signature`               | outside `[locale]`; no `$locale` to resolve against, own layout                       |

`/products` and `/size-guide` and their descendants render **light**; everything
else renders dark. The two locale-less routes are internal tools and are not held to
the bilingual requirement.

## Accessibility and bilingual

- **Target WCAG AA.** Author-chosen Sanity colours pass through
  `ensureAccessibleTextColor()` (`src/lib/image-utils.ts`); the light
  `--muted-foreground` is darkened from upstream for the same reason.
- **Every motion path respects `prefers-reduced-motion`** — three CSS off-switches
  plus the `reduce` prop threaded through the Motion variants.
- **Focus is always visible**, through one of the four idioms above. Never remove an
  outline without replacing it.
- **Full bilingual parity (English / Traditional Chinese) is a first-class
  requirement.** Chinese sets denser and without word spaces: never size a box to an
  English string, and check that a label that fits at `t-l-2` in English still fits.

## Known dead or broken

Eight dead or broken tokens were removed from `globals.css` in the commit that
wrote this section — the zero-consumer `--positive` / `--negative` / `--neutral`
trio, `--radius`, `--shadow-default`, and the two that resolved to invalid CSS
(`--spacing-contain-dynamic`, which read an undefined `--s-max`, and
`--color-subtle` / `--color-placeholder`, which mixed against a non-existent
`--color-gray`). The inert `ThemeHotkey` went with them. None of that is
recoverable from this file — look in git history if you need it.

What remains, and why:

| Token / thing                                              | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--chart-1`…`--chart-5`, `--sidebar*` (8)                  | **Still dead — the sweep above did not reach them.** Verified zero consumers: no `var()` read and no generated utility (`bg-sidebar`, `text-chart-2`, …) anywhere in `src/`. 39 declarations across `@theme inline`, `:root` and `.dark`. They are shadcn boilerplate for a sidebar and a charts layer this site has neither of — and `PRODUCT.md`'s anti-reference rules out the dashboard that would want them. Delete on sight; they are listed here only so nobody mistakes them for a palette. |
| `--h-announcement` / `--height-announcement`               | **Kept deliberately.** Nothing writes `--h-announcement`, so it always falls back to `0px` — but `gAnnouncement` is a fully built Sanity singleton (schema, queries, `siteData`, desk structure) and eleven rules in `globals.css` plus `AdaSkip`, `SizeGuideNav`, `SizeGuideSection` and `useScrollSpy` already read it defensively. This is scaffolding for planned work, not debris.                                                                                                             |
| `public/blackwater_wordmark_RGB_blkwtr_wordmark_white.png` | The only genuinely unreferenced wordmark, and kept as the light-on-dark counterpart of a live asset. Its two siblings **are** live: the black PNG is the fallback logo in the product-submission confirmation email (`src/app/api/product-submission/submit/confirmation-email.ts`) and the white JPG is used by `/email-signature`. Both are built as `${siteUrl}/…` template literals, so a naive grep for an import finds neither — HTML email cannot use the inline `WordmarkSvg`.              |

**The radius clamps are inert, and that is not a bug to fix casually.** Components
write `rounded-[min(var(--radius-md),10px)]` and `…,12px)]`, but nothing in this
repo defines `--radius-md` — it resolves to Tailwind v4's own default of
`0.375rem` (6px), so **both ceilings resolve to 6px and neither ever binds**. The
authored 10px/12px intent is currently unreachable. Defining the shadcn
`--radius-*` derivation would suddenly make both bind and change the radius on
every small control at once, so treat it as a visual change, not a cleanup.

## How this file is kept true

`src/lib/design-doc.test.ts` asserts that every custom property, type rung and file
path named here still exists, and that no Radix spelling has crept back in. It
deliberately checks **names, not values or prose** — renames and deletions are how
this file went stale before.

These tests already enforce parts of the system independently:

- `src/lib/type-scale.test.ts` — the ladder, its shared ramp window, the
  tailwind-merge conflict rules, and that no `t-*` in `src/` is dead.
- `src/lib/image-utils.test.ts` — the AA contrast guard on author-chosen colours.
- `src/lib/section-appearance.test.ts` — the `sectionAppearance` mapping.
- `src/lib/routes.test.ts` — `isLightThemePath`, among others.

When you change a value here, change it in `globals.css` in the same commit. When
you learn a new anti-pattern, add it — that is the part of this file that cannot be
regenerated.
