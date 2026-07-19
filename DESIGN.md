# Design

Visual system for Blackwater RC, captured from the codebase. Regenerate or refine
with `/impeccable document`. Pair with `PRODUCT.md` (strategy, register, voice).

## Theme

The site is **dark by default, site-wide**. The `/products` section is the one
exception: it is forced **light** (`src/components/ThemeProvider.tsx`, next-themes
`forcedTheme`; `attribute="class"` toggles `.dark` on `<html>`). A hidden "d"
keypress toggles the theme only where it is not forced. Design new work for both
themes; both token sets are defined.

## Color

Strategy: **Restrained.** An achromatic (grayscale) OKLCH palette carries almost
everything; color appears only as a small accent and as author-controlled
taxonomy/status swatches. Never `#000` / `#fff`.

Theme tokens (hard-coded in `src/globals.css`, wired to Tailwind via `@theme inline`):

- Surfaces / text: `--background`, `--foreground`, `--card`, `--popover`, `--muted`,
  `--muted-foreground`, `--border`, `--input`, `--ring` — all chroma 0.
- `--primary` / `--primary-foreground` — near-black / near-white; primary actions.
- `--accent-foreground` — the one hue: blue `oklch(48.49% 0.291 264.12)` (light).
- Status: `--positive` (green), `--negative` (red), `--neutral` (blue-gray);
  `--destructive` for errors.

Author-controlled color (Sanity): `settingsBrandColors` swatches referenced by
home, event category, event status, and blog category. Applied as inline
`rgba(...)` via `buildRgbaCssString()` (`src/lib/image-utils.ts`), always passed
through `ensureAccessibleTextColor()` (WCAG AA 4.5:1 guard). Use these for
brand / status / category accents only, not as global role tokens.

Rule of thumb: keep chrome monochrome; let color mean something (a status, a
category, one accent).

## Typography

Two faces, loaded via `next/font/local` in `src/components/layout/HtmlShell.tsx`
(files in `src/app/fonts/`). Both ship weight 400 only.

- **ABC Display** — `--font-default`; display and body. The default for headings
  and text.
- **Basel Typewriter** — `--font-feature`; the **`.t-spec` "spec voice"**: 11px,
  letter-spacing +0.04em, used for prices, index numerals, and uppercase metadata
  labels (prominent throughout `/products`).

Type scale (component classes in `src/globals.css`, tight tracking -0.02/-0.04em):
`.t-h-1` 28px · `.t-h-2` 24px · `.t-h-3` 16px · `.t-b-1` 14px · `.t-b-2` 12px ·
`.t-l-1` 12px · `.t-l-2` 10px · `.t-spec` 11px. Headings request weight 500
(browser-synthesized). Portable Text uses a parallel `.wysiwyg` block.

## Spacing, layout, radius

- Containers (`@theme inline`): xs 300 / sm 600 / md 900 / lg 1024 / xl 1200 /
  2xl 1600 / 3xl 1800 / max 2000px.
- Spacing: `--spacing-contain: max(3vw, 15px)` gutter; `--spacing-section: 80px`
  (96px at `lg`) vertical rhythm; header / footer / toolbar heights as tokens.
- Radius: single `--radius: 0.625rem` (10px). Components use `rounded`; smaller
  controls clamp to `rounded-[min(var(--radius-md),10px)]`. (Prefer squared 10px
  tokens over full pills; see the product-filter token family.)
- Shadow: `--shadow-default: 0px 12px 64px rgba(0,0,0,0.12)`.
- Width / padding helpers (`p-x-sm`…`p-x-max`) clamp content to the container scale.

## Components

shadcn/Radix components in `src/components/ui/` (cva variants, `cn()`,
`data-slot` / `data-*` styling hooks). Conventions:

- Focus: ring-based — `focus-visible:ring-3 focus-visible:ring-ring/50`.
- Invalid: `aria-invalid` → destructive ring.
- Disabled: `state-disabled` (opacity 0.3), applied globally to `[disabled]`.
- **Button**: variants `default / outline / secondary / ghost / destructive / link`;
  sizes `xs / sm / default (h-9) / lg / xl` + `icon*`. `rounded`, `text-sm font-medium`.
- **Input**: `h-10 rounded border bg-transparent`, ring focus, `dark:bg-input/30`.

## Motion

Library: **Motion** (`motion/react`). House easing: **`[0, 0.5, 0.5, 1]`**
(`MOBILE_MENU_EASE` / the `fade-in` keyframe). Durations 0.3–0.6s for fades;
150–250ms for state changes. Presets in `src/lib/animate.ts` (`pageTransitionFade`,
`fadeAnim`, mobile-menu stagger). CSS keyframes in `globals.css`
(`--animate-fade-in`, `--animate-blinker`, `--animate-field-hint`,
`.animate-page-in`). Every motion path has a `prefers-reduced-motion: reduce`
off-switch, required for new motion. No bounce / elastic.
