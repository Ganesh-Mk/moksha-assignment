# Progress — Assignment 1 (Hydra Curls)

> Maintained by the A1 implementer. Assume you may lose context at any moment — this file is how
> you recover.

## Status

**Phases 1–3 complete, plus a review round against the deployed site.**

**Live: <https://moksha-hydra-curls.vercel.app>**

|         | Performance | Accessibility | Best practices | SEO |
| ------- | ----------- | ------------- | -------------- | --- |
| Desktop | 98–99       | **100**       | 100            | 100 |
| Mobile  | 92–99       | **100**       | 100            | 100 |

LCP 1.0s desktop / 2.3s mobile · **CLS 0** · page 15,250px against Figma's 15,249 · no horizontal
scroll and no sub-44px tap target at 320/375/768/1024/1440/1920.

Mobile perf reads 87–89 when another heavy process shares the machine and 98–99 when it does not;
LCP and CLS are stable either way. The earlier "mobile is stuck at 89" conclusion was mostly
measuring CPU contention, not the page.

## Review round (fixes against the deployed build)

Twelve issues raised off screenshots of the live site. What each turned out to be:

| #   | Reported                                             | Actual cause                                                                                                                                                                                                  |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Progress bar vanished with the navbar                | The bar was a _child_ of the sliding header, so it rode up with it. Now a sibling of the sliding element, and it travels to the top of the viewport when the bar hides.                                       |
| 2   | Carousel glow cut off at top and sides               | The halo was inside each slide, where the carousel's own `overflow-hidden` sliced the blur into a rectangle. One glow on the section behind it — the carousel is centre-aligned, so the lit spot never moves. |
| 3   | Arc section "looks weird"                            | The reference puts the script on a pale cyan field that hands over to white along a curve. It was rendering on flat white, so the line floated in a gap.                                                      |
| 4   | Clock not animating                                  | It was two flat PNGs with the hands baked in. Redrawn as SVG: the hands sweep, the long one every 4s and the short one every 48s.                                                                             |
| 5   | Section edges straight, should have "design borders" | Real fidelity miss — several boundaries in the reference are soft curves. Added a `SoftWave` primitive and applied it.                                                                                        |
| 6   | Ingredient card hover "fluctuating"                  | The `<li>` carried both `data-reveal` and the hover transform. Both animate `transform`, so the hover inherited the reveal's 0.7s duration _and_ its stagger delay. Split onto separate elements.             |
| 7   | Only two identical reviews                           | Figma ships one quote twice, so the design's own buttons were permanently disabled. Four more authored; the viewport is now a measured window showing two whole cards and a faded peek at the third.          |
| 8   | Hair-type hover "awful"                              | A flat blue block with **no transition classes at all** — the utilities set the end state and nothing described getting there. Now a scrim plus a blurred dark-glass panel on a 500ms ease.                   |
| 9   | Explore Now needs a hover                            | Sweeping underline and a travelling arrow, shared with `BrandButton`'s link variant.                                                                                                                          |
| 10  | Stat numbers not counting up                         | The count-up registered its observer at script time, inside `<head>`, where the body does not exist — it matched zero elements every load. Moved onto the same DOM-ready gate the reveals use.                |
| 11  | Hover shadows "awful"                                | A full-strength cyan halo, which at button scale reads as a selection state. Now a 1px lift and a low-opacity neutral shadow.                                                                                 |
| 12  | Navbar colour clashes with hero                      | Transparent over the hero, solid as soon as you scroll.                                                                                                                                                       |

Accessibility went 96 → **100** in the process: the hair-type panel rewrite removed six
white-on-blue failures, and the last one — the "Hours" tag at 1.75:1 — was fixed by flipping the
label to ink instead of darkening the tag, so the brand cyan is reproduced exactly.

Mobile performance also improved: two fewer image requests (the clock) and no per-slide blur.

### Verified, not assumed

- Two whole testimonial cards at 375/768/1024/1280/1440/1920 — the window heights are measured
  from the tallest card at each width, not guessed.
- All five product names render the same box height at every breakpoint, so autoplay swapping the
  caption cannot shift the page.
- Progress bar visible in all three navbar states; navbar transparent at top, solid when scrolled,
  hidden on scroll-down, restored on scroll-up.
- CLS 0 across four consecutive runs after the changes.

---

## Section checklist

- [x] 1. Navbar — logo, centred links, Sheet below `lg`, sticky with hide-on-scroll
- [x] 2. Announcement ticker — see "Deliberate deviations"
- [x] 3. Hero — raster bg, gradient-clip headline, derived white logo, flourish, scroll cue
- [x] 4. Wave divider — primitive, reused before the product showcase
- [x] 5. New Launch — copy column, 3 badges, 2 CTAs, tilted bottle + splash + leaf
- [x] 6. Brand key visual — full-bleed campaign raster, transcribed alt text
- [x] 7. Benefit cards — two full-bleed 948px cards, 2% wavy texture, composed product lineup
- [x] 8. Product showcase — circle-underside band, shadcn Carousel, thumbnails
- [x] 9. Curved script arc — 48 glyph nodes → one SVG `<textPath>`
- [x] 10. Hydra Curls Promise — wavy rule, feature list, 48-hour stat with rotated tag
- [x] 11. Premium Ingredients — 3 tinted-glass cards, 9 chips, 5 trust badges, watermark arc
- [x] 12. Testimonials — full-bleed model, before/after seam, vertical quote carousel
- [x] 13. Experts Saying — 8-tile edge-to-edge grid from 4 mirrored assets
- [x] 14. Designed for You — brand medallion, 3 hair-type cards, hover characteristics
- [x] 15. Learn & Grow — 3 alternating full-bleed rows, lapped colour panels
- [x] 16. Final CTA + Footer — navy band with 2×2 stat grid; labelled newsletter form

---

## Architecture

```
src/
├── components/{ui,layout,primitives,sections}
├── content/          every rendered string, typed; assets.generated.ts is the image manifest
├── styles/globals.css  the only file with a raw hex value or a font size
├── islands.tsx       the three components that hydrate
└── entry-server.tsx  build-time render
```

- **Content is data.** No copy string in JSX.
- **Colour and type are tokens.** Sections carry no breakpoint-specific font sizes.
- **The build prerenders to static HTML**, inlines the CSS, and defers the bundle to first idle or
  first interaction. Only three components hydrate.

### Tooling written for this

| Script                | Purpose                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `inspect-node.mjs`    | Prints a measured Figma subtree — positions, fills, gradients, type styles                     |
| `shoot.mjs`           | Screenshots 6 breakpoints; reports overflow (with selector), sub-44px targets, heading outline |
| `optimize-images.mjs` | AVIF/WebP ladder + typed manifest; resolves Figma's alpha/opaque twins                         |
| `copy-fonts.mjs`      | Lifts Latin woff2 out of @fontsource to a stable, preloadable path                             |
| `prerender.mjs`       | Injects prerendered HTML, inlines CSS, defers the bundle                                       |
| `figma-geometry.mjs`  | Re-fetch with `geometry=paths` (never landed — see Blocked)                                    |

---

## Bugs found by measuring, not by reading

1. **tailwind-merge silently dropped every section heading to 16px.** It does not recognise
   `text-h2` as a font size, so it filed it with colours and dropped it against `text-ink`. The
   `.text-h2` rule sat unused in the stylesheet. No error, no warning. `cn()` now uses
   `extendTailwindMerge` told about the custom scales.
2. **A fast scroll left 20 of 34 reveal elements permanently hidden.** IntersectionObserver samples
   at frame boundaries, so anything passing through the viewport between two frames never fires.
   Added an rAF-throttled sweep. Verified 34/34 under fast, slow and continuous scroll.
3. **The LCP element was stuck behind font loading.** The hero's `min-height` was on the inner
   column, so the band's height depended on how the headline wrapped, which depended on the
   webfont — and the background image, absolutely positioned to fill the section, could not be
   laid out until that font arrived. Moving one class to the `<section>` took ~0.7s off mobile LCP.
4. **An entire band was missing** — the cloud art and second wave divider between the benefit cards
   and the showcase. Found only by diffing against the reference render.
5. **The testimonial photo rendered at natural aspect.** Source is a 1024×1536 portrait; Figma's
   node is 1091×993, so the design crops hard to landscape. The band was ~2× its designed height.

### Twice fooled by my own harness

Chrome does not paint lazy images, or `content-visibility` content, in full-page screenshots. Both
times the page was perfectly fine and the capture was wrong. `shoot.mjs` now defeats both
behaviours before capturing and reports the real lazy/eager split separately, so the property is
still verified rather than hidden.

---

## Performance

What worked, in order of effect: prerendering → the hero min-height fix → self-hosted preloadable
fonts → dropping Inter (−47KB) → islands.

### Rejected after measuring

- **`content-visibility: auto`** on below-fold bands: ~3 mobile points, but offscreen bands are
  genuinely unrendered — full-page screenshots and print come out blank below the fold, and the
  scrollbar drifted. Bad trade for a page whose purpose is to be looked at.
- **A 5-rung srcset ladder** instead of 9: smaller HTML, but coarser gaps pushed phones onto
  larger renditions and LCP went **up ~1s**.
- **Code-splitting the carousels:** saved ~10KB, but on a prerendered page a lazy boundary puts a
  placeholder in the HTML and shifts layout when the chunk lands (CLS 0 → 0.067).

### Why mobile is ~89

The remaining cost is `styleLayout` — laying out a 15,000px document with 55 images. TBT is also
very sensitive to machine load; measurements on this machine swung 30–770ms between identical runs
with a second Claude session and VS Code competing for CPU. LCP (2.3s) and CLS (0) are stable.

---

## Motion (Phase 2)

CSS plus one ~60-line inline script. **No animation library** — Motion/Framer would be ~30KB and
more main-thread work on a page already dominated by style and layout.

Reveals are **progressive enhancement**: elements are visible by default, and the inline script
adds `.reveal-ready` before first paint to introduce the hidden state. If the script never runs
the page is simply fully visible. The hero is excluded — it holds the LCP, and an element at
opacity 0 is not contentful.

Count-up is vanilla for the same reason: those sections are static HTML and never hydrate, so a
React hook would never run. It preserves "48h" and "05" and leaves "0" alone.

---

## Deliberate deviations from the design

| What                                           | Why                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cyan **text** on pale backgrounds darkened     | `#00D5FD` as type on `#F3FDFF` measures 1.7:1. Two variants, split at WCAG's large-text threshold, so 54px heading accents keep the brand colour.                       |
| `--color-grey-500` `#737373` → `#666666`       | Clears 4.5:1 on white but only 4.2:1 on the `#DAF6FF` bands, which is where it mostly appears.                                                                          |
| Seven white-on-cyan contrast failures **kept** | They are the design's own palette. Recolouring whole brand bands was not done silently. This is why a11y is 96, not 100.                                                |
| Announcement ticker made visible               | Its text node sits at x1950 — off-canvas past the 1920 frame, invisible in the export. Rendered where it can be read.                                                   |
| Hair-type CHARACTERISTICS panel on hover       | Figma parks it _outside_ the card bounds and the reference render does not show it. Kept as a hover overlay, hidden with opacity so it stays in the accessibility tree. |

---

## Incidents

**Directory wiped by `npm create vite --overwrite`.** `--overwrite` empties the target rather than
merging. Both scripts, all four planning docs and 77MB of assets were destroyed with no commits to
recover from. Restored by the user verbatim. Rules added to `CLAUDE.md`; the first commit now
exists as a restore point.

**PROGRESS.md updates silently no-opped for most of the build.** Edits were applied with string
replacement against anchor text that no longer matched after the restore, and most had no
assertion, so they did nothing while being reported as done. This file was rewritten from the
commit history at the end. **If you edit this file programmatically, assert that the anchor
matched.**

---

## Blocked / waiting

- **`figma-geometry.mjs` never completed.** The Figma token stayed rate-limited (the 429 budget is
  shared with the image render endpoint, which the extraction had exhausted). Not blocking: the
  wave divider ships with a hand-traced path matching the reference. Re-run `npm run figma:geometry`
  for exact paths.
- The live Vercel URL still needs pasting into both READMEs.

---

## Notes

- The Figma file has **no auto-layout** — 47 flat, absolutely-positioned, overlapping nodes.
- Figma rate-limits the image _render_ endpoint hard (~30 renders, cooldown in minutes). Image
  _fill_ downloads are unaffected, and `image-refs.json` lets assets be re-fetched from S3 with
  **zero API calls**.
- The raw extraction lives in `assets-src/`, **not** `public/` — Vite copies `publicDir` verbatim,
  so 77MB of unserved PNGs were going into every deploy (dist was 110MB, now 22MB).
