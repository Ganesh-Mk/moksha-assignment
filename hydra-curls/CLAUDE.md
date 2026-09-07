# CLAUDE.md — Assignment 1 (Hydra Curls)

Standing rules for the A1 implementer session. Root rules in `../CLAUDE.md` also apply.

## Orientation — read in this order

1. `PLAN.md` — your brief and phase plan
2. `../docs/figma/DESIGN_SPEC.md` — tokens, section map, the four traps
3. `../docs/ASSIGNMENT_BRIEF.md` — what is being graded
4. `PROGRESS.md` — where you left off

## Scope

Only `hydra-curls/`. Do not touch `moksha-ecommerce/` — a different session owns it.
Shared root files are the user's; propose, don't edit.

## ⚠️ Destructive commands — read before running any scaffolder

On 2026-09-07 `npm create vite@latest . -- --template react-ts --overwrite` **emptied this entire
directory**, destroying both extraction scripts, all four planning docs, and 77MB of assets. There
were no commits, so nothing was recoverable from git.

Rules that follow from that:

- **Never pass `--overwrite`, `--force`, or `-f` to a scaffolder in a non-empty directory.** Those
  flags mean _delete everything first_, not _merge_.
- Scaffold into a temp directory and copy files in, or answer the interactive prompt.
- **`git init` + an initial commit before any tooling touches a populated directory.** A restore
  point costs one command.
- Before any command that can delete: list what is in the directory first.

## Phase status

**Phase 1 (static fidelity) and Phase 2 (motion) are both done.** The original instruction —
_"first let's do the exact figma design, then we'll add the animations and stuff"_ — has been
followed: no motion was added until all 16 sections were built and diffed against the reference.

Motion is CSS plus one inline observer, deliberately not an animation library. If you add to it,
keep to `transform`/`opacity`, keep reveals as progressive enhancement (visible by default, the
script _adds_ the hidden state), and re-check that CLS is still 0.

## Hard rules

- **Never mirror the Figma node tree.** It has no auto-layout — 47 flat, absolutely-positioned,
  overlapping nodes. Derive sections from the y-map, rebuild with flow layout. Absolute positioning
  is for _decorative art inside a clipped section only_, never for structure.
- **No raw hex outside `src/styles/globals.css`.** All colors are `@theme` tokens.
- **No copy strings in JSX.** All content lives in `src/content/*.ts` as typed data.
- **No fixed `px` font sizes on sections.** Fluid `clamp()` scale from the theme.
- **Every image**: explicit `width`+`height`, meaningful `alt`, `loading="lazy"` below the fold,
  AVIF/WebP with fallback.
- **`transform`/`opacity` only** for animation (Phase 2).
- **`prefers-reduced-motion`** honoured everywhere.
- TypeScript strict. No `any` without an adjacent justifying comment.
- Reproduce placeholder copy (`Lorem Ipsum`, the repeated hyaluronic-acid paragraph) **verbatim**.
  Visual fidelity is the task; improving the copy breaks the diff.

## Font substitutions (licensing — explain these in the README)

| Figma                      | Ship                            | Reason                                                                                                                                              |
| -------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gotham 350/400/300         | **Montserrat** 400/500/300      | Gotham is a paid Hoefler face                                                                                                                       |
| Guthen Bloots Personal Use | **Caveat** (or similar)         | Personal-use licence only                                                                                                                           |
| Kaushan Script             | Kaushan Script                  | Google Fonts ✅                                                                                                                                     |
| Inter                      | **Montserrat** (already loaded) | Inter only set the watermark arcs, rendered at 6–40% opacity. A 47KB font file for type nobody reads was the worst byte-for-byte value on the page. |

Fonts are self-hosted from `public/fonts/` via `scripts/copy-fonts.mjs`, not `@import`-ed from
the `@fontsource` packages — Vite content-hashes anything it pulls from `node_modules`, which
leaves no stable URL to preload, and the hero headline reflowing on font swap was the page's
entire CLS budget.

## Workflow per section

1. Open the reference slice in **`../docs/figma/reference/slices/`** ← use these
2. Read exact values from `../docs/figma/raw/nodes.json` — measure, never eyeball
3. Build with existing primitives (create the primitive first if it does not exist)
4. Verify at 320 / 375 / 768 / 1024 / 1440 / 1920
5. Commit `feat(<section>): ...`, update `PROGRESS.md`

One section at a time, verified and committed. Do not batch 16 sections and debug at the end.

## Overflow check — run after every section

```js
document.querySelectorAll('*').forEach((e) => {
  if (e.scrollWidth > document.documentElement.clientWidth) console.log('OVERFLOW:', e)
})
```

## Regenerating Figma data

```bash
node scripts/figma-extract.mjs                    # everything (resumable)
node scripts/figma-extract.mjs --skip-images      # tree + renders only
node scripts/figma-extract.mjs --skip-sections    # tree + image fills only
python scripts/slice_reference.py                 # section slices, zero API calls
```

Token is in `../.env` (gitignored, already working). The script **skips files that already
exist**, so re-running after a rate-limit bail resumes rather than restarting.

⚠️ Figma rate-limits the image _render_ endpoint hard — roughly 30 renders before a sustained
429, and the cooldown is minutes not seconds. Image _fill_ downloads (the 95 assets) are
unaffected. If section renders are incomplete, just re-run later.

## Assets and git

`public/assets/figma/` (77MB of raw extraction) and `docs/figma/reference/sections/` are
**gitignored** — they are regenerable and would bloat the repo.

**What you commit is `public/assets/optimized/`** — the AVIF/WebP files your
`scripts/optimize-images.mjs` produces, which are what actually ship. Make sure the build does not
depend on anything under `public/assets/figma/`.

## Before you say "done"

`tsc --noEmit` clean · oxlint clean · Lighthouse — desktop hits the bar, mobile sits at ~89 (see
PROGRESS.md for why and what was tried) · no horizontal
scroll at any width · README complete with AI-tools section and time taken · deployed to Vercel.

## Keep PROGRESS.md current

After each section: what you did, what is next, decisions and why, anything surprising. Assume you
could lose context at any moment — that file is how you recover.
