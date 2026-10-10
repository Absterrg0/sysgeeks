# SysGeeks design system: Graphite & Citron

Status: spec for implementation on `product-overhaul`. Mockup: `docs/plan/design-mockup.html` (open in a browser and use the theme toggle at the top right).

This document is written for implementers who should not have to make taste decisions. Where a value is given, use it exactly. Where something is not covered, copy the nearest specified pattern; don't invent a new one.

---

## 1. Direction

**The marked-up design review.** SysGeeks is where an engineer's reasoning about a system gets reviewed. The interface should look like a design document on warm paper: set in graphite ink, with diagrams drawn on a dot-grid pad, and marked up by a reviewer. There is one bright colour, **citron**, and it works like a highlighter. It marks what is new, selected or most important and nothing else. Everything else is graphite on paper.

Why this direction:

- **Colour carries meaning here, so the chrome has none.** The product lives on three evidence signals (strong / partial / gap), failure events and, soon, AI-generated content. When the chrome is blue (or any hue), those signals compete with it. Graphite chrome leaves them as the only colour on the page apart from the highlighter. Primary buttons are ink, not a brand hue.
- **Citron is the one hue that collides with nothing.** Green, amber and red are taken by the signals. Violet is taken by AI content, a convention users already recognise. Blue is what the owner rejected. Orange and red would be confused with "gap" when a failed component sits next to a highlighted one on the hero map. Citron (a yellow-green highlighter) sits in an unused part of the hue wheel. It is much lighter than every signal mark, so it stays distinct for colour-blind users too (checked with Machado CVD simulation, §2.5). It's also a bold mark for the brand.
- **Warm paper and graphite replace cold navy.** The "drafting table" was cold: navy ink, cyan and blueprint. Warm off-white paper and graphite ink, with a near-black warm dark mode, make it feel like a well-made technical book.
- **A serif for headlines and a grotesk for the tool.** Newsreader headlines give pages the voice of a document: considered and argued. Geist does all the UI work and Geist Mono does labels and numbers. The serif is never used below 1.25rem, so the workspace still reads as a tool.
- **AI content looks like pencil on tracing vellum.** It sits on a faint violet surface with a dashed edge and a label, and it stays provisional until the user accepts it ("inks it in"). Authored content and the user's own accepted work are always in ink on paper. Nothing AI wrote can be mistaken for something a person wrote or checked.

**Kept from the drafting table:** flat surfaces held by hairline rings (no gradients, no glassy cards), the diagram as the hero, ruled index rows, the lesson rail, contrast-checked tokens, signal always carried by a word with the dot repeating it, and transform-only entrance motion.
**Dropped:** navy, cyan, the squared-paper grid (now a dot grid), the Funnel fonts, the Geist Pixel wordmark, and accent-coloured strokes on maps (now ink weight plus a highlighter fill).

---

## 2. Tokens

All colours are defined once using CSS `light-dark()`, with `color-scheme: light dark` on `:root`. Dark mode follows the OS by default. Setting `data-theme="light"` or `data-theme="dark"` on `<html>` forces a mode (the header theme toggle sets it and persists it to `interviewgeek.theme`; a pre-paint script in `app/layout.tsx` applies it before first paint). Browser support for `light-dark()`: Chrome 123+, Safari 17.5+, Firefox 120+.

### 2.1 Colour tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#F7F6F1` | `#131210` | Page background |
| `--raised` | `#FFFFFF` | `#1C1B18` | Cards, inputs, map components |
| `--well` | `#F0EEE7` | `#171614` | Quiet areas, map canvas, footer, code blocks |
| `--sunken` | `#E9E6DD` | `#23211D` | Tracks, segmented-control trough, inline code |
| `--hover` | `#EBE8DF` | `#2A2824` | Row and ghost-button hover |
| `--ink` | `#1A1916` | `#EEEBE3` | Primary text, primary button fill, map strokes |
| `--ink-2` | `#4A463F` | `#B7B2A6` | Secondary text, ledes |
| `--ink-3` | `#686359` | `#958F83` | Tertiary text, metadata, labels |
| `--rule` | `#E0DCD1` | `#2E2B26` | Card rings, dividers |
| `--rule-soft` | `#EAE7DF` | `#252320` | Row dividers inside cards |
| `--rule-strong` | `#C6C0B2` | `#44403A` | Button and input rings, hover rings |
| `--grid-minor` | `#CEC8BA` | `#34312B` | Dot-grid minor dots (every 24px) |
| `--grid-major` | `#B3AC9C` | `#4D4840` | Dot-grid major dots (every 120px) |
| `--accent-solid` | `#D3EE3F` | `#D3EE3F` | Citron: highlighter fills, accent button, lesson marks |
| `--accent` | `#4D5A00` | `#D3EE3F` | Accent *text* (moss in light, citron in dark): hover titles, "your choice" labels |
| `--accent-ink` | `#1A1916` | `#161600` | Text on `--accent-solid` |
| `--accent-soft` | `#EFF6C8` | `#23280F` | Citron wash: `.tint` callouts, selected choices |
| `--highlight` | `#E3F380` | `#3A4416` | Stronger wash: new/selected map parts, `::selection`, link hover |
| `--focus` | `#1A1916` | `#D3EE3F` | Focus outlines |
| `--signal-strong` | `#0B6A4E` | `#4CC9A0` | Strong: text |
| `--signal-strong-soft` | `#E3F1EA` | `#0F2620` | Strong: background |
| `--mark-strong` | `#0E8F6A` | `#22A47E` | Strong: dots, meter fills |
| `--signal-partial` | `#8F4E00` | `#F2B252` | Partial: text |
| `--signal-partial-soft` | `#FAEED8` | `#2B200E` | Partial: background |
| `--mark-partial` | `#D88A00` | `#EFA12A` | Partial: dots, meter fills |
| `--signal-gap` | `#B4233A` | `#FF8086` | Gap / failure / destructive: text |
| `--signal-gap-soft` | `#FAE8E9` | `#331719` | Gap: background |
| `--mark-gap` | `#E04A5A` | `#F4606A` | Gap: dots, meter fills, failed-component stroke |
| `--on-signal` | `#FFFFFF` | `#131210` | Text on a solid `--signal-*` or `--signal-gap` fill |
| `--ai` | `#6A3CC9` | `#C3AFFF` | AI content: label text, AI link text |
| `--ai-soft` | `#F1EDFA` | `#1E1A2C` | AI content: surface ("vellum") |
| `--ai-rule` | `#CBBDEE` | `#4A3E75` | AI content: dashed border, label ring |
| `--mark-ai` | `#8B5CF6` | `#A385FA` | AI: streaming caret, proposed-component stroke, AI dot |

Theme-color meta (in `app/layout.tsx` `viewport.themeColor`): light `#F7F6F1`, dark `#131210`.

Hard-coded colours that must change: `components/icons.tsx` PixelMark (`#0a0a0a` → `#1A1916`, `#00bbff` → `#D3EE3F`), `app/icon.svg` (same swap), `lib/og.tsx` `C` palette (§10, T13). `components/simulations/consistent-hashing.tsx` `NODE_COLORS` is a categorical palette and stays as it is.

### 2.2 Contrast (WCAG 2.x, computed)

These were computed with the WCAG relative-luminance formula (script: `docs/plan/color-check/contrast.mjs`; run `node docs/plan/color-check/contrast.mjs`). All text tokens are at least 4.5:1 on every surface they are allowed on.

**Light**

| Text token | paper | raised | well | sunken | hover |
| --- | --- | --- | --- | --- | --- |
| `--ink` | 16.2 | 17.6 | 15.1 | 14.1 | 14.3 |
| `--ink-2` | 8.7 | 9.4 | 8.1 | 7.5 | 7.7 |
| `--ink-3` | 5.5 | 6.0 | 5.1 | 4.8 | 4.9 |
| `--accent` | 7.0 | 7.6 | 6.5 | 6.1 | 6.2 |
| `--signal-strong` | 6.1 | 6.6 | 5.7 | 5.3 | 5.4 |
| `--signal-partial` | 6.0 | 6.4 | 5.6 | 5.2 | 5.3 |
| `--signal-gap` | 6.0 | 6.5 | 5.6 | 5.2 | 5.3 |
| `--ai` | 6.3 | 6.8 | 5.8 | 5.4 | 5.5 |

Pairs: signal-strong on its soft 5.7 · signal-partial on its soft 5.6 · signal-gap on its soft 5.5 · ai on ai-soft 5.9 · ink on accent-soft 15.6 / highlight 14.6 / ai-soft 15.3 / accent-solid 13.5 · ink-2 on accent-soft 8.3 / ai-soft 8.1 / gap-soft 7.9 / highlight 7.8 · ink-3 on accent-soft 5.3 / ai-soft 5.2 / highlight 4.95 · accent on accent-soft 6.7 · accent-ink on accent-solid 13.5 · paper on ink (primary button) 16.2 · on-signal (#fff) on signal-gap 6.5 · on-signal on signal-strong 6.4.

**Dark**

| Text token | paper | raised | well | sunken | hover |
| --- | --- | --- | --- | --- | --- |
| `--ink` | 15.7 | 14.5 | 15.2 | 13.5 | 12.3 |
| `--ink-2` | 8.9 | 8.1 | 8.6 | 7.6 | 7.0 |
| `--ink-3` | 5.8 | 5.4 | 5.6 | 5.0 | 4.6 |
| `--accent` | 14.3 | 13.2 | 13.8 | 12.3 | 11.3 |
| `--signal-strong` | 9.1 | 8.3 | 8.8 | 7.8 | 7.1 |
| `--signal-partial` | 10.0 | 9.2 | 9.7 | 8.6 | 7.9 |
| `--signal-gap` | 7.7 | 7.1 | 7.5 | 6.6 | 6.1 |
| `--ai` | 9.7 | 8.9 | 9.4 | 8.3 | 7.6 |

Pairs: signal-strong/soft 7.7 · partial/soft 8.6 · gap/soft 6.8 · ai/ai-soft 8.8 · ink on accent-soft 12.8 / highlight 8.7 / ai-soft 14.2 · ink-2 on highlight 4.9 · ink-3 on accent-soft 4.7 · accent-ink on accent-solid 14.0 · paper on ink 15.7 · on-signal (#131210) on signal-gap 7.7.

**Forbidden pairs** (they fail and must never be used):

- `--ink` on `--accent-solid` in dark mode (1.1). Always use `--accent-ink` on citron.
- `--ink-3` on `--highlight` in dark mode (3.2). Use `--ink-2` or `--ink` on highlight fills.
- Any text in `--accent-solid` on light surfaces (1.2). Citron is a fill in light mode, never text or a thin stroke.
- `--mark-*` colours as text. Marks are for fills; text uses `--signal-*`.

**Non-text contrast (WCAG 1.4.11).** Focus ring: 16.2 (light) and 14.3 (dark) against paper. The marks against paper are: strong 3.8 / 5.9, gap 3.7 / 6.0, ai 3.9 / 6.5, partial **2.6** (light) / 8.7 (dark). Light-mode partial falls below 3:1, as it did before. This is accepted because a signal mark is never the only carrier of meaning: every dot sits next to a word or a count (rule kept from the old system, see `SignalBadge` and `SignalMeter`). A darker amber would collapse strong/partial separation for deuteranopes. Hairline rules (`--rule*`) are decorative boundaries, and every interactive control also has a text label.

### 2.3 Colour-vision separation (OKLab ΔE ×100, Machado 2009 full severity)

Light marks (strong / partial / gap / ai / citron): the smallest pair is strong/gap at 8.0 (deuteranopia) and 8.4 (protanopia). Citron is ≥19 from every light signal mark and ≥11 from every dark one, under every simulation. Dark marks: the smallest pair is strong/gap at 7.9 / 8.6. The old system's marks (`#22a55a` / `#e3474c`) scored 2.8 on that pair under deuteranopia. If you change any signal value, re-run `docs/plan/color-check/cvd.mjs` (usage: pass a JSON map of colours, see the file) and keep every pair ≥7.

### 2.4 Rules for using colour

1. Chrome is graphite only: ink, ink-2, ink-3, rules and surfaces.
2. Citron (`--accent-solid`) appears as a **fill** behind ink. A view gets at most one `.btn-accent`. Use it for the page's single most important action (hero CTA, recommended plan, nothing else). Selected and new things get `--highlight` or `--accent-soft` **plus** a non-colour cue (an ink ring, a "New" label or a check).
3. Signal colours only express evidence (strong/partial/gap), event kind (failure = gap, scale change = partial) or destructive actions (gap). Use ink for checkmarks in feature lists, never `--mark-strong`, because green means "your answer was strong".
4. Violet (`--ai*`) only marks AI-generated or AI-assessed content and the streaming state. Buttons that *start* an AI action are ordinary ink buttons with a cost tag. They are not violet.
5. Event kinds: failure → gap; scale change → partial; requirement change → **ink** (it used to be accent).

### 2.5 Type tokens

| Family | CSS var | Source | Weights | Used for |
| --- | --- | --- | --- | --- |
| **Newsreader** (variable, opsz 6–72) | `--font-newsreader` → `--font-display` | `next/font/google`: `Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal", "italic"], axes: ["opsz"] })` | 400–500 (variable) | Hero, h1, h2, big numbers on pricing, pull quotes. Never below 1.25rem. |
| **Geist** (variable) | `--font-geist` → `--font-sans` | `next/font/google`: `Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" })` | 400, 500, 600 | All UI, body and prose, h3 and below |
| **Geist Mono** | `--font-geist-mono` → `--font-mono` | keep the local `assets/fonts/GeistMono-Latin.woff2` (400, 5.5 kB, `preload: false`) | 400 | Labels (uppercase), numbers in chips and credits, code, kind labels on maps |

Remove `Funnel_Display`, `Funnel_Sans` and the Geist Pixel wordmark font from `app/layout.tsx`. Keep the `.woff` files in `assets/fonts/` until T13 swaps the OG fonts, then delete the Funnel and Pixel files.

**Wordmark:** "sysgeeks" in Geist, weight 600, 1.0625rem, letter-spacing −0.02em. "sys" is `--ink` and "geeks" is `--ink-3`. It sits next to the 26px PixelMark recoloured to graphite and citron.

### 2.6 Type scale

These are defined as Tailwind theme tokens, so `text-h1` sets size, line height and tracking together. Existing pages use arbitrary values (`text-[1.5rem]`). Leave those alone unless a task says to change them, and use the tokens in new code.

| Token / utility | Family + weight | Size | Line height | Tracking | Notes |
| --- | --- | --- | --- | --- | --- |
| `text-hero` + `font-display` | Newsreader 400 | `clamp(2.75rem, 1.6rem + 4.2vw, 4.75rem)` | 1.0 | −0.03em | Landing hero only. Italic allowed for one phrase. |
| `text-h1` + `font-display` | Newsreader 450 | `clamp(2.125rem, 1.6rem + 2vw, 3rem)` | 1.06 | −0.025em | Page titles |
| `text-h2` + `font-display` | Newsreader 450 | `clamp(1.5rem, 1.25rem + 0.9vw, 1.875rem)` | 1.15 | −0.015em | Section titles |
| `text-h2-sm` + `font-display` | Newsreader 500 | 1.25rem | 1.25 | −0.01em | Event titles, feedback sections, card titles in the investigation index (1.3125rem allowed) |
| `text-h3` + `font-heading` | Geist 600 | 1.125rem | 1.35 | −0.01em | Sub-sections, panel titles |
| `text-h4` + `font-heading` | Geist 600 | 0.9375rem | 1.4 | −0.005em | Small group titles |
| `text-lede` | Geist 400, `--ink-2` | 1.125rem | 1.6 | 0 | Paragraph under h1 |
| `text-body` | Geist 400 | 1rem | 1.65 | 0 | Prose |
| `text-ui` | Geist 400/500 | 0.875rem | 1.5 | 0 | Default UI text, buttons |
| `text-small` | Geist 400 | 0.8125rem | 1.45 | 0 | Meta, helper text |
| `text-micro` | Geist 400 | 0.75rem | 1.4 | 0 | Chips, captions |
| `text-label` + `.kicker` | Geist Mono 400, uppercase | 0.6875rem | 1 | 0.08em | Kickers, map kind labels, table heads, AI labels |
| `text-code` | Geist Mono 400 | 0.8125rem | 1.6 | 0 | Code blocks, mono textareas |

Numbers: in running UI text use `tabular-nums`. Use mono for credits, timers and counts in chips. Use Newsreader for big display numbers (pricing, stats).

---

## 3. Spacing, radii, borders, shadows, motion, z-index

- **Spacing:** Tailwind's 4px scale. Page rhythm: `.section` has padding-block 2rem (mobile) and 3rem (≥640px). Page header: top padding 3rem (mobile) / 4.5rem (≥640px). Card padding: 1rem (compact), 1.25rem (default), 1.5rem (feature). Gaps between cards: 0.75rem in lists, 1.25rem in grids.
- **Radii:** `4px` chips, tags, labels, kbd, cost tags · `6px` buttons, inputs, segmented items · `8px` tiles, choices, rows · `10px` panels, callouts, AI blocks · `14px` map canvas (`.screen`), dialogs, pricing cards · `9999px` dots and avatars only. The old 7/9/12px values become 6/8/10px.
- **Borders:** always a 1px ring drawn with `box-shadow: 0 0 0 1px` (outside) or `inset 0 0 0 1px` (wells), so nothing shifts layout. Use real `border-*` only for full-width rules (`border-b border-rule`) and left rules on callouts (2px).
- **Shadows:** the only elevation is `--shadow-raised` (popovers, toasts, dialogs, the sticky inspector on scroll). Cards are flat.
- **Motion:**
  - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for everything that enters or responds.
  - `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)` for progress fills.
  - Durations: press 120ms (scale 0.98) · hover and colour 160ms · popover, toast and dialog 220ms · page rise 420ms (6px translate, transform only, no opacity) · meter fill 600ms · skeleton shimmer 1.6s linear infinite · streaming caret blink 1s `steps(2)`.
  - **Reduced motion** (`prefers-reduced-motion: reduce`): keep the existing global clamp of durations to 0.01ms. In addition, `.skeleton` shows a static `--sunken` fill (no shimmer), `.stream-caret` is a static bar, `.led-pulse` does not animate, proposed map components appear without rising, and streamed text is appended per chunk as it arrives. Never use a typewriter per-character animation in either mode: render tokens as they arrive.
- **Z-index:** header 40 · popovers 50 · toasts 60 · dialogs 70 (native `<dialog>` uses the top layer anyway).

---

## 4. Layout

- **Shell:** keep `@utility shell` (max-width 76rem; inline padding 1.25 / 2 / 2.5rem). `.measure` max-width changes from 48rem to **46rem** (Geist sets slightly wider than Funnel Sans).
- **Header** (`components/site-header.tsx`): height 3.5rem, sticky, `.glass` (paper at 92% + blur 12px), `border-b border-rule-soft`.
  - Left: Brand (mark + wordmark).
  - Nav, ≥1024px, left-aligned after the brand with a 2rem gap: **Investigations · Concepts · Practice · Interview** (Companies moves to the footer and to the "read next" links).
  - Right cluster, signed **out**: **Projects** · **Pricing** (nav-links) · `Sign in` (`.btn-ghost .btn-sm`) · `Start free` (`.btn-primary .btn-sm`).
  - Right cluster, signed **in**: **Projects** · **Progress** (nav-links) · credits chip (`.credits`) · avatar button (28px circle, opens a menu: Account, Plan & billing, Export data, Theme, Sign out).
  - Loading auth (Clerk not yet resolved): render the signed-out layout with `Sign in` / `Start free` replaced by a 7rem × 1.875rem `.skeleton` so the width doesn't jump.
  - Mobile (<1024px): brand, credits chip (if signed in), menu knob. The menu sheet lists Learn (4), Yours (Projects, Progress, Interview), then Account or Sign in / Start free buttons at the bottom.
  - Active nav link: ink text, weight 500, and a 2px **ink** underline on the header's bottom edge (unchanged).
  - The stage bar (second row inside investigations) is unchanged structurally: 3rem tall, `border-t border-rule-soft`.
- **Footer** (`components/site-footer.tsx`): `bg-well border-t border-rule`. Grid: brand column + Learn / Yours / Product (Pricing, Examples, About, Interview guide) / Company (Companies, Privacy, Terms, Contact). The brand column text is the one-line description, then this honesty note in `text-micro text-ink-3`: "Lessons, investigations and keys are written and checked by people. Anything an AI wrote or assessed is labelled as such." Bottom row, separated by `border-t border-rule-soft`, holds © year and a theme note. Remove "Free, no accounts, no AI grading" (no longer true).
- **Page header** (`components/page-header.tsx`, `PageHeader`):
  - `.kicker` eyebrow (mono uppercase), `text-h1 font-display` title, `text-lede` paragraph (max 62ch), meta in `text-small text-ink-3`, actions row (gap 0.5rem, margin-top 1.5rem).
  - The header ends with `border-b border-rule` and a padding-bottom of 2.5rem, so a page reads as a document title block followed by its body.
  - The `eyebrow` prop now renders with `.kicker`.
  - `Section` titles use `text-h2 font-display`.
- **Index grids:**
  - Investigations: keep the ruled index. Columns: thumb 8rem, text, meta 11rem. Rows are `border-t border-rule`, padding-block 1.75rem. Hovering a row turns the title to `--accent` and the thumb's dot grid shows.
  - Concepts: two-column ruled lists per domain (unchanged structure).
  - Card grids (example gallery, pricing, companies): `grid gap-5 sm:grid-cols-2 lg:grid-cols-3`.
- **Two-pane tool layout** (project workspace, design round): `grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]`. The right pane is sticky (`top: 5rem`) and scrolls internally (`max-height: calc(100dvh - 6rem)`).

---

## 5. Components

The CSS for everything below is in Appendix A. This section describes behaviour and states.

### 5.1 Buttons (`.btn` + variant + optional size)

| Variant | Rest | Hover | Pressed | Disabled |
| --- | --- | --- | --- | --- |
| `.btn-primary` | ink fill, paper text | fill `color-mix(ink 86%, paper)` | scale .98 | opacity .45, no hover |
| `.btn-accent` | citron fill, accent-ink text, inset 1px ring ink 14% | fill `color-mix(citron 88%, ink)` | scale .98 | opacity .45 |
| `.btn-secondary` | raised fill, ink text, ring rule-strong | fill well | scale .98; `aria-pressed=true` → sunken fill and inset ring | opacity .45 |
| `.btn-ghost` | transparent, ink-2 | hover fill, ink | scale .98 | opacity .45 |
| `.btn-danger` | raised, signal-gap text, ring rule-strong | gap-soft fill | scale .98 | opacity .45 |
| `.btn-danger-solid` | signal-gap fill, on-signal text | `color-mix(gap 88%, ink)` | scale .98 | opacity .45 |

Sizes: `.btn-sm` 1.875rem / 0.8125rem · default 2.25rem / 0.875rem · `.btn-lg` 2.75rem / 0.9375rem. A loading state is `aria-busy="true"`: the label stays and a 12px `.spinner` is prepended. The button keeps its width, ignores pointer events and isn't disabled, so it stays focusable.

**Cost tag:** a button that spends credits shows the cost inside it, after the label: `<span class="cost">3 credits</span>`. The tag is mono 0.6875rem with a 4px radius and a `currentColor` 14% background. The cost is shown *before* the click, every time. Wording is "N credit(s)". Free actions never show a tag.

`.knob` (square icon button) is unchanged apart from radius 6px.

### 5.2 Inputs

`.field`: raised fill, ring rule-strong, radius 6px, padding 0.625rem 0.75rem, `text-ui`.
- Focus: `0 0 0 1px var(--ink), 0 0 0 4px color-mix(in srgb, var(--accent-solid) 45%, transparent)`, an ink ring with a citron halo.
- `aria-invalid="true"`: ring `--mark-gap`, with an error message below in `text-small text-signal-gap`.
- Placeholder: `--ink-3`.
- `.field-mono` for code and READMEs.
- Labels use `.eyebrow` (Geist 500, 0.8125rem, ink-2, margin-bottom 0.375rem). Helper text is `text-small text-ink-3`.
- Character and line counts sit at the bottom right, mono, `text-micro`.
- Textareas autosize to a minimum of 8 rows. The README intake has a minimum of 14 rows and a maximum height of 60vh, then scrolls.

### 5.3 Surfaces

- `.panel`: raised, radius 10px, ring rule.
- `.tile`: raised, radius 8px, ring rule. When it's a link or button, hover changes the ring to rule-strong and press scales to .995.
- `.well` / `.well-sm`: well fill, inset ring rule-soft, radius 10px / 8px.
- `.tint`: accent-soft fill, radius 10px. Use for positive, neutral system notes ("Answer recorded", "Continue where you left off").
- `.screen` (map canvas) and `.dotgrid` (bands): dot grid on well (Appendix A). `.drafting` is renamed to `.dotgrid`.
- `.plate` is removed (unused).

### 5.4 Badges, chips, labels

- `.chip`: raised, ring, 1.375rem high, radius 4px, `text-micro`, ink-2. Use for metadata such as "Updated 3 Oct".
- `.chip-flat`: ink 5% fill, inset ring ink 7%. Use for dimension tags and `SignalBadge`.
- `SignalBadge`: `.chip-flat` + signal text colour + 6px `.led`. Unchanged API.
- `.kicker`: Geist Mono, 0.6875rem, uppercase, tracking 0.08em, ink-3. Use for eyebrows, table heads and map kind labels.
- `.ai-label`: see 5.9.
- `.badge-new`: highlight fill, accent-ink text, `text-label` styling, radius 4px, height 1.125rem. Marks new content and newly added map parts in lists.

### 5.5 Tabs and segmented controls

- **Tabs** (page-level views, e.g. workspace sections, account sub-pages on mobile) use `role="tablist"`.
  - `.tabs` is a flex row with `border-b border-rule` and a 1.5rem gap.
  - `.tab` is `text-ui` weight 500, ink-3, padding-block 0.75rem, with a 2px transparent bottom bar.
  - The selected tab (`aria-selected=true`) is ink with an ink bottom bar.
  - Counts in tabs are mono ink-3: "Questions 12".
  - The project workspace's current segmented "Questions / Architecture model" toggle becomes tabs.
- **Segmented** (`Segmented` in ui.tsx) is for small option toggles only: the trough is sunken with radius 8px, and items have radius 6px. Unchanged otherwise.

### 5.6 Signal meters and dots

- `.led` is a 7px dot. Variants: `.led-strong/-partial/-gap/-idle/-off`, plus a new `.led-ai` (mark-ai). `.led-accent` now fills **ink** (it was cyan), because citron dots disappear on light paper.
- `SignalMeter`: track sunken, height 6px, 2px surface gaps, segment order strong/partial/gap. Unchanged API; it restyles for free.
- The progress line on investigations (`progress.tsx`) marks the current stage with an outline in `--focus`, not citron (see the mapping table).

### 5.7 Callouts and events

`.callout` has a 2px left rule, `padding: 0.25rem 0 0.25rem 1.25rem`, a `.kicker`-styled title in the rule's text colour, and body text in ink-2.
- `.callout-failure` uses rule `--mark-gap` and title `--signal-gap`.
- `.callout-scale` uses rule `--mark-partial` and title `--signal-partial`.
- `.callout-change` uses rule `--ink` and title `--ink`.
- `.callout-note` uses rule `--rule-strong` and title `--ink-3`.
- `.callout-ai` uses a dashed `--ai-rule` rule and title `--ai`.

`EventBanner` maps to these. The event title stays at `text-h2-sm font-display`.

### 5.8 Lessons

Unchanged structure.
- `.lesson-mark`: citron fill and accent-ink numeral.
- `.lesson-mark-done`: `--signal-strong` fill and `--on-signal` text (white on `#0B6A4E` is 6.4:1). The old white-on-mark-strong was 4.1:1 and failed.
- `.lesson-check`: panel, radius 10px.
- Rail: rule-strong.

### 5.9 AI-generated content

These are the governing rules, and they are non-negotiable:

1. Every piece of AI output sits inside an `.ai-block` or carries an `.ai-label`, and both name what the AI did: **AI draft**, **AI review**, **AI-assessed**, **AI suggestion**.
2. Each block has a provenance line saying what the AI read, when, and whether the user has acted on it. For example: "Drafted from your README · 8 Oct, 14:02 · not yet reviewed by you".
3. AI output never uses the authored-content styles: no serif headings and no `.lesson-check` inside an AI block.
4. Once the user accepts AI content, it becomes theirs: normal ink-on-paper styling plus a small provenance chip, "AI-drafted · edited by you". The provenance is never removed silently.
5. AI-assessed grades still use the signal colours for the *signal*. The *basis* is shown by `.ai-label` "AI-assessed" next to the badge, plus a link "Disagree? Mark it yourself" that opens the existing rubric self-assessment. `BASIS_LABEL` gains `"ai-assessed": "assessed by AI against the rubric"`.

**Parts:**

- `.ai-block`: ai-soft fill, radius 10px, `inset 0 0 0 1px var(--ai-rule)` drawn dashed. Because a box-shadow can't be dashed, use `outline: 1px dashed var(--ai-rule); outline-offset: -1px`. Padding is 1rem 1.25rem.
- `.ai-block-head`: a flex row with `.ai-label`, the provenance in `text-small text-ink-3`, and actions on the right (Accept, Edit, Dismiss as `.btn-sm` secondary/ghost).
- `.ai-label`: inline-flex, height 1.25rem, padding 0 0.375rem, radius 4px, ai-soft fill, inset ring ai-rule, mono 0.6875rem uppercase, tracking 0.08em, `--ai` text. It is preceded by the **AiGlyph**: a 10×10 SVG of a dashed square (stroke currentColor 1.2, dash 2 1.5) with a 2.5px filled square in the centre, meaning "provisional". Don't use a sparkle icon.
- Inline AI text inside the user's content, such as a suggested sentence: `.ai-inline` with ai-soft background, a 1px dashed bottom border in mark-ai, and radius 2px.

### 5.10 Streaming and skeleton states

- **Status row**, above streamed content: `.led .led-ai .led-pulse`, the status text in `text-small text-ink-2` ("Reading your README… found 7 components"), elapsed time in mono ink-3, and a `Stop` `.btn-ghost .btn-sm` on the right. Live region: the status row is `role="status" aria-live="polite"`. The streamed body itself is **not** live (screen readers would read every token); announce "Draft ready, 9 components, 11 flows" once on completion.
- **Streamed text**: appended as it arrives inside the `.ai-block`, ending with `.stream-caret` (2px × 1.1em bar, mark-ai, blinking 1s steps(2)). The caret is removed when the stream ends.
- **Streamed structure** (components and flows): each item enters with `.rise` (transform only), and the map adds proposed components as they arrive.
- **Skeleton**: `.skeleton` is a sunken fill, radius 6px, with a shimmer gradient (`--hover` band, 1.6s). Use `.skeleton-text` lines at 0.75em height with widths 100/92/64%. Show a skeleton only when the expected shape is known. Otherwise show the status row.
- **Errors**: a `.callout-failure` with what failed, whether credits were charged ("Not charged" or "Refunded 3 credits"), and a Retry button. A failed AI call that the user didn't receive output from is never charged. Say so.

### 5.11 Paywall and upgrade prompts

- **Inline** (`.paywall`, the default): a panel with the kicker "PRO FEATURE" or "OUT OF CREDITS", an h3 saying what the feature does, one paragraph, and a **cost table** (what the action costs and what the user has). Actions: `See plans` (`.btn-primary`) and `Not now` (`.btn-ghost`). If the user has enough credits: `Use 3 credits` (primary) and `Cancel`.
- **Dialog**: only when the user explicitly triggered a paid action without enough credits. Native `<dialog>`, max-width 28rem, radius 14px, `--shadow-raised`, backdrop `color-mix(in srgb, var(--ink) 35%, transparent)` with blur 2px. Same content as inline. Esc and the backdrop close it.
- **Respect rules:**
  - No countdowns, no fake scarcity, no pre-selected upsells.
  - "Not now" is always visible, not greyed out, and the same size as the main action.
  - Free content is never blurred or teased behind a paywall.
  - Prices always include the billing period and currency.
  - Say plainly what happens at renewal, and link to cancellation in one click from the account page.

### 5.12 Credits indicator

- `.credits` in the header: a button 1.875rem high, padding 0 0.625rem, radius 6px, ring rule-strong, raised fill. Contents: an 18×6 mini-meter (sunken track, ink fill proportional to the balance of the monthly allotment; ink rather than citron so it has contrast), then the mono number, then the word "credits" (hidden <640px).
- At ≤ 10% of allotment, or ≤ 3 credits, the number turns `--signal-partial` and gets an `aria-label` "4 credits left, running low".
- At 0, the label reads "0 credits" with a "Top up" link in the popover.
- Clicking opens a popover (`.stage-popover` pattern, width 18rem): the balance in big Newsreader, the renewal date, a cost list (Draft architecture 3 · Architecture review 5 · AI-assess an answer 1; use real values from the pricing config), a "Buy credits" button, and a "Usage history" link.

### 5.13 Pricing cards

- `.price-card`: raised, radius 14px, ring rule, padding 1.5rem, flex column.
  - Plan name `.kicker`.
  - Price in `font-display` 2.75rem/1 weight 450, with the period in `text-small text-ink-3` ("/ month, billed monthly").
  - Credit allotment line in mono ("120 credits / month").
  - One-line description in ink-2.
  - Divider, then a feature list with 14px **ink** check glyphs (never green). Missing features are not listed: no strikethrough rows.
  - CTA pinned to the bottom.
- `.price-card-featured`: ring 1.5px ink, plus a citron band 1.75rem tall at the top inside the radius, with a `text-label` label in accent-ink such as "RECOMMENDED FOR ACTIVE PREP". Its CTA is the page's single `.btn-accent`.
- Under the grid: a credit-pack row (`.tile`s), then a plain comparison `.data-table`, then the FAQ (details/summary rows with `border-t border-rule`).

### 5.14 Empty states

`.empty`: a `.dotgrid` well with radius 14px, padding 2.5rem, centred. It contains:
- a small SVG of three dashed component boxes joined by a dashed line (ink-3, 120×48),
- an h3,
- one sentence in ink-2,
- one primary action, plus at most one secondary.

Don't use illustrations of people.

### 5.15 Toasts

- **Placement:** bottom-right at 1.25rem (bottom-centre on mobile), stacked with a 0.5rem gap.
- **Style:** `.toast` is raised with `--shadow-raised`, radius 10px, padding 0.75rem 1rem, max-width 24rem, and contains a `.led` + text + optional action link + close knob.
- **Behaviour:** `role="status"`; errors use `role="alert"`. Toasts auto-dismiss after 5s, except errors and anything with an action, which persist. They pause on hover and focus.
- **Motion:** enter with translateY(8px) → 0 over 220ms.

### 5.16 Code blocks and prose

- `.prose`: Geist, 1rem/1.65.
- Bullets: 0.32em squares (radius 1px) in ink-3.
- `ol` markers: mono ink-3.
- `strong`: 600.
- Inline code: sunken fill, inset ring rule-soft, radius 4px.
- `pre`: well fill, ring rule, radius 10px, text-code. An optional `.code-head` bar above it has a mono filename/language in ink-3 and a copy knob, separated by `border-b border-rule-soft`.
- `blockquote`: 2px **ink** left rule, ink-2.
- Tables: the head row uses `.kicker` style.
- `.concept-link`: dotted ink-3 underline. On hover the underline turns solid ink with a `--highlight` background, radius 2px and `box-decoration-break: clone`.
- `.link`: ink text, weight 500, underline in rule-strong with a 3px offset. Hover: underline ink plus highlight background. Links are no longer coloured, because the underline is the cue.

### 5.17 Diagrams (`components/system-map.tsx`, `system-thumb.tsx`)

- **Canvas** (`.screen`): the dot grid. Minor dots are 1px radius every 24px in `--grid-minor`. Major dots are 1.5px every 120px in `--grid-major`. Radius 14px, inset ring rule.
- **Component box:**
  - raised fill, radius 6 (clients 16),
  - stroke `color-mix(in srgb, var(--ink) 55%, transparent)` at 1px,
  - kind label in mono 8px (9 compact) uppercase, letterSpacing 0.8, ink-3,
  - name in Geist 500 12.5px (14 compact), ink,
  - drop-shadow filter opacity 0.06.
- **Highlighted** (new this stage, or selected): fill `--highlight`, stroke `--ink` at 1.5px, and kind label `--ink-2` (because ink-3 fails on highlight in dark mode).
- **Failed:** fill `--signal-gap-soft`, stroke `--mark-gap` at 1.5px, plus a **hatch pattern** overlay (an SVG `<pattern>` 6×6, rotated 45°, a 1px line in `--mark-gap` at 30% opacity). The kind label reads "WORKER · DOWN" in `--signal-gap` (unchanged), with a pulsing gap dot.
- **Proposed by AI** (new prop `proposedComponents?: string[]`, `proposedFlows?: string[]`): fill `--ai-soft`, stroke `--mark-ai` at 1.2px with dash `4 3`, and the kind label prefixed "PROPOSED · " in `--ai`. A proposed flow is drawn with stroke `--mark-ai`, dash `4 3`, and the AI arrow marker.
- **Rejected** (in the review UI only): not drawn.
- **Flows:** at rest ink-3. Active ones are **ink** at 1.6 with an ink arrow (it used to be accent). Number badges at rest are raised with a rule-strong ring and ink-2 numbers. Active badges use a highlight fill with an ink ring and ink numbers.
- **Selected component panel** under the map: `.panel`, unchanged.
- **Thumb** (`system-thumb.tsx`): given parts are filled `--ink` at 0.85. Designed parts are raised with stroke `--ink-3` at 1px and dash `2.5 1.8` (was citron/cyan). Lines are ink-3 at 0.45.
- **Callout leader line:** `--mark-gap` at 1.5px, dash `3 3` (unchanged).

---

## 6. Page notes

### Home / landing (`app/page.tsx`)

The page sells the product honestly: show the real product working, with real counts, and say what is free, what costs credits, and what the AI does.

1. **Hero band** (`.bleed .dotgrid border-b border-rule`):
   - Left column (max 13ch): a `.kicker` "SYSTEM DESIGN INTERVIEW PRACTICE", then an h1 `text-hero font-display`. Suggested copy: "Learn *why* systems are built the way they are." The italic word is Newsreader italic.
   - Right column: a lede (`text-lede`), then the CTAs: `Start the first investigation` (`.btn-accent .btn-lg`, the page's one citron button) and `See pricing` (`.btn-secondary .btn-lg`). Under them, in `text-small text-ink-3`: "Every investigation and concept is free to read. AI features use credits, and anything the AI writes is labelled."
   - Below the columns: the existing mid-failure SystemMap scene (bare, compact) with the gap callout. Keep this; it's the hero.
2. **Facts strip:** three or four mono numbers with labels ("14 systems · 60 concepts · 14 companies · 0 fake testimonials" is too cute, so drop the last). It's a full-width row between `border-y border-rule`. Facts only.
3. **The loop:** Learn → Decide → Break → Change → Defend, drawn as map-style boxes (raised, 1px ink 55% stroke, radius 6) joined by ink-3 arrows, with phase text below. The "Break" box uses the failed style (gap-soft plus hatch) as a quiet visual pun.
4. **Bring your own system (AI):** a two-column section. On the left are the h2 and three numbered steps (Describe or connect a repo → AI drafts your architecture → You correct it, then get reviewed and drilled). On the right is a static composition of the workspace: an `.ai-block` "AI draft" over a small map with two proposed (dashed violet) components and one accepted. It ends with the line "AI drafts and reviews. You decide what's true about your system." and a `Try it with an example` secondary button that goes to the gallery.
5. **Systems to design:** the ruled investigation index (6), unchanged.
6. **Learn by working it out:** the caching lesson demo plus "One idea from each company" (keep).
7. **Example projects:** three gallery cards and a "See all examples" link.
8. **Pricing summary:** Free vs Pro in two compact `.price-card`s, then a link "Full pricing and FAQ". No citron button here (the hero has it).
9. **Footer.**

### Investigations index + overview + stage

- **Index:** a PageHeader with kicker "INVESTIGATIONS", then the ruled index. Each row's thumb sits on a 4:3 `.dotgrid` mini well (radius 8px) on desktop.
- **Investigation overview** (`[investigationId]/page.tsx`): the hero band `.drafting` → `.dotgrid`. The full map is in `.screen`, and the stage outline list is unchanged.
- **Stage page:**
  - Keep `.measure`. The header kicker is "STAGE 3 OF 9 · BREAK", followed by the title `text-h1 font-display`.
  - The EventBanner uses `.callout-*`.
  - The "What you need to know" lesson and "Your turn" stay as h2s.
  - Stage navigation at the bottom: two `.tile` links, not plain text, with a kicker "PREVIOUS" or "NEXT" and the title in `text-h4`.
  - If an answer is AI-assessed, the evidence summary shows `SignalBadge` + `.ai-label` "AI-assessed" + "Disagree? Mark it yourself".

### Concepts (index + detail)

- **Index:** a PageHeader, then domain sections with `text-h2` serif titles and two-column ruled rows (`border-t border-rule`, padding 0.75rem 0) instead of hover-filled rounded rows.
- **Detail:** the lesson leads. Side facts (where it's used, standing) go in a right `.well-sm` aside at ≥1024px.

### Practice

- **Claim check:** each statement is in a `.panel` with the statement in `text-h3` (Geist 600), followed by the Holds / Fails / Depends segmented control. Results use `VerdictBadge`.
- **By dimension:** tabs for the dimensions (`.tabs`), then a ruled list of exercises with `SignalDot`s.

### Interview (setup, session, debrief)

- **Setup:** choices as `.choice` cards.
- **Session:** a sticky top strip below the header with the timer in mono 1.125rem, which turns `--signal-partial` text in the last 2 minutes (no flashing), and the section progress.
- **Debrief:** answers are listed with their evidence. AI-assessed ones are labelled, and there's a summary meter at the top.

### Understanding / progress

- **Top row:** three stat tiles (`.tile`, padding 1.25rem), each with a big Newsreader number at 2.25rem plus a `.kicker` label: answers assessed, due for review, strongest dimension.
- **Insights:** a ruled list with leds.
- **Dimension/concept tables:** `.data-table` with `SignalMeter`s.
- **Basis breakdown line:** "34 checked against the key · 12 self-assessed · 6 AI-assessed".
- **Data controls** (export/import) move to the Account › Data page. Leave a link here.

### Projects: list + example gallery (`/projects`, `/projects/examples`)

- `/projects` uses tabs: **Your projects** | **Examples**.
  - Your projects: cards in a grid. Each card is a `.tile` with a map thumb on a dot-grid header (16:9), the name in `text-h3`, the source chip ("From GitHub" / "From README" / "Described by hand"), a SignalMeter and the updated date.
  - The "New project" card is a dashed-outline tile (`outline: 1px dashed var(--rule-strong)`) with a plus glyph.
  - An empty state uses `.empty`.
- **Examples gallery:**
  - Filter chips (domain: SaaS, Marketplace, Realtime, Data pipeline, Fintech; scale: Startup, Growth, Large) as toggle `.chip` buttons with `aria-pressed`. Pressed = ink fill and paper text.
  - Cards show a thumb, title, a one-line premise, tag chips (stack), and a provenance chip: "Curated" (ink-2) or `.ai-label` "AI-drafted · reviewed by SysGeeks". Use the second only if true.
  - Open example → a read-only workspace with a "Make a copy" primary button.

### Project workspace (`/projects/[id]`)

The flow is **Describe → Draft → Model → Review → Drill**, shown as a stepper (`.stepper`).

- **Stepper:**
  - Five steps in a row with `border-b border-rule`. Each has a 22px circle with a mono number and a `text-small` label.
  - States: done is an ink fill with a paper check. Current is a citron fill with an accent-ink number and an ink label at weight 500. Upcoming is an outline (rule-strong) with an ink-3 label.
  - Steps are links once reachable. Unreachable steps are `aria-disabled` spans.
- **Header:**
  - The kicker shows where the project came from: "PROJECT · FROM GITHUB" (or the README/by-hand equivalent).
  - The name is `text-h1 font-display` (here use `text-[2.25rem]`).
  - Chips: source, updated, and "AI-drafted · edited by you" when that applies.
  - Actions on the right: `Export`, plus a `⋯` menu (Rename, Delete).
- **1 Describe (intake):**
  - A panel with tabs: In your words | Paste README | GitHub repo.
  - The README tab is a mono textarea. The GitHub tab has a URL field and a branch field, plus helper text: "Public repositories only. We read the README, the dependency manifests and the folder layout, not your secrets."
  - Footer row: `text-small` "Drafting uses **3 credits**. You have **42**.", then `Draft the architecture` (`.btn-primary` with cost tag), then a link "or model it by hand (free)".
  - Signed-out users see the same panel, with the button replaced by `Sign in to draft` and the hand-model link still available.
  - Out of credits: inline `.paywall` in place of the footer row.
- **2 Draft (streaming):**
  - Two-pane layout.
  - Left: `.screen` map assembling with proposed (dashed violet) components.
  - Right: an `.ai-block` "AI draft" with a status row (Stop), then a streamed list of components (name, kind, responsibility) and flows, each entering with rise.
  - On completion the status turns into the provenance line, and the primary action becomes "Review the draft →".
- **3 Model (review/edit):**
  - The map shows proposed items dashed and accepted ones solid.
  - The right inspector lists proposed items. Each has `Accept` (secondary sm) and `Reject` (ghost sm), and clicking one selects it on the map.
  - Bulk actions sit at the top of the list: "Accept all 9" (secondary) and "Clear rejected".
  - Selecting a component opens its editable fields (name, kind select, responsibility, durable state), using the existing ModelEditor fields restyled.
  - A counter shows "6 of 9 accepted".
  - Moving on to Review is allowed once at least one component is accepted. Unreviewed proposals are excluded from the review, and the UI says so.
- **4 Review (AI architecture review report):**
  - An `.ai-block` header "AI review", with provenance "Reviewed your accepted model (9 components, 11 flows) · 8 Oct". The summary paragraph is AI text, and it gets a SignalMeter of findings.
  - Findings are grouped under h3s **Gaps**, **Worth checking** and **Holds up** (signal gap/partial/strong). Each finding is a `.panel` row containing: a SignalBadge, the title (`text-h4`), component chips (clicking one highlights it on the sticky map at the right), a paragraph, a "What an interviewer would ask" line in ink-2 italic, and actions `Drill this` and `Dismiss` ("doesn't apply").
  - Dismissed findings collapse into a "Dismissed (2)" disclosure.
  - Disclaimer line under the header: "The review reads your model, not your code. It can be wrong. Dismiss what doesn't apply."
- **5 Drill:**
  - The existing question list, grouped.
  - Questions generated from findings carry an `.ai-label` "AI suggestion". Template questions (from `project-questions.ts`) carry none.
  - The coverage summary uses `.tint`.

### Pricing (`/pricing`, new)

- **PageHeader:** kicker "PRICING", title "Pay for the AI, not the reading.", lede: "Investigations, concepts and practice are free. Credits pay for AI drafting, reviews and assessed answers."
- **Billing toggle:** Segmented Monthly / Yearly. Show the yearly saving as a plain number ("2 months free"); no strike-through prices.
- **Plans:** a 3-card grid (Free, Pro, Pro yearly, or as configured). Featured = Pro.
- **Below:** "What a credit buys" as a `.data-table` (action, credits, roughly how many per month on Pro), then credit packs, then an FAQ covering:
  - What happens when I run out?
  - Do unused credits roll over?
  - Refunds
  - Which AI model, and do you train on my data?
  - How do I cancel?
- The footer note says where payments are processed: "Payments by Dodo Payments. Prices include applicable taxes where shown."

### Account and billing (`/account`, new)

- **Layout:** a left sub-nav (12rem, ruled list) of **Profile · Plan & billing · Credits & usage · Data · Danger zone**, with content on the right. On mobile the sub-nav becomes `.tabs` (horizontally scrollable).
- **Profile:** Clerk `<UserProfile>` themed (§8).
- **Plan & billing:**
  - A current plan `.panel` showing plan name, price and period, the next renewal date, and the payment method's last 4 digits.
  - Actions: `Change plan`, `Manage billing` (opens the Dodo portal) and a plain-text `Cancel subscription` link. The link is visible, not hidden in a menu, and opens a confirm dialog explaining what happens to remaining credits.
  - Invoices table below.
- **Credits & usage:** the balance in big Newsreader, an allotment meter (ink fill on sunken), the renewal date, then a usage ledger as a `.data-table`: Date | Action | Project | Credits (mono, `−3` / `+120`) | Balance. Refunded rows show "Refunded" in ink-3.
- **Data:** export/import (moved from Understanding) and a note about where data lives (local vs account).
- **Danger zone:** delete account (`.btn-danger`, then a dialog with the solid danger button).

### Sign-in

The header states are covered in §4. `/sign-in` and `/sign-up` show a centred Clerk card (max 26rem) on a `.dotgrid` full-bleed background. Above the card is the brand plus one line: "Sign in to save progress across devices and use AI features." Below it: "Everything except AI features works without an account."

---

## 7. Migration mapping

### 7.1 CSS variables (in `app/globals.css`)

| Current | New | Change |
| --- | --- | --- |
| `--paper`, `--raised`, `--well`, `--sunken`, `--hover` | same names | values only (§2.1) |
| `--ink`, `--ink-2`, `--ink-3` | same | values only |
| `--rule`, `--rule-soft`, `--rule-strong` | same | values only |
| `--grid-minor`, `--grid-major` | same | now dot colours; values only |
| `--accent-solid` | same | cyan → citron. **Semantics narrowed: fill only.** See the class table for strokes and outlines that must move to `--focus` or `--ink`. |
| `--accent` | same | text accent: moss (light) / citron (dark) |
| `--accent-ink` | same | text on citron |
| `--accent-soft` | same | citron wash |
| `--signal-*`, `--signal-*-soft`, `--mark-*` | same | values only |
| `--shadow-btn`, `--shadow-card`, `--shadow-raised`, `--shadow-plate` | same | `--shadow-raised` now uses `--shadow-color` |
| `--plate-top`, `--plate-bottom` | same (both `var(--sunken)`) | unchanged |
| `--font-display` | same name | now `var(--font-newsreader), ui-serif, Georgia, serif` |
| `--font-funnel-sans` (via `--font-sans`) | `--font-geist` | rename in layout and `@theme` |
| `--font-funnel-display` | `--font-newsreader` | rename |
| `--font-geist-mono` | same | unchanged |
| `--font-geist-pixel` / `--font-pixel` | **removed** | wordmark is Geist 600 |
| — | `--highlight`, `--focus`, `--on-signal`, `--ai`, `--ai-soft`, `--ai-rule`, `--mark-ai`, `--shadow-color`, `--ease-in-out` | new |
| `@media (prefers-color-scheme: dark)` block | **removed** | replaced by `light-dark()` |

Tailwind colour utilities gain: `bg-highlight`, `text-ai`, `bg-ai-soft`, `border-ai-rule`, `bg-mark-ai`, `outline-focus`, `text-on-signal`. `font-pixel` is removed and `font-heading` is added.

### 7.2 Classes

| Current class | New | Notes |
| --- | --- | --- |
| `.drafting` | `.dotgrid` | rename in `app/page.tsx:48`, `app/investigations/[investigationId]/page.tsx:82` |
| `.screen` | same | dot grid, radius 14px |
| `.plate` | removed | unused |
| `.panel`, `.tile`, `.well`, `.well-sm`, `.tint` | same | radii 10/8/10/8/10 |
| `.btn*`, `.knob`, `.field*`, `.choice`, `.chip*`, `.eyebrow`, `.led*`, `.link`, `.concept-link`, `.prose*`, `.data-table`, `.lesson-*`, `.sim*`, `.takeaways`, `.rise`, `.glass`, `.nav-link`, `.stage-popover`, `.section`, `.bleed`, `.measure` | same names | restyled by Appendix A |
| `.led-accent` | same | now ink fill |
| — | `.kicker`, `.btn-accent`, `.btn-sm`, `.btn-lg`, `.btn-danger-solid`, `.cost`, `.spinner`, `.tabs`, `.tab`, `.callout*`, `.ai-block`, `.ai-block-head`, `.ai-label`, `.ai-inline`, `.led-ai`, `.stream-caret`, `.skeleton`, `.skeleton-text`, `.paywall`, `.price-card`, `.price-card-featured`, `.credits`, `.toast`, `.empty`, `.stepper`, `.step`, `.badge-new`, `.dotgrid`, `.code-head`, `.avatar` | new |
| `font-display` with size ≤ 1.125rem | `font-heading` | **mechanical rule**: in every `className` containing `font-display` and `text-[1rem]`, `text-[1.0625rem]` or `text-[1.125rem]`, replace `font-display` with `font-heading`. Also in `ui.tsx` `SectionHeading`. Sizes ≥ 1.25rem keep `font-display`. |
| `font-pixel` (`components/site-nav.tsx:16`) | `font-heading text-[1.0625rem] tracking-[-0.02em]` | wordmark |

### 7.3 Specific usages that must change (accent used as a stroke, outline or text on light)

| File:line | Current | New |
| --- | --- | --- |
| `components/investigation/progress.tsx:47` | `outline-accent-solid` | `outline-focus` |
| `components/system-thumb.tsx:75` | `stroke="var(--accent-solid)"` | `stroke="var(--ink-3)"` |
| `components/system-map.tsx` (ComponentShape) | highlighted stroke `var(--accent)`, fill `var(--accent-soft)` | stroke `var(--ink)` width 1.5, fill `var(--highlight)` |
| `components/system-map.tsx` (flows, markers, badges) | `var(--accent)` / `var(--accent-soft)` | `var(--ink)` / `var(--highlight)` |
| `components/system-map.tsx` focus | `focus-visible:[&>rect]:stroke-[var(--accent)]` | `stroke-[var(--focus)]` |
| `components/investigation/event-banner.tsx:8-9` | `border-accent-solid`, `text-accent` | use `.callout .callout-change` (ink) |
| `components/interview/interview-setup.tsx:131` | `peer-checked:bg-accent-solid` | `peer-checked:bg-ink` |
| `components/exercise/interactions/decision.tsx:62,124` | `peer-checked:bg-accent-solid peer-checked:text-black`, `bg-accent-solid text-black` | keep `bg-accent-solid`; `text-black` → `text-accent-ink` |
| `components/exercise/interactions/decision.tsx:118` | `shadow-[0_0_0_1.5px_var(--accent-solid)]` | `shadow-[0_0_0_1.5px_var(--ink)]` |
| `components/exercise/slots.tsx:91` | `led led-accent` | unchanged (now ink) |
| `components/simulations/lease-fencing.tsx:87,98` | fill accent-soft, stroke accent | fill `var(--highlight)`, stroke `var(--ink)` |
| `components/ui.tsx:146` (Segmented) | `outline-accent-solid` | `outline-focus` |
| `components/icons.tsx` PixelMark | `#0a0a0a`, `#00bbff` | `#1A1916`, `#D3EE3F`; add an `inset 0 0 0 1px` ring rule in dark via a wrapper class |
| `app/layout.tsx` themeColor | `#fbfcfd`, `#0b1625` | `#F7F6F1`, `#131210` |
| `components/site-footer.tsx` | "Free, no accounts, no AI grading…" | honesty note (§4) |
| `app/page.tsx` | "Nothing is graded by AI." | §6 home copy |

`group-hover:text-accent` (about 20 uses) stays as it is: it now turns moss in light and citron in dark.

---

## 8. Third-party theming

**Clerk** (when added): pass `appearance` to `<ClerkProvider>`:

```ts
appearance={{
  variables: {
    colorPrimary: "#1A1916", colorText: "#1A1916", colorTextSecondary: "#4A463F",
    colorBackground: "#FFFFFF", colorInputBackground: "#FFFFFF", colorInputText: "#1A1916",
    colorDanger: "#B4233A", colorSuccess: "#0B6A4E", colorWarning: "#8F4E00",
    borderRadius: "6px", fontFamily: "var(--font-geist), ui-sans-serif, system-ui",
  },
  elements: { card: "shadow-none ring-1 ring-rule rounded-[14px]", formButtonPrimary: "btn btn-primary" },
}}
```

For dark mode use the dark hex values. If the installed Clerk version accepts `var(--…)` in `variables`, prefer CSS variables so a single object serves both modes.

**Dodo Payments** hosted checkout: set the brand colour to `#1A1916` and the button text to `#FFFFFF`. Don't try to theme it further.

---

## 9. Accessibility checklist (applies to every task)

- Text tokens only on surfaces listed in §2.2. Never use the forbidden pairs.
- Every state carried by colour also has a word, a label or a shape: signals carry words, failed components the "DOWN" label and hatching, proposed components the "PROPOSED" label and a dash, AI content the `.ai-label`, selected things an ink ring.
- `:focus-visible` is a 2px `--focus` outline at offset 2px everywhere. Inputs use the ring described in 5.2.
- Live regions: streaming status is polite, errors are assertive, and the streamed body is not live.
- Hit targets are ≥ 2.25rem for primary controls and ≥ 1.75rem for knobs and chips. Map components are already keyboard-operable.
- Reduced motion behaviour per §3.

---

## 10. Implementation tasks

Each task is sized for one agent. **Run order: T1 alone first (T2 may run alongside T1). Then everything marked "parallel" may run concurrently.** Each task runs `pnpm lint && pnpm typecheck && pnpm test` and must leave them passing. A visual check means: run `pnpm dev`, open the listed routes in light and dark (emulate `prefers-color-scheme` in DevTools), and compare against the mockup.

| # | Task | Files | Depends | Parallel? | Acceptance |
| --- | --- | --- | --- | --- | --- |
| **T1** | Tokens and global CSS | `app/globals.css` (replace with Appendix A) | none | can run with T2 | No `@media (prefers-color-scheme: dark)` block. `grep -i "00bbff\|0b1625" app/globals.css` returns nothing. All classes in §7.2 exist. Build passes. |
| **T2** | Fonts, layout, brand mark | `app/layout.tsx`, `components/site-nav.tsx` (Brand only), `components/icons.tsx` (PixelMark colours), `app/icon.svg`, `app/apple-icon.tsx` | none | with T1 | Newsreader and Geist loaded through `next/font/google` with the variables named in §2.5. Funnel and Pixel imports removed. `font-pixel` is no longer used anywhere. themeColor updated. The favicon is graphite and citron. |
| **T3** | Primitives | `components/ui.tsx`, `components/page-header.tsx`; new `components/ai.tsx` (`AiLabel`, `AiGlyph`, `AiBlock`, `StreamStatus`, `StreamCaret`), new `components/feedback.tsx` (`Skeleton`, `EmptyState`, `Toast` + `useToast` store, `Callout`), new `components/billing-ui.tsx` (`CostTag`, `CreditsChip` (props: balance, allotment, renewsAt), `PaywallPrompt` (props: feature, cost, balance, onUse, onDismiss), `PriceCard`) | T1 | parallel | `BASIS_LABEL` has `ai-assessed` (types permitting; otherwise add it as a separate exported map `AI_BASIS_LABEL`). `SectionHeading` uses `font-heading`. `PageHeader` renders `.kicker` and an ink bottom rule. New components render in a temporary story page `app/_design/page.tsx` (route group excluded from the sitemap, `noindex`), which T3 creates and which also shows every button and state. |
| **T4** | Header, nav, footer | `components/site-header.tsx`, `components/site-nav.tsx`, `components/nav-items.tsx`, `components/site-footer.tsx`, `components/investigation/stage-bar.tsx` | T1, T3 | parallel | Nav order per §4. The right cluster accepts an `account` prop: `{ state: "loading" } \| { state: "signed-out" } \| { state: "signed-in", credits: {balance, allotment, renewsAt}, name, imageUrl? }`. Until Clerk lands, pass `signed-out`. The footer honesty note is present. Mobile menu includes the account section. |
| **T5** | Diagrams | `components/system-map.tsx`, `components/system-thumb.tsx` | T1 | parallel | Highlight, failed (hatch) and proposed states per §5.17. New optional props `proposedComponents`, `proposedFlows`. No `--accent` or `--accent-solid` references remain in either file. The hero map on `/` and a stage reveal map look right in both modes. |
| **T6a** | Sweep: app routes | every `app/**/*.tsx` | T1 | parallel | Apply §7.2 `font-display` → `font-heading` rule, `.drafting` → `.dotgrid`, §7.3 lines in `app/`. `grep -rn "font-pixel\|drafting\|text-black" app` returns nothing. |
| **T6b** | Sweep: components | `components/**/*.tsx` except files owned by T3, T4, T5 | T1 | parallel | Same rules for `components/`. Also §7.3 lines (progress, event-banner → `Callout`, interview-setup, decision, lease-fencing, `.lesson-mark-done` usage). `grep -rn "accent-solid" components` lists only fills (`bg-accent-solid`). |
| **T7** | Home / landing | `app/page.tsx`, `components/continue-strip.tsx`, new `components/home/*.tsx` (loop diagram, AI section composition, facts strip) | T3, T5 | parallel after deps | Sections 1–9 per §6. Exactly one `.btn-accent` on the page. No "Nothing is graded by AI" copy. Lighthouse a11y ≥ 95. |
| **T8** | Pricing page | new `app/pricing/page.tsx`, `lib/pricing.ts` (plan config: id, name, price, currency, period, credits, features[], featured), FAQ component | T3 | parallel | Renders from `lib/pricing.ts` only (no prices hard-coded in JSX). One `.btn-accent`. Checks are ink. Added to the sitemap. Plan CTAs link to `/sign-up?plan=…` placeholders. |
| **T9** | Account and billing shell | new `app/account/layout.tsx`, `app/account/page.tsx` (profile), `app/account/billing/page.tsx`, `app/account/credits/page.tsx`, `app/account/data/page.tsx` (moves `components/understanding/data-controls.tsx` usage here) | T3 | parallel | Sub-nav per §6. Pages render with placeholder data from a typed fixture `lib/account-fixture.ts` until the billing backend lands. The cancel link is visible on the billing page. Pages are `noindex`. |
| **T10** | Projects list and example gallery | `app/projects/page.tsx`, `components/projects/project-list.tsx`, new `app/projects/examples/page.tsx`, new `components/projects/project-card.tsx`, `components/projects/example-card.tsx` | T3, T5 | parallel | Tabs Your projects / Examples. Card anatomy per §6. Empty state uses `EmptyState`. Filter chips are toggle buttons with `aria-pressed`. |
| **T11** | Project workspace shell | `components/projects/project-workspace.tsx`, `components/projects/model-editor.tsx` (restyle only), new `components/projects/workspace-stepper.tsx`, `intake-panel.tsx`, `draft-panel.tsx`, `review-report.tsx`, `inspector.tsx` | T3, T5 | parallel | Stepper and five steps per §6. AI steps are driven by props and fixture data (`lib/fixtures/ai-draft.ts`, `ai-review.ts`). No network calls; the streaming UI is demonstrable with a fake async iterator that respects reduced motion. Segmented toggle replaced by `.tabs`. |
| **T12** | Remaining pages polish | `app/investigations/page.tsx`, `app/investigations/[investigationId]/page.tsx`, `[stageId]/page.tsx` (stage nav tiles, kicker), `app/concepts/page.tsx` (ruled rows), `app/practice/page.tsx`, `components/practice/*`, `components/understanding/understanding-view.tsx` (stat tiles, basis line) | T6a, T6b | parallel | Per the §6 notes. No visual regressions in lesson or exercise flows (click through one stage end to end). |
| **T13** | Social cards and fonts cleanup | `lib/og.tsx`, all `opengraph-image.tsx`, `assets/fonts/` | T2 | parallel | OG palette: paper `#131210`, raised `#1C1B18`, ink `#EEEBE3`, ink2 `#B7B2A6`, ink3 `#958F83`, rule `#2E2B26`, accent `#D3EE3F`, gap `#FF8086`, partial `#F2B252`, strong `#4CC9A0`. Fonts: Newsreader 500 and Geist 400/600 as `.woff` (satori cannot read woff2; obtain them from `@fontsource/newsreader` and `@fontsource/geist-sans` via `npm pack` in /tmp and copy the latin `.woff` files). Funnel and Pixel files deleted. `pnpm build` renders the cards. |
| **T14** | Sign-in states (after Clerk is installed by the auth plan) | `app/layout.tsx` (ClerkProvider appearance §8), `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`, wire `account` prop into `SiteHeader` | auth plan, T4 | after T4 | Header shows the loading skeleton, then the correct state. Sign-in page per §6. |

---

## Appendix A: `app/globals.css` (target)

T1 replaces the file with this. Anything in the current file that isn't listed below keeps its current rules, adjusted only by the radii in §3: `.bleed`, `.measure` (46rem), `.stage-popover`, `.glass`, `.sim*`, `.takeaways`, `.lesson-step/-rail/-dot/-option*/-answer`, `.rise`, `.data-table` structure, `.prose` lists/tables structure.

```css
@import "tailwindcss";

/*
 * Graphite & Citron: a design review on warm paper. Chrome is graphite; colour
 * is reserved for meaning (signals, failure, AI). Citron is a highlighter fill,
 * never text on light paper. Contrast for every text token: docs/plan/design.md §2.2.
 */
:root {
  color-scheme: light dark;

  --paper: light-dark(#f7f6f1, #131210);
  --raised: light-dark(#ffffff, #1c1b18);
  --well: light-dark(#f0eee7, #171614);
  --sunken: light-dark(#e9e6dd, #23211d);
  --hover: light-dark(#ebe8df, #2a2824);

  --ink: light-dark(#1a1916, #eeebe3);
  --ink-2: light-dark(#4a463f, #b7b2a6);
  /* 4.5:1 or better on every surface in both modes. */
  --ink-3: light-dark(#686359, #958f83);

  --rule: light-dark(#e0dcd1, #2e2b26);
  --rule-soft: light-dark(#eae7df, #252320);
  --rule-strong: light-dark(#c6c0b2, #44403a);

  /* Dot grid behind diagrams: a dot every 24px, a heavier one every 120px. */
  --grid-minor: light-dark(#cec8ba, #34312b);
  --grid-major: light-dark(#b3ac9c, #4d4840);

  /* Citron: a fill. Never text or thin strokes on light surfaces. */
  --accent-solid: #d3ee3f;
  --accent: light-dark(#4d5a00, #d3ee3f);
  --accent-ink: light-dark(#1a1916, #161600);
  --accent-soft: light-dark(#eff6c8, #23280f);
  --highlight: light-dark(#e3f380, #3a4416);
  --focus: light-dark(#1a1916, #d3ee3f);

  --signal-strong: light-dark(#0b6a4e, #4cc9a0);
  --signal-strong-soft: light-dark(#e3f1ea, #0f2620);
  --signal-partial: light-dark(#8f4e00, #f2b252);
  --signal-partial-soft: light-dark(#faeed8, #2b200e);
  --signal-gap: light-dark(#b4233a, #ff8086);
  --signal-gap-soft: light-dark(#fae8e9, #331719);
  /* Fills for meters and dots; CVD-separated (design.md §2.3). Always paired with words. */
  --mark-strong: light-dark(#0e8f6a, #22a47e);
  --mark-partial: light-dark(#d88a00, #efa12a);
  --mark-gap: light-dark(#e04a5a, #f4606a);
  --on-signal: light-dark(#ffffff, #131210);

  /* AI-generated content: pencil on vellum. */
  --ai: light-dark(#6a3cc9, #c3afff);
  --ai-soft: light-dark(#f1edfa, #1e1a2c);
  --ai-rule: light-dark(#cbbdee, #4a3e75);
  --mark-ai: light-dark(#8b5cf6, #a385fa);

  --shadow-color: light-dark(rgb(26 25 22 / 0.16), rgb(0 0 0 / 0.55));
  --shadow-btn: 0 0 0 1px var(--rule-strong);
  --shadow-card: 0 0 0 1px var(--rule);
  --shadow-raised: 0 0 0 1px var(--rule-strong), 0 16px 36px -18px var(--shadow-color);
  --shadow-plate: inset 0 0 0 1px var(--rule-strong);
  --plate-top: var(--sunken);
  --plate-bottom: var(--sunken);

  --font-display: var(--font-newsreader), ui-serif, Georgia, serif;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }

@theme inline {
  --color-paper: var(--paper);
  --color-raised: var(--raised);
  --color-sunken: var(--sunken);
  --color-well: var(--well);
  --color-hover: var(--hover);
  --color-grid-major: var(--grid-major);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-rule: var(--rule);
  --color-rule-soft: var(--rule-soft);
  --color-rule-strong: var(--rule-strong);
  --color-accent: var(--accent);
  --color-accent-solid: var(--accent-solid);
  --color-accent-ink: var(--accent-ink);
  --color-accent-soft: var(--accent-soft);
  --color-highlight: var(--highlight);
  --color-focus: var(--focus);
  --color-signal-strong: var(--signal-strong);
  --color-signal-strong-soft: var(--signal-strong-soft);
  --color-signal-partial: var(--signal-partial);
  --color-signal-partial-soft: var(--signal-partial-soft);
  --color-signal-gap: var(--signal-gap);
  --color-signal-gap-soft: var(--signal-gap-soft);
  --color-mark-strong: var(--mark-strong);
  --color-mark-partial: var(--mark-partial);
  --color-mark-gap: var(--mark-gap);
  --color-on-signal: var(--on-signal);
  --color-ai: var(--ai);
  --color-ai-soft: var(--ai-soft);
  --color-ai-rule: var(--ai-rule);
  --color-mark-ai: var(--mark-ai);
  --font-sans: var(--font-geist), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-display);
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace;

  --text-hero: clamp(2.75rem, 1.6rem + 4.2vw, 4.75rem);
  --text-hero--line-height: 1;
  --text-hero--letter-spacing: -0.03em;
  --text-h1: clamp(2.125rem, 1.6rem + 2vw, 3rem);
  --text-h1--line-height: 1.06;
  --text-h1--letter-spacing: -0.025em;
  --text-h2: clamp(1.5rem, 1.25rem + 0.9vw, 1.875rem);
  --text-h2--line-height: 1.15;
  --text-h2--letter-spacing: -0.015em;
  --text-h2-sm: 1.25rem;
  --text-h2-sm--line-height: 1.25;
  --text-h2-sm--letter-spacing: -0.01em;
  --text-h3: 1.125rem;
  --text-h3--line-height: 1.35;
  --text-h3--letter-spacing: -0.01em;
  --text-h4: 0.9375rem;
  --text-h4--line-height: 1.4;
  --text-lede: 1.125rem;
  --text-lede--line-height: 1.6;
  --text-body: 1rem;
  --text-body--line-height: 1.65;
  --text-ui: 0.875rem;
  --text-ui--line-height: 1.5;
  --text-small: 0.8125rem;
  --text-small--line-height: 1.45;
  --text-micro: 0.75rem;
  --text-micro--line-height: 1.4;
  --text-label: 0.6875rem;
  --text-label--line-height: 1;
  --text-label--letter-spacing: 0.08em;
  --text-code: 0.8125rem;
  --text-code--line-height: 1.6;
}

@utility shell {
  width: 100%;
  max-width: 76rem;
  margin-inline: auto;
  padding-inline: 1.25rem;
  @media (min-width: 640px) { padding-inline: 2rem; }
  @media (min-width: 1024px) { padding-inline: 2.5rem; }
}

/* Serif headings: h1, h2 and display only (≥ 1.25rem). */
@utility font-display {
  font-family: var(--font-display);
  font-weight: 450;
  letter-spacing: -0.02em;
  font-optical-sizing: auto;
}
/* Sans headings: h3 and below, and every heading inside tools. */
@utility font-heading {
  font-family: var(--font-sans);
  font-weight: 600;
  letter-spacing: -0.01em;
}

@layer base {
  html {
    scroll-padding-top: 7.5rem;
    background: var(--paper);
    color: var(--ink);
    -webkit-text-size-adjust: 100%;
  }
  body {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  * {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--ink) 22%, transparent) transparent;
  }
  ::selection { background: var(--highlight); color: var(--ink); }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
  textarea, input, select { font: inherit; }
  code, pre, .font-mono, .field-mono, .kicker, .cost, .ai-label {
    font-variant-ligatures: none;
    font-feature-settings: "calt" 0, "liga" 0;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
}

@layer components {
  /* ---------- Layout ---------- */
  .section { padding-block: 2rem; }
  @media (min-width: 640px) { .section { padding-block: 3rem; } }
  .bleed { margin-inline: calc(50% - 50cqw); padding-inline: calc(50cqw - 50%); }
  .measure { max-width: 46rem; margin-inline: auto; }

  /* The dot-grid pad behind diagrams and hero bands. */
  .dotgrid,
  .screen {
    background-color: var(--well);
    background-image:
      radial-gradient(circle at center, var(--grid-major) 1.5px, transparent 1.75px),
      radial-gradient(circle at center, var(--grid-minor) 1px, transparent 1.25px);
    background-size: 120px 120px, 24px 24px;
    background-position: -60px -60px, -12px -12px;
  }
  .screen { border-radius: 14px; box-shadow: inset 0 0 0 1px var(--rule); }

  .nav-link {
    position: relative; display: inline-flex; align-items: center; height: 3.5rem;
    padding-inline: 0.7rem; font-size: 0.875rem; color: var(--ink-2);
    transition: color 160ms var(--ease-out);
  }
  .nav-link:hover { color: var(--ink); }
  .nav-link[aria-current="page"] { color: var(--ink); font-weight: 500; }
  .nav-link[aria-current="page"]::after {
    content: ""; position: absolute; left: 0.7rem; right: 0.7rem; bottom: -1px; height: 2px; background: var(--ink);
  }
  /* .stage-popover: keep current rules unchanged. */
  .glass {
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }

  /* ---------- Surfaces ---------- */
  .panel { background: var(--raised); border-radius: 10px; box-shadow: var(--shadow-card); }
  .tile { background: var(--raised); border-radius: 8px; box-shadow: var(--shadow-card); }
  a.tile, button.tile { transition: box-shadow 160ms var(--ease-out), transform 120ms var(--ease-out); }
  a.tile:hover, button.tile:hover { box-shadow: 0 0 0 1px var(--rule-strong); }
  a.tile:active, button.tile:active { transform: scale(0.995); }
  .well { background: var(--well); border-radius: 10px; box-shadow: inset 0 0 0 1px var(--rule-soft); }
  .well-sm { background: var(--well); border-radius: 8px; box-shadow: inset 0 0 0 1px var(--rule-soft); }
  .tint { background: var(--accent-soft); border-radius: 10px; }

  /* ---------- Dots, chips, labels ---------- */
  .led {
    display: inline-block; width: 0.4375rem; height: 0.4375rem; border-radius: 9999px; flex-shrink: 0;
    background: var(--led, var(--rule-strong));
  }
  .led-strong { --led: var(--mark-strong); }
  .led-partial { --led: var(--mark-partial); }
  .led-gap { --led: var(--mark-gap); }
  .led-accent { --led: var(--ink); }
  .led-ai { --led: var(--mark-ai); }
  .led-idle { --led: var(--ink-3); }
  .led-off { --led: transparent; box-shadow: inset 0 0 0 1px var(--rule-strong); }
  .led-pulse { animation: led-pulse 1.4s ease-in-out infinite; }
  @keyframes led-pulse { 50% { opacity: 0.3; } }

  .chip, .chip-flat {
    display: inline-flex; align-items: center; gap: 0.375rem; height: 1.375rem; border-radius: 4px;
    padding: 0 0.45rem; font-size: 0.75rem; line-height: 1; color: var(--ink-2); white-space: nowrap;
    background: color-mix(in srgb, var(--ink) 5%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 7%, transparent);
  }
  .chip { background: var(--raised); box-shadow: var(--shadow-btn); }
  button.chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); box-shadow: none; }

  .eyebrow { font-size: 0.8125rem; line-height: 1.25rem; font-weight: 500; color: var(--ink-2); }
  .kicker {
    font-family: var(--font-mono); font-size: 0.6875rem; line-height: 1; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-3);
  }
  .badge-new {
    display: inline-flex; align-items: center; height: 1.125rem; padding: 0 0.3rem; border-radius: 4px;
    background: var(--highlight); color: var(--accent-ink);
    font-family: var(--font-mono); font-size: 0.625rem; letter-spacing: 0.08em; text-transform: uppercase;
  }

  /* ---------- Prose ---------- */
  .prose { font-size: 1rem; line-height: 1.65; color: var(--ink); }
  .prose > * + * { margin-top: 0.85em; }
  .prose ul, .prose ol { padding-left: 1.25em; }
  .prose ul { list-style: none; }
  .prose ul > li { position: relative; }
  .prose ul > li::before {
    content: ""; position: absolute; left: -0.95em; top: 0.68em; width: 0.32em; height: 0.32em;
    border-radius: 1px; background: var(--ink-3);
  }
  .prose ol { list-style: decimal; }
  .prose ol > li::marker { color: var(--ink-3); font-family: var(--font-mono); font-size: 0.8em; }
  .prose li + li { margin-top: 0.4em; }
  .prose strong { font-weight: 600; }
  .prose code {
    font-family: var(--font-mono); font-size: 0.82em; background: var(--sunken);
    box-shadow: inset 0 0 0 1px var(--rule-soft); border-radius: 4px; padding: 0.1em 0.35em; overflow-wrap: anywhere;
  }
  .prose pre {
    font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.6; background: var(--well);
    box-shadow: inset 0 0 0 1px var(--rule); border-radius: 10px; padding: 0.85rem 1rem; overflow-x: auto;
  }
  .prose pre code { background: none; box-shadow: none; padding: 0; font-size: inherit; overflow-wrap: normal; }
  .prose blockquote { border-left: 2px solid var(--ink); padding-left: 1rem; color: var(--ink-2); }
  .prose .table-wrap { overflow-x: auto; }
  .prose table { width: 100%; min-width: 480px; border-collapse: collapse; font-size: 0.8125rem; line-height: 1.5; }
  .prose th, .prose td {
    text-align: left; vertical-align: top; padding: 0.55rem 0.75rem 0.55rem 0; border-bottom: 1px solid var(--rule-soft);
  }
  .prose thead th {
    font-family: var(--font-mono); font-size: 0.6875rem; font-weight: 400; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-3);
  }
  .prose tbody th { font-weight: 500; }
  .prose td { color: var(--ink-2); }
  .prose-sm { font-size: 0.875rem; line-height: 1.65; }

  .concept-link {
    color: inherit; text-decoration-line: underline; text-decoration-style: dotted;
    text-decoration-color: var(--ink-3); text-decoration-thickness: 1.5px; text-underline-offset: 3px;
    border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone;
    transition: background-color 160ms var(--ease-out);
  }
  .concept-link:hover { text-decoration-style: solid; text-decoration-color: var(--ink); background: var(--highlight); }

  .link {
    color: var(--ink); font-weight: 500; text-decoration-line: underline;
    text-decoration-color: var(--rule-strong); text-underline-offset: 3px; border-radius: 2px;
    box-decoration-break: clone; -webkit-box-decoration-break: clone;
    transition: background-color 160ms var(--ease-out), text-decoration-color 160ms var(--ease-out);
  }
  .link:hover { text-decoration-color: var(--ink); background: var(--highlight); }

  .code-head {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.4rem 0.5rem 0.4rem 1rem;
    border-bottom: 1px solid var(--rule-soft); font-family: var(--font-mono); font-size: 0.6875rem; color: var(--ink-3);
  }

  /* ---------- Inputs ---------- */
  .field {
    width: 100%; background: var(--raised); border: 0; border-radius: 6px; padding: 0.625rem 0.75rem;
    font-size: 0.875rem; color: var(--ink); box-shadow: var(--shadow-btn); transition: box-shadow 160ms var(--ease-out);
  }
  .field::placeholder { color: var(--ink-3); }
  .field:focus {
    outline: none;
    box-shadow: 0 0 0 1px var(--ink), 0 0 0 4px color-mix(in srgb, var(--accent-solid) 45%, transparent);
  }
  .field[aria-invalid="true"] { box-shadow: 0 0 0 1px var(--mark-gap); }
  .field-mono { font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.6; tab-size: 2; }

  /* ---------- Buttons ---------- */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 2.25rem;
    border-radius: 6px; padding: 0.5rem 0.875rem; font-size: 0.875rem; font-weight: 500; line-height: 1.1;
    border: 0; white-space: nowrap; cursor: pointer; user-select: none;
    transition: background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out),
      color 160ms var(--ease-out), transform 120ms var(--ease-out);
  }
  .btn:not(:disabled):active { transform: scale(0.98); }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn[aria-busy="true"] { pointer-events: none; }
  .btn-sm { min-height: 1.875rem; padding: 0.375rem 0.625rem; font-size: 0.8125rem; border-radius: 5px; }
  .btn-lg { min-height: 2.75rem; padding: 0.75rem 1.125rem; font-size: 0.9375rem; border-radius: 7px; }
  .btn-primary { color: var(--paper); background: var(--ink); }
  .btn-primary:not(:disabled):hover { background: color-mix(in srgb, var(--ink) 86%, var(--paper)); }
  .btn-accent {
    color: var(--accent-ink); background: var(--accent-solid);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, #1a1916 14%, transparent);
  }
  .btn-accent:not(:disabled):hover { background: color-mix(in srgb, var(--accent-solid) 88%, #1a1916); }
  .btn-secondary { color: var(--ink); background: var(--raised); box-shadow: var(--shadow-btn); }
  .btn-secondary:not(:disabled):hover { background: var(--well); }
  .btn-secondary[aria-pressed="true"] { background: var(--sunken); box-shadow: var(--shadow-plate); }
  .btn-ghost { color: var(--ink-2); }
  .btn-ghost:not(:disabled):hover { color: var(--ink); background: var(--hover); }
  .btn-danger { color: var(--signal-gap); background: var(--raised); box-shadow: var(--shadow-btn); }
  .btn-danger:not(:disabled):hover { background: var(--signal-gap-soft); }
  .btn-danger-solid { color: var(--on-signal); background: var(--signal-gap); }
  .btn-danger-solid:not(:disabled):hover { background: color-mix(in srgb, var(--signal-gap) 88%, var(--ink)); }

  /* What an action costs, shown inside its button before the click. */
  .cost {
    display: inline-flex; align-items: center; height: 1.125rem; padding: 0 0.35rem; margin-right: -0.25rem;
    border-radius: 4px; font-family: var(--font-mono); font-size: 0.6875rem; font-weight: 400;
    background: color-mix(in srgb, currentColor 14%, transparent);
  }
  .spinner {
    width: 12px; height: 12px; border-radius: 9999px; border: 1.5px solid currentColor;
    border-right-color: transparent; animation: spin 700ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .knob {
    display: inline-grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 6px;
    color: var(--ink-3); transition: background-color 160ms var(--ease-out), color 160ms var(--ease-out);
  }
  .knob:not(:disabled):hover { color: var(--ink); background: var(--hover); }
  .knob:disabled { opacity: 0.35; cursor: not-allowed; }

  .choice {
    display: flex; gap: 0.75rem; border-radius: 8px; padding: 0.875rem 1rem; cursor: pointer;
    background: var(--raised); box-shadow: var(--shadow-card);
    transition: box-shadow 160ms var(--ease-out), background-color 160ms var(--ease-out);
  }
  .choice:hover { box-shadow: 0 0 0 1px var(--rule-strong); }
  .choice:has(:checked) { background: var(--accent-soft); box-shadow: 0 0 0 1.5px var(--ink); }
  .choice:has(:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }

  /* ---------- Tabs ---------- */
  .tabs { display: flex; gap: 1.5rem; border-bottom: 1px solid var(--rule); overflow-x: auto; }
  .tab {
    position: relative; padding-block: 0.75rem; font-size: 0.875rem; font-weight: 500; color: var(--ink-3);
    white-space: nowrap; transition: color 160ms var(--ease-out);
  }
  .tab:hover { color: var(--ink); }
  .tab[aria-selected="true"] { color: var(--ink); }
  .tab[aria-selected="true"]::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--ink);
  }

  /* ---------- Callouts ---------- */
  .callout { border-left: 2px solid var(--callout, var(--rule-strong)); padding: 0.25rem 0 0.25rem 1.25rem; }
  .callout-title {
    font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--callout-text, var(--ink-3));
  }
  .callout-failure { --callout: var(--mark-gap); --callout-text: var(--signal-gap); }
  .callout-scale { --callout: var(--mark-partial); --callout-text: var(--signal-partial); }
  .callout-change { --callout: var(--ink); --callout-text: var(--ink); }
  .callout-note { --callout: var(--rule-strong); --callout-text: var(--ink-3); }
  .callout-ai { border-left-style: dashed; --callout: var(--mark-ai); --callout-text: var(--ai); }

  /* ---------- AI content ---------- */
  .ai-block {
    background: var(--ai-soft); border-radius: 10px; padding: 1rem 1.25rem;
    outline: 1px dashed var(--ai-rule); outline-offset: -1px;
  }
  .ai-block-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin-bottom: 0.75rem; }
  .ai-label {
    display: inline-flex; align-items: center; gap: 0.375rem; height: 1.25rem; padding: 0 0.375rem;
    border-radius: 4px; background: var(--ai-soft); box-shadow: inset 0 0 0 1px var(--ai-rule); color: var(--ai);
    font-family: var(--font-mono); font-size: 0.6875rem; line-height: 1; letter-spacing: 0.08em;
    text-transform: uppercase; white-space: nowrap;
  }
  .ai-inline { background: var(--ai-soft); border-bottom: 1px dashed var(--mark-ai); border-radius: 2px; }
  .stream-caret {
    display: inline-block; width: 2px; height: 1.1em; margin-left: 1px; vertical-align: text-bottom;
    background: var(--mark-ai); animation: caret 1s step-end infinite;
  }
  @keyframes caret { 50% { opacity: 0; } }

  /* ---------- Loading ---------- */
  .skeleton {
    border-radius: 6px;
    background: linear-gradient(90deg, var(--sunken) 0%, var(--hover) 50%, var(--sunken) 100%) 0 0 / 200% 100%;
    animation: shimmer 1.6s linear infinite;
  }
  .skeleton-text { height: 0.75em; margin-block: 0.45em; }
  @keyframes shimmer { to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none; background: var(--sunken); }
    .stream-caret, .led-pulse { animation: none; }
  }

  /* ---------- Commerce ---------- */
  .credits {
    display: inline-flex; align-items: center; gap: 0.5rem; height: 1.875rem; padding: 0 0.625rem;
    border-radius: 6px; background: var(--raised); box-shadow: var(--shadow-btn);
    font-size: 0.8125rem; color: var(--ink-2);
  }
  .credits-meter { width: 18px; height: 6px; border-radius: 2px; background: var(--sunken); overflow: hidden; }
  .credits-meter > span { display: block; height: 100%; background: var(--ink); }
  .credits-count { font-family: var(--font-mono); color: var(--ink); font-variant-numeric: tabular-nums; }
  .credits[data-low="true"] .credits-count { color: var(--signal-partial); }

  .paywall { background: var(--raised); border-radius: 10px; box-shadow: var(--shadow-card); padding: 1.25rem 1.5rem; }
  .price-card {
    display: flex; flex-direction: column; gap: 1rem; background: var(--raised); border-radius: 14px;
    box-shadow: var(--shadow-card); padding: 1.5rem; overflow: hidden;
  }
  .price-card-featured { box-shadow: 0 0 0 1.5px var(--ink); padding-top: 0; }
  .price-card-band {
    margin-inline: -1.5rem; height: 1.75rem; display: flex; align-items: center; padding-inline: 1.5rem;
    background: var(--accent-solid); color: #1a1916;
    font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: 0.08em; text-transform: uppercase;
  }

  /* ---------- Feedback ---------- */
  .toast {
    display: flex; align-items: flex-start; gap: 0.625rem; max-width: 24rem; padding: 0.75rem 1rem;
    background: var(--raised); border-radius: 10px; box-shadow: var(--shadow-raised); font-size: 0.875rem;
    animation: toast-in 220ms var(--ease-out) both;
  }
  @keyframes toast-in { from { transform: translateY(8px); opacity: 0; } }
  .empty {
    display: grid; justify-items: center; gap: 0.75rem; text-align: center; padding: 2.5rem 1.5rem;
    border-radius: 14px; box-shadow: inset 0 0 0 1px var(--rule);
  }

  /* ---------- Stepper (project workspace) ---------- */
  .stepper { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--rule); overflow-x: auto; }
  .step {
    display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem 0.75rem 0;
    font-size: 0.8125rem; color: var(--ink-3); white-space: nowrap;
  }
  .step-num {
    display: grid; place-items: center; width: 22px; height: 22px; border-radius: 9999px;
    font-family: var(--font-mono); font-size: 0.6875rem; box-shadow: inset 0 0 0 1px var(--rule-strong);
  }
  .step[data-state="done"] { color: var(--ink-2); }
  .step[data-state="done"] .step-num { background: var(--ink); color: var(--paper); box-shadow: none; }
  .step[aria-current="step"] { color: var(--ink); font-weight: 500; }
  .step[aria-current="step"] .step-num { background: var(--accent-solid); color: #1a1916; box-shadow: none; }

  .avatar {
    width: 28px; height: 28px; border-radius: 9999px; background: var(--sunken); color: var(--ink-2);
    display: grid; place-items: center; font-size: 0.75rem; font-weight: 600; overflow: hidden;
    box-shadow: 0 0 0 1px var(--rule-strong);
  }

  /* ---------- Tables ---------- */
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; line-height: 1.5; }
  .data-table th, .data-table td {
    text-align: left; vertical-align: top; padding: 0.7rem 1rem 0.7rem 0; border-bottom: 1px solid var(--rule-soft);
  }
  .data-table tr:last-child > th, .data-table tr:last-child > td { border-bottom: 0; }
  .data-table thead th {
    font-family: var(--font-mono); font-size: 0.6875rem; font-weight: 400; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--ink-3);
  }
  .data-table tbody th { font-weight: 500; }
  .data-table td { color: var(--ink-2); }

  /* ---------- Lessons (changed rules only; keep the rest) ---------- */
  .lesson-mark {
    position: absolute; left: 0; top: 0.75rem; display: grid; place-items: center;
    width: 1.4375rem; height: 1.4375rem; border-radius: 9999px; font-family: var(--font-mono);
    font-size: 0.75rem; color: #1a1916; background: var(--accent-solid);
  }
  .lesson-mark-done { color: var(--on-signal); background: var(--signal-strong); }
  .lesson-check { background: var(--raised); border-radius: 10px; box-shadow: var(--shadow-card); padding: 1rem 1.125rem 1.125rem; }
  @media (min-width: 640px) { .lesson-check { padding: 1.125rem 1.375rem 1.375rem; } }
  .lesson-option { border-radius: 8px; background: var(--paper); box-shadow: var(--shadow-btn);
    transition: box-shadow 160ms var(--ease-out), background-color 160ms var(--ease-out); }

  .rise { animation: rise 420ms var(--ease-out) both; animation-delay: var(--d, 0ms); }
  @keyframes rise { from { transform: translateY(6px); } }
}
```

Note on `#1a1916` literals: the text on citron (`.btn-accent`, `.lesson-mark`, `.step` current, `.price-card-band`) is fixed graphite in both modes. Citron is the same colour in both modes, so its text must be too. `--accent-ink` is equivalent (`#161600` in dark). Either is correct.

## Appendix B: contrast script

```js
// node contrast.mjs: WCAG 2.x contrast for token pairs
const hex = h => [0, 2, 4].map(i => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255);
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = h => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
console.log(ratio("#686359", "#E9E6DD").toFixed(2)); // ink-3 on sunken (light): 4.78
```
