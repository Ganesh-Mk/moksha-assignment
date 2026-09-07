# Assignment 1 — Hydra Curls · Implementation Plan

**You are the implementer for Assignment 1.** This document is your brief. Read it fully, then
read `../docs/figma/DESIGN_SPEC.md` and `../docs/ASSIGNMENT_BRIEF.md` before writing code.

**Goal:** convert a 1920 × 15249px Figma landing page into a pixel-close, fully responsive,
high-performance React + TypeScript application.

**Quality bar (user's words):** *"Don't think about timelines. We need to do THE BEST. It can take
any time. Just do it really, really, really well."*

**Sequencing (explicit user instruction):** *"First let's do the exact Figma design, then we'll add
the animations and stuff."*
→ **Phase 1 is static fidelity. Do not add animations until Phase 1 is complete.**

---

## Already done for you (by the admin session)

| Thing | Where |
|---|---|
| Figma token verified working | `../.env` (gitignored) |
| Full design spec — tokens, fonts, section map, warnings | `../docs/figma/DESIGN_SPEC.md` |
| Extraction script (tested, resumable) | `scripts/figma-extract.mjs` |
| Local slicer (zero API calls) | `scripts/slice_reference.py` |
| Full node tree | `../docs/figma/raw/nodes.json` |
| Full-page reference render | `../docs/figma/reference/full-page.png` |
| **Per-section reference slices (15, complete)** | **`../docs/figma/reference/slices/`** ← use these |
| Per-node renders (30/47, partial) | `../docs/figma/reference/sections/` — supplementary only |
| All 95 image assets | `public/assets/figma/` |

If any of those are missing:
```bash
node scripts/figma-extract.mjs        # tree + assets (resumable, skips existing)
python scripts/slice_reference.py     # regenerate slices locally, zero API calls
```

**The four traps, in one place** (full detail in the design spec — do not skip it):

1. **No auto-layout in the file.** 47 flat, absolutely-positioned, overlapping nodes. Derive
   sections from the y-map; rebuild semantically. Never mirror the node tree.
2. **Gotham is a paid font** → substitute **Montserrat** (350→400, 400→500, 300→300).
3. **Guthen Bloots is personal-use-only** → substitute a Google handwriting font (`Caveat` etc.).
4. **Curved text is stored one node per glyph** (192 of them) → rebuild as SVG `<textPath>`.

---

## Stack

| Concern | Choice | Why (be ready to say this out loud) |
|---|---|---|
| Build | **Vite 6** | Assignment wants a React *page*, not a full-stack framework. Vite is the fastest correct tool; Next.js would be unjustified weight for one static page. |
| Framework | **React 19 + TypeScript (strict)** | Required by the brief. |
| Styling | **Tailwind CSS v4** | Required. v4 CSS-first config (`@theme`) maps design tokens directly to CSS vars — a clean story for "how did you translate the design system?" |
| Components | **shadcn/ui** | Required "where appropriate". Use it for real primitives (Button, Card, Accordion, Sheet, Carousel, Input). Do **not** shoehorn it into bespoke marketing layouts — the brief says *where appropriate*, and knowing where it is not appropriate is the point. |
| Icons | **lucide-react** | Ships with shadcn. Tree-shakes. |
| Animation (Phase 2) | **Motion** (`motion/react`) | Successor to Framer Motion. Hardware-accelerated, respects reduced motion. |
| Fonts | `@fontsource-variable/montserrat`, `@fontsource/kaushan-script`, `@fontsource/caveat` | Self-hosted → no render-blocking third-party request, no CLS, no privacy issue. Better Lighthouse than `<link>` to Google. |
| Lint/format | ESLint (flat) + Prettier + `prettier-plugin-tailwindcss` | Class-order consistency matters when a reviewer reads 16 section files. |
| Deploy | **Vercel** | Confirmed. |

---

## Target structure

```
hydra-curls/
├── public/
│   ├── assets/figma/          # raw extracted (imageRef names) — gitignored
│   └── assets/optimized/      # WebP/AVIF you generate — these ship, these commit
├── scripts/
│   ├── figma-extract.mjs      # done
│   ├── slice_reference.py     # done
│   └── optimize-images.mjs    # you write (sharp)
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn — generated, don't hand-edit
│   │   ├── layout/            # Navbar, Footer, AnnouncementTicker, Container, Section
│   │   ├── primitives/        # BrandButton, Eyebrow, SectionHeading, Chip, Badge,
│   │   │                      #   StatBlock, WaveDivider, CurvedText, ScrollCue, Picture
│   │   └── sections/          # one file per section, in page order
│   ├── content/               # ALL copy as typed consts — no strings in JSX
│   ├── hooks/                 # useMediaQuery, useReducedMotion, useScrollProgress
│   ├── lib/                   # cn(), image helpers
│   ├── styles/globals.css     # @theme tokens live here
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── PLAN.md         # this file
├── PROGRESS.md     # you maintain — update after every section
├── CLAUDE.md       # your standing rules
└── README.md       # deliverable
```

**Rule: content is data, never hardcoded in JSX.** Every card list, chip list, nav item, and
testimonial goes in `src/content/*.ts` as a typed array; sections map over it. This is the single
clearest signal of "reusable and well-structured components" — a criterion they grade explicitly.

---

## Phase 1 — Exact static design (do this first, all of it)

### 1.1 Scaffold
- Vite + React + TS. **Do not use `--overwrite` in this populated directory** — scaffold into a
  temp dir and copy in, and commit before you start.
- Tailwind v4 (`@tailwindcss/vite`), `shadcn init`, ESLint + Prettier, path alias `@/*`.
- `tsconfig`: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`.

### 1.2 Design tokens → `src/styles/globals.css`
Encode the spec's palette and type scale as Tailwind v4 `@theme` variables:
`--color-brand-cyan: #00D5FD`, `--color-brand-purple: #76468A`, `--color-ink: #040C1E`, etc.
**Never write a raw hex in a component.** A reviewer scanning for design-system discipline checks
exactly this.

Set up the fluid type scale with `clamp()` here too (`--text-h2`, `--text-display`, …), so sections
never carry breakpoint-specific font sizes.

### 1.3 Asset optimization — `scripts/optimize-images.mjs`
With `sharp`: for each used asset emit AVIF + WebP + PNG fallback at 1x/2x, record intrinsic
dimensions, write a manifest. Build a `<Picture>` component that consumes the manifest so every
image gets correct `width`/`height` (→ zero CLS) and `loading="lazy"` below the fold.

Rename assets meaningfully as you go — cross-reference `fills[].imageRef` in `nodes.json` to find
where each one is used. `hero-bottle.avif` beats `a3f9c2...avif` for anyone reading the repo.

### 1.4 Primitives before sections
Build `Container`, `Section`, `Picture`, `Eyebrow`, `SectionHeading`, `BrandButton`, `Chip`,
`WaveDivider`, `CurvedText`, `StatBlock` **first**. Every section then composes them. Building
sections first guarantees duplication you will have to unpick later.

### 1.5 Sections — in page order, one at a time
For each of the 16 sections in the design spec map:
1. Open its reference slice in `../docs/figma/reference/slices/`.
2. Read exact values from `nodes.json` (positions, sizes, colors, spacing) — measure, don't eyeball.
3. Build it with flow layout + the primitives.
4. Verify at **320 / 375 / 768 / 1024 / 1440 / 1920**.
5. Commit (`feat(hero): ...`) and update `PROGRESS.md`.

**Do not batch all 16 then debug.** One section, verified, committed, then the next.

### 1.6 Responsive pass
Full sweep at every breakpoint. Zero horizontal scroll anywhere — check with:
```js
document.querySelectorAll('*').forEach(e => {
  if (e.scrollWidth > document.documentElement.clientWidth)
    console.log('OVERFLOW:', e);
});
```
Real mobile nav (shadcn `Sheet`), 44px tap targets, no clipped text, no overlapping art.

### 1.7 Fidelity review
Screenshot your build full-page, put it beside `full-page.png`, and walk down them together.
Fix every visible discrepancy in spacing, weight, and color. **This is the top-weighted criterion —
budget real time for it, not a token pass.**

### ✅ Phase 1 exit criteria
- [ ] All 16 sections built and visually matching
- [ ] Perfect at 320 / 375 / 768 / 1024 / 1440 / 1920, no horizontal scroll
- [ ] Zero raw hex outside `globals.css`
- [ ] Zero copy strings in JSX
- [ ] `tsc --noEmit` clean, ESLint clean, no `any`
- [ ] Lighthouse desktop + mobile ≥ 95 across the board
- [ ] All images optimized, explicit dimensions, lazy below fold
- [ ] Semantic HTML, one `<h1>`, ordered headings, all images have alt text
- [ ] Keyboard-navigable with visible focus rings

---

## Phase 2 — Motion & polish (only after Phase 1 exit criteria are met)

The design is a long scroll page — motion is what makes it feel finished. Keep it tasteful; this is
a premium beauty brand, not a demo reel.

**Priority order:**
1. **Scroll reveals** — sections fade+rise on entry, `IntersectionObserver` or Motion's `whileInView`. Stagger children ~60ms. Once only, never re-trigger.
2. **Hero entrance** — headline word-by-word, chevron loop, subtle gradient drift.
3. **Parallax** — decorative art (leaves, splashes, bottles) at 0.85–1.15× scroll rate. Subtle. Transform-only.
4. **Count-up stats** — the giant `48`, and `05 / 48h / 0` in the final CTA, animate on entry.
5. **Micro-interactions** — button hover lift + cyan glow, card hover raise, nav underline sweep, image zoom-on-hover in cards.
6. **Sticky nav** — transparent over hero → solid on scroll, hide-on-scroll-down / show-on-up.
7. **Curved-text draw-on** — if it stays cheap.
8. **Scroll progress bar** in the brand cyan.

**Hard rules for every animation:**
- `transform` and `opacity` only. Never animate `width`/`height`/`top`/`left`.
- `prefers-reduced-motion: reduce` → everything becomes instant. Non-negotiable, and a
  strong accessibility signal.
- Nothing may cause layout shift. Re-run Lighthouse after Phase 2 — **CLS must stay ~0**.
- If a Lighthouse score drops below 95, the animation is wrong. Fix or cut it.

---

## Phase 3 — Ship

1. `README.md` — screenshots, stack + *why*, setup steps, the font-substitution note, responsive
   approach, performance numbers (with Lighthouse screenshot), **AI tools used and how**, time taken.
2. Deploy to Vercel; put the live URL in the README.
3. Final `PROGRESS.md` update.

---

## Definition of done

- Live Vercel URL, loads fast, looks like the Figma
- Lighthouse ≥ 95 × 4 on mobile and desktop
- Flawless at every breakpoint
- A reviewer can open any file and immediately understand it
- You can explain every dependency and every architectural choice in one sentence each
