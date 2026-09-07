# Progress — Assignment 1 (Hydra Curls)

> Maintained by the A1 implementer. Update after every section. Assume you may lose context
> at any moment — this file is how you recover.

## Status
**Phase 0 — scaffolding.** Directory was wiped and restored on 2026-09-07 (see Incidents).

## Done (admin session, 2026-09-07)
- Figma token verified; REST API access confirmed on the view-only file
- Design spec written: `../docs/figma/DESIGN_SPEC.md`
- Extraction script written + tested: `scripts/figma-extract.mjs` (resumable)
- Local slicer: `scripts/slice_reference.py` (zero Figma API calls)
- `../docs/figma/raw/nodes.json` — full node tree
- `../docs/figma/raw/image-refs.json` — imageRef map
- `../docs/figma/reference/full-page.png` — 960×7625 reference render
- `../docs/figma/reference/slices/` — **15 section slices covering the whole page (complete)**
- `../docs/figma/reference/sections/` — 30/47 per-node renders (partial, supplementary only)
- `public/assets/figma/` — 95 image assets

## Next
1. Re-read `CLAUDE.md`, `PLAN.md`, `../docs/figma/DESIGN_SPEC.md`
2. **Commit immediately** — establish a restore point before any tooling runs again
3. Scaffold Vite + React 19 + TS strict + Tailwind v4 + shadcn (no `--overwrite`)
4. Encode design tokens in `src/styles/globals.css`
5. Build primitives, then sections in page order

## Section checklist (Phase 1)
- [x] 1. Navbar — logo, centred links, Sheet below `lg`
- [ ] 2. Announcement ticker
- [x] 3. Hero — raster bg, gradient-clip headline, derived white logo, flourish, scroll cue
- [x] 4. Wave divider — primitive, reused at y4273
- [x] 5. New Launch — copy column, 3 badges, 2 CTAs, tilted bottle + splash + leaf
- [x] 6. Brand key visual — full-bleed campaign raster, transcribed alt text
- [x] 7. Benefit cards — two full-bleed 948px cards, 2% wavy texture, composed product lineup
- [ ] 8. Product showcase
- [ ] 9. Curved script arc
- [ ] 10. Hydra Curls Promise
- [ ] 11. Premium Ingredients
- [ ] 12. Testimonials
- [ ] 13. Experts Saying
- [ ] 14. Designed for You
- [ ] 15. Learn & Grow
- [ ] 16. Final CTA + Footer

## Decisions log
| Date | Decision | Why |
|---|---|---|
| 2026-09-07 | Vite over Next.js | Single static page; Next.js weight is unjustifiable here |
| 2026-09-07 | Montserrat replaces Gotham | Gotham is a paid Hoefler face; Montserrat is the standard free equivalent |
| 2026-09-07 | Caveat replaces Guthen Bloots | Guthen Bloots is personal-use-licensed |
| 2026-09-07 | SVG textPath for curved text | Figma stores it as 192 per-glyph nodes; textPath stays crisp and scalable |
| 2026-09-07 | Slices over per-node renders | Figma rate-limits rendering; slicing full-page.png is unlimited and shows sections in context |
| 2026-09-07 | ProductShowcase is its own section | Component 12 (y5319–6698) is separate from Benefit cards; the render is more authoritative than the prose map |

## Incidents
**2026-09-07 — directory wiped by `npm create vite --overwrite`.**
`--overwrite` empties the target directory rather than merging. `hydra-curls/` was destroyed:
both scripts, all four planning docs, and 77MB of assets. No commits existed, so git could not
recover anything.

Restored by the admin session from context, verbatim: `CLAUDE.md`, `PLAN.md`, `PROGRESS.md`,
`IMPLEMENTER_PROMPT.md`, `scripts/figma-extract.mjs`, `scripts/slice_reference.py`. Assets
re-downloaded. `hydra-curls/docs/` was an **empty directory** — nothing was lost there.
All of `../docs/` was outside the blast radius and survived intact.

**Rules added to `CLAUDE.md` as a result:** never pass `--overwrite`/`--force` to a scaffolder in a
populated directory; commit before running tooling; list a directory before running anything that
can delete.

## Verification harness
`node scripts/shoot.mjs` screenshots the dev server at 320/375/768/1024/1440/1920 and reports,
per width: horizontal overflow (with a selector for the offending element), tap targets under
44px, and the heading outline. `--w`, `--clip`, `--out` narrow it to one section.
`node scripts/inspect-node.mjs "<name>" | <yFrom> <yTo>` prints a measured subtree of the Figma
frame — positions, fills, gradients, type styles — so section work reads from the file rather
than from a render.

## Blocked / waiting
- **The `C:` drive is 100% full (0 bytes free).** This broke Node with an out-of-memory crash and
  stops Chrome launching for Lighthouse ("Storage.getUsageAndQuota: Quota information is not
  available"). Clearing this session's scratchpad freed only 130MB. The repo itself is on `D:`
  (65GB free) so building and committing still work — but **the final Lighthouse numbers could not
  be re-measured after `content-visibility` was removed.** Needs the user to free space on `C:`.
- Nothing.

## Notes & surprises
- The Figma file has **no auto-layout** — 47 flat, absolutely-positioned, overlapping top-level
  nodes. Structure must be derived from y-coordinates, not from node nesting.
- Figma rate-limits the image *render* endpoint hard (~30 renders before a sustained 429, cooldown
  in minutes). The extract script is resumable. Image *fill* downloads are unaffected.
- `nodes.json` was fetched without `geometry=paths`, so VECTOR nodes carry fills but no path data.
  Re-fetch with that flag into a **separate** file (`nodes-geometry.json`) to get exact wave and
  flourish paths — do not overwrite the lean `nodes.json`.
