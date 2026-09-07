# Hydra Curls — Figma Design Spec

Extracted from the Figma REST API on 2026-09-07 by the admin session.
**File key:** `Yqq9qC4hZqj0adhv5kJUNG` · **Target frame:** `1:503` (named "New")
**Canvas:** 1920 × 15249 px · **Background:** `#F3FDFF`
**Layout grid:** 12 columns · 118px column · 24px gutter · 120px side margin (→ content width 1680px)

Brand: *Parachute Advanced — Hydra Curls*. A long-form product landing page for a curly-hair care
range aimed at Arab hair types 2/3/4. Visual language: purple → cyan gradients, wavy organic
dividers, script display type, product photography on water/splash backgrounds.

---

## ⚠️ Read this before you write any markup

### 1. The Figma file has NO auto-layout. Do not mirror the node tree.

The frame is **47 top-level nodes, flat, absolutely positioned**, with overlapping bounding boxes
and names like `Frame 71`, `Component 11`, `Group 12173`, `Rectangle 185`. Node nesting carries
**no semantic meaning**.

**Therefore:** derive sections from the **y-coordinate map below**, then rebuild each one
semantically with normal document flow — flex/grid, `max-width` containers, real `<section>`
elements. A 1:1 translation of the node tree into absolutely-positioned divs will look right at
1920px and shatter at every other width. That is the single biggest way to fail this assignment.

### 2. `Gotham` is a paid font. You cannot ship it.

Gotham (Hoefler&Co) is the dominant UI font here (~50% of text nodes). It is not free and not on
Google Fonts.

**Substitute: `Montserrat`** — the standard geometric-sans stand-in for Gotham, on Google Fonts,
near-identical proportions. Map weights:

| Figma Gotham | Use Montserrat |
|---|---|
| 300 (Light) | 300 |
| 350 (Book) — most common | 400 |
| 400 (Medium) | 500 |

Document this substitution in the A1 README. It is a correct engineering call under a licensing
constraint, and saying so demonstrates judgment. Silently shipping a broken font stack does not.

### 3. Fonts you CAN use as-is

| Font | Role | Source |
|---|---|---|
| **Kaushan Script** | Display/script headlines, pull quotes | Google Fonts ✅ |
| **Inter** | Curved decorative text only | Google Fonts ✅ |
| **Guthen Bloots Personal Use** | Small handwritten eyebrow labels | ⚠️ *Personal Use* license |

**Guthen Bloots is licensed for personal use only** — do not bundle it. Options, in order of
preference: (a) find a free-for-commercial handwritten substitute (`Caveat`, `Shadows Into Light`,
`Just Another Hand` on Google Fonts), or (b) export those few short labels as SVG. They appear
~8 times as short eyebrow text ("New Launch", "Premium Ingredients", "Designed for You", etc.).
Note the substitution in the README.

### 4. Some "text" in the file is exploded into per-character nodes

Two decorative passages are **text-on-a-curve**, stored as one node per glyph, each with its own
rotation — 144 `Inter 25px` nodes and 48 `Kaushan Script 72px` nodes.

Do **not** render these as hundreds of positioned spans. Either:

- rebuild with inline **SVG `<textPath>`** (preferred — stays crisp, scalable, and it is an
  impressive touch to be able to explain), or
- export the group as a single SVG/PNG asset.

Affected: the arc near y≈5251 ("Explore our range… discover…") and y≈6973 ("Hydrated Curly…").

### 5. Body copy is placeholder in places

Several blocks are literally `Lorem Ipsum` + repeated "Hyaluronic Acid acts like a magnet for
moisture…". **Reproduce them as-is.** The task is visual fidelity, not copywriting. Do not
"improve" the content — the reviewer is diffing against the design.

---

## Design tokens

### Color

| Hex | Role | Notes |
|---|---|---|
| `#00D5FD` | **Primary cyan** | Accent, buttons, wave dividers, links. Highest-signal brand color. |
| `#76468A` | **Brand purple** | Hero background, deep sections |
| `#040C1E` | Near-black | Primary text on light |
| `#F3FDFF` | Page background | Very pale cyan-white |
| `#DAF6FF` | Soft cyan tint | Section/card backgrounds |
| `#C7EEFF` | Cyan tint 2 | Card backgrounds |
| `#77DBFC` | Cyan mid | Borders, hovers |
| `#FFFFFF` | White | Cards, text on dark |
| `#000000` | Black | Text |
| `#737373` | Grey 500 | Secondary/muted text |
| `#A2A2A2` | Grey 400 | Muted text, second tier — 6 uses |
| `#DFDFDF` `#DBDBDB` `#C0C2C6` | Grey borders | Dividers, card borders |
| `#FACC15` | Amber | ★ star ratings (this is Tailwind `yellow-400`) |
| `#34C759` | Success green | The ✓ tick inside the trust badges (No SLS / No Silicones / …) — 9 uses |
| `#AAB9FF` `#EBBBFF` `#FFCFAF` `#D9FEA6` | Pastel set | Ingredient/benefit chips — periwinkle, pink, peach, green |

Frequency across the whole tree, so you can tell signal from noise:
`#FFFFFF` 215 · `#000000` 82 · `#00D5FD` 77 · `#DFDFDF` 36 · `#737373` 32 · `#FACC15` 10 ·
`#34C759` 9 · `#76468A` 7 · `#040C1E` 7 · `#F3FDFF` 6 · `#DAF6FF` 6 · `#A2A2A2` 6 · `#1DAEC6` 5 ·
`#77DBFC` 4 · `#C0C2C6` 4 · `#DBDBDB` 3 · then singles and pairs.

### Gradients — all 9 in the file, measured

| Node | Stops | Ships as |
|---|---|---|
| **Hero headline** *(a **text** fill)* | `#1D3565` 0 → `#834E99` .23 → `#834E99` .70 → `#1D3565` 1 | `background-image` + `background-clip: text` |
| `Frame 4` — *Learn More* pill | `#1DAEC6` → `#02D3FC` | CSS |
| `Frame 62` | `#00D5FD` → `#02D3FC` | CSS |
| `Rectangle 4` | `#00D5FD` 0 → `#02D3FC` .5 → `#DCE0E2` 1 | CSS |
| `Ellipse 48` | `#FFFFFF` → `#49E2FF` | CSS |
| `Line 32` | `#000000` 0 → `#343434` .51 → `#666666` 1 | CSS |
| `Line 33` — hero underline flourish | white → white → white (an *opacity* ramp) | inline SVG |
| `Vector` | `#000000` → `#FFFFFF` | inline SVG |
| `Vector 1` | `#000000` → `#666666` | inline SVG |

> ⚠️ **The hero headline is gradient-filled text, not a solid colour.** It needs
> `background-image` + `background-clip: text` + `color: transparent`, with a solid
> `#834E99` fallback for browsers that fail the `background-clip` support check.

### What is raster and what is CSS

Not every band is a gradient — measure before you reach for `linear-gradient`:

| Node | y / h | Reality |
|---|---|---|
| `Rectangle 136` — **hero background** | 100 / 1133, full-bleed | ⚠️ an **image fill** (`082ae4cdd5…`), **not** a CSS gradient. No gradient will match it; ship it as an optimised image. |
| `Rectangle 190` · `Rectangle 140` | 1122 / 169 · 4273 / 169 | Solid `#00D5FD` **VECTOR** — the two cyan wave dividers. Inline SVG. |
| `Rectangle 185` (×2) · `Rectangle 150` | 3287 & 3336 / 684 · 10255 / 1622 | Solid `#DAF6FF` section bands. Plain CSS. |
| Frame background | — | `#F3FDFF`. |

### Type scale (as designed at 1920px)

| Size / LH | Family | Role |
|---|---|---|
| 162 / 194 | Gotham 400 | Giant stat numeral ("48") |
| 80 / 116 | Kaushan Script | Hero headline |
| 54 / 65 | Gotham 400 | Section headings (h2) |
| 52 / — | Gotham 400 | Final CTA heading |
| 32 / 38 | Gotham 400 | Product names |
| 30 / 36 | Gotham 350 | Card titles, stat numbers |
| 24 / 35 | Kaushan Script | Script sub-copy / lead paragraphs |
| 24 / 35 | Guthen Bloots | Handwritten eyebrow labels |
| 24 / 32 | Gotham 350/400 | Card titles, body-large |
| 20 / 24–32 | Gotham 350 | Body, nav, buttons |
| 18 / — | Gotham 350 | Footer links, small body |
| 16 / 19 | Gotham 350 | Badges, captions |
| 14 / — | Gotham 350 | ALL-CAPS micro labels (letter-spaced) |

**These are 1920px values — do not hardcode them.** Build a fluid scale (`clamp()`) so type
degrades sensibly. Suggested: treat 1920 as the design width and scale down to ~0.55× at mobile.

---

## Section map (by y-coordinate — the real structure)

| # | y-range | Section | Contents |
|---|---|---|---|
| 1 | 0 – 100 | **Navbar** | Logo + Home · Products · Curly Girl Method · Hair Care Blog |
| 2 | ~100 – 135 | **Ticker / announcement** | "5 Essential Products for Perfect Curls" |
| 3 | 100 – 1233 | **Hero** | Purple background — **a raster image fill, not a CSS gradient** — plus wavy pattern overlay. Logo mark (y399). Headline *"Pure ingredients. Real results. Every drop matters."* (Kaushan 80px, centered, **gradient-filled text**). Underline flourish. Double chevron scroll cue. |
| 4 | 1122 – 1291 | **Cyan wave divider** | Full-bleed SVG wave, purple → white |
| 5 | 1199 – 2029 | **New Launch** | Eyebrow "New Launch" · Hydra Curls logo · script intro copy · 3 badges (*No SLS, Silicones, Parabens* · *48-Hour Hydration* · *Hair Types 2, 3, 4*) · 2 CTAs (*Explore Products* filled, *Learn Curly Girl Method* outline) · product bottle + splash + palm leaf art on the right |
| 6 | 1904 – 3126 | **Brand key visual** | Full-bleed *Hydra Curls* campaign image — bottle lineup, model, HYALURON / COCONUT / AVOCADO |
| 7 | 3246 – 5250 | **Benefit cards** | Alternating image/text cards on `#DAF6FF` bands with a wavy pattern overlay. `Lorem Ipsum` titles (30px), the repeated hyaluronic-acid body copy, *Learn More* pill buttons (gradient `#1DAEC6 → #02D3FC`). |
| 8 | 5319 – 6698 | **Product showcase** | `Component 12` — purple curved band, two bottles, the product-name switcher (*Hydrating Shampoo · Hydrating Conditioner · Defining Gel · Defining Cream · Hydrating Mask*, 32px) and a row of circular thumbnails. **Its own section**, not part of the benefit cards. |
| 8b | 5251 – 5606 | **Curved script arc** | Per-glyph Kaushan 72px on a curve → **rebuild as SVG textPath**. Overlaps the top of the product showcase — build the two together. |
| 9 | 5800 – 6573 | **The Hydra Curls Promise** | Eyebrow · h2 *"Clinically Proven 48-Hour Hydration"* · lead paragraph · two feature blocks (*Moisture Attraction*, *Strengthening Seal*) · giant **48** / *Hours* / *"of continuous curl hydration and frizz control."* stat |
| 10 | 6636 – 7748 | **Premium Ingredients** | Eyebrow · h2 *"Powered by Nature's Best Ingredients"* · script lead · 3 ingredient cards (**Hyaluronic Acid**, **Coconut Oil**, **Avocado Extract**) · 9 benefit chips (Deep Hydration, Curl Definition, Hair Strength, Moisture Lock, Natural Shine, Softness, Frizz Control, Nutrient Rich, Plump Curls) · 5 trust badges (No SLS, No Silicones, No Parabens, Cruelty Free, Natural Extracts) · curved Inter text |
| 11 | 7748 – 8857 | **Testimonials** | Eyebrow *"Real Women, Real Results"* · h2 *"Hear from Our Community"* · quote cards w/ ★ ratings, name (*Aisha K*), location (*Dubai, UAE*) |
| 12 | 8916 – 10459 | **Influencer / Expert** | Eyebrow *"Influencer Approved"* · h2 *"See What The Experts Are Saying"* · media cards |
| 13 | 10255 – 11877 | **Designed for You** | Eyebrow · h2 *"Perfect for Arab Curly, Coily & Wavy Hair"* · script lead · **3 hair-type cards** (Components 15/16/17, ~619×775 each) — type 2/3/4 with CHARACTERISTICS lists (*S-shaped pattern*, *Light waves*, *Can be frizz-prone*) · circular badge + ellipse motif |
| 14 | 11849 – 15249 | **Learn & Grow** | Eyebrow · h2 *"Your Curly Hair Journey Starts Here"* · script lead · resource cards (*Expert Guide* → *Curly Girl Method Guide*, *EXPLORE NOW* links) |
| 15 | 14209 – 14692 | **Final CTA** | h2 *"Join the Curly Hair Revolution"* (52px) · script sub-copy · 3 stats: **05** Hair Types · **48h** Hydration · **0** Sulfates |
| 16 | 14692 – 15249 | **Footer** | Brand blurb · *Hair care* links (Hair Type Guide, Styling Tips, Ingredient Benefits) · *Connect* + social · *Newsletter* email capture · © 2026 Parachute Advanced Hydra Curls |

> Sections 7/8/9 have **overlapping bounding boxes** in Figma (decorative art bleeds across bands).
> Always sanity-check against the exported reference PNG rather than trusting y-ranges alone.

---

## Assets — 95 images available

The file references **95 image fills**, downloadable via the REST API. Use
`hydra-curls/scripts/figma-extract.mjs` (already written — see its header for usage).

It produces:

- `docs/figma/raw/nodes.json` — full node tree
- `docs/figma/reference/full-page.png` — full-page render, for visual diffing
- `hydra-curls/public/assets/figma/` — every image fill, downloaded

**For per-section references, use `docs/figma/reference/slices/`** — 15 slices covering the whole
page, generated locally by `hydra-curls/scripts/slice_reference.py` with **zero Figma API calls**.

> Why slices rather than per-node renders: Figma rate-limits its image *render* endpoint to roughly
> 30 calls before a multi-minute cooldown, so rendering all 47 nodes individually leaves the tail of
> the page missing. Slicing the single full-page render is unlimited, and it shows each section
> *in context* rather than as an isolated node on a transparent background — which is what you
> actually need when checking spacing between sections. `reference/sections/` holds 30 partial
> per-node renders; treat them as supplementary.

**Convert raster assets to WebP/AVIF** with explicit `width`/`height` and `loading="lazy"` on
everything below the fold. With ~95 images on a 15,000px page, this is the entire performance
story — unoptimized, the page will be tens of megabytes and Lighthouse will crater.

Prefer **inline SVG** for: wave dividers, the underline flourish, chevrons, icons, and the curved
text. They scale cleanly and cost almost nothing.

### Vector path data lives in a second file

`nodes.json` was fetched **without** `geometry=paths`, so every `VECTOR` node in it carries fills
and a bounding box but **no path data**. That covers the two cyan wave dividers, the hero underline
flourish, the double chevron scroll cue and the curved-text baselines — the exact shapes you would
otherwise have to trace by hand off a raster render.

```bash
node scripts/figma-geometry.mjs          # -> docs/figma/raw/nodes-geometry.json
```

Kept as a **separate file** on purpose: `geometry=paths` inflates the payload several-fold, and
`nodes.json` is the one you grep constantly for measurements — it stays lean. Open the geometry
file only when a shape has to be reproduced exactly.

> This hits `/v1/files/:key/nodes`, not the image *render* endpoint — but the 429 budget is shared
> across the file, so it can still be rate-limited right after a render run. The script backs off
> in minutes and is a no-op if the output already exists.

---

## Responsive strategy (the design is desktop-only — you must invent the rest)

Figma gives you **one 1920px frame**. There are no tablet or mobile frames. Reconstructing those
faithfully is a core part of what is being graded, so decide deliberately:

| Breakpoint | Width | Approach |
|---|---|---|
| Mobile | 320 – 767 | Single column. Hamburger nav. Type ~0.55×. Stack all card grids. Hide/simplify heavy decorative art. Reduce section padding ~50%. |
| Tablet | 768 – 1023 | 2-col card grids. Type ~0.7×. Side-by-side blocks may stack. |
| Laptop | 1024 – 1439 | 3-col grids. Type ~0.85×. Near-final layout. |
| Desktop | 1440 – 1919 | Design layout, container `max-w-[1680px]`. |
| Wide | 1920+ | Cap the container; let full-bleed art extend edge to edge. |

**Rules that keep it honest at every width:**

- Content container `max-w-[1920px] mx-auto px-5 md:px-10 xl:px-[120px]`. ⚠️ The cap is the
  **outer** box, not the content width: 12 × 118 + 11 × 24 = **1680 of content** sitting *inside*
  120px margins. Capping the outer box at 1680 as well leaves only 1440 of content at 1920 and
  silently narrows every section by 240px.
- Full-bleed decorative bands break out of the container; **content never does**.
- Cards stack `1 → 2 → 3` columns.
- Fluid type via `clamp()`, not a pile of breakpoint overrides.
- **Never allow horizontal overflow.** The absolutely-positioned decorative art is the usual
  culprit — clip it with `overflow-hidden` on its section.
- Tap targets ≥ 44×44px.
- Respect `prefers-reduced-motion` for every animation added in Phase 2.
