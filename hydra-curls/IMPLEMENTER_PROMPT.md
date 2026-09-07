# Kickoff prompt — Assignment 1 (landing page) implementer

Start a Claude Code session with **`D:\Prep\Moksha\hydra-curls`** as the working directory,
then paste everything in the box below.

---

```
You are implementing Assignment 1 of a two-part technical interview assignment.

Read these four files before writing any code:
  1. CLAUDE.md                          - your standing rules
  2. PLAN.md                            - your full brief and phase plan
  3. ../docs/figma/DESIGN_SPEC.md       - design tokens, section map, and four critical traps
  4. ../docs/ASSIGNMENT_BRIEF.md        - what is being graded

Task: convert a 1920x15249px Figma landing page (Parachute Advanced "Hydra Curls") into a
pixel-close, fully responsive React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui application.

The Figma extraction is already done for you. Do not re-run it unless something is missing:
  ../docs/figma/raw/nodes.json            full node tree (measure from this, do not eyeball)
  ../docs/figma/reference/full-page.png   full-page reference render
  ../docs/figma/reference/slices/         15 per-section slices - USE THESE
  ../docs/figma/reference/sections/       30/47 per-node renders - supplementary only
  public/assets/figma/                    all 95 image assets

DESTRUCTIVE COMMANDS - this directory was already destroyed once by
`npm create vite@latest . -- --template react-ts --overwrite`. That flag empties the
directory rather than merging. Never pass --overwrite, --force or -f to a scaffolder in a
populated directory. Scaffold into a temp dir and copy in. Commit BEFORE running any tooling.

Four traps that will cost you the assignment if you miss them (details in DESIGN_SPEC.md):
  1. The Figma file has NO auto-layout - 47 flat, absolutely-positioned, overlapping nodes.
     Derive sections from the y-coordinate map and rebuild them semantically with flow layout.
     Do NOT mirror the node tree into absolutely-positioned divs.
  2. Gotham is a paid font -> substitute Montserrat (350->400, 400->500, 300->300).
  3. Guthen Bloots is personal-use-licensed -> substitute Caveat or similar.
  4. Curved text is stored one node per glyph (192 nodes) -> rebuild as SVG <textPath>.

Order of work, and this is a hard constraint from the user:
  PHASE 1 = the exact static design, all 16 sections, fully responsive. NO animations.
  PHASE 2 = animations and polish, only after Phase 1 exit criteria are met.
  PHASE 3 = README + deploy.
  Run all three continuously without stopping. Do not add "just a quick fade-in" in Phase 1.

Quality bar, in the user's words: "Don't think about timelines. We need to do THE BEST. It can
take any time. Just do it really, really, really well." Optimize for quality and for being able
to defend every decision in a live interview, not for speed.

Working method:
  - Build primitives first (Container, Section, Picture, Eyebrow, SectionHeading, BrandButton,
    Chip, WaveDivider, CurvedText, StatBlock), then compose sections from them.
  - All copy lives in src/content/*.ts as typed data. No strings in JSX.
  - All colors are @theme tokens in src/styles/globals.css. No raw hex in components.
  - One section at a time: build, verify at 320/375/768/1024/1440/1920, commit, update
    PROGRESS.md. Do not batch all 16 and debug at the end.

Stop only for: something that genuinely blocks you, or the Vercel deploy which needs my account.
```

---

## Notes for you (the user), not for the implementer

- The extraction has already run. Section references are the **15 slices**, which cover the whole
  page. The per-node `sections/` folder is only 30/47 (Figma rate-limits renders) — treat it as
  supplementary.
- If anything Figma-related is missing:
  `node scripts/figma-extract.mjs` then `python scripts/slice_reference.py`
- **2026-09-07 incident:** this directory was wiped by `--overwrite`. Everything was restored from
  the admin session's context. The prompt above now warns about it explicitly.
