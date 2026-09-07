# Moksha — AI Full Stack Developer Technical Assignment

Monorepo holding **two independent deliverables** for one submission.

| Folder | Assignment | Stack |
|---|---|---|
| `hydra-curls/` | **A1** — Figma → responsive React page | React 19 + TS + Vite + Tailwind v4 + shadcn/ui |
| `moksha-ecommerce/` | **A2** — Mini AI e-commerce | React+TS front, FastAPI+Postgres back, LangGraph agent |

Source brief: `docs/AI Full Stack Developer Technical Interview Assignment.pdf`
Distilled requirements + scoring rubric: `docs/ASSIGNMENT_BRIEF.md`

---

## Working agreement (applies to BOTH assignments)

### Roles
The user runs **one Claude implementer per assignment**, in separate sessions. Stay in your own
folder. Do not edit the other assignment's files. Shared/root files (`.gitignore`, `.env.example`,
root `CLAUDE.md`, root `README.md`) are the user's — propose changes, don't make them unilaterally.

### The bar
> "Don't think about timelines. We need to do THE BEST. It can take any time. Just do it really,
> really, really well."

Quality over speed. This is an interview artifact that will be **read by a human reviewer and
defended live in an interview**. Two consequences:

1. **Every decision must be explainable.** No copy-pasted magic. If you add a library, you must be
   able to say why in one sentence. Prefer boring, defensible choices over clever ones.
2. **Comments explain _why_, never _what_.** The reviewer can read the code. They cannot read your
   reasoning about idempotency, race conditions, or authz.

### Non-negotiables
- **TypeScript strict mode on.** No `any` without an adjacent comment justifying it.
- **No secrets in git.** Everything through env vars. `.env` is gitignored; keep `.env.example` in
  sync whenever you add a variable.
- **No dead code, no commented-out blocks, no TODO left at the end.** Track open work in your
  folder's `PROGRESS.md`, not in source.
- **Conventional commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`), scoped small and
  logically. Commit history is part of what gets reviewed — it should read like a story.
- **Accessibility is not optional.** Semantic HTML, keyboard-reachable interactives, visible focus
  rings, alt text, correct heading order, `prefers-reduced-motion` respected.

### Keep yourself updated
Each assignment folder has its own `CLAUDE.md` (rules) and `PROGRESS.md` (running state).
**After each meaningful chunk of work, update `PROGRESS.md`**: what's done, what's next, decisions
made and why, anything that surprised you. If you learn something that changes the rules, update
your folder's `CLAUDE.md`. Assume you may lose context at any point — these files are how you
recover.

---

## Environment (verified 2026-09-07)
Node v22.18.0 · npm 11.6.2 · Python 3.12.7 · git 2.53.0 · Docker 28.3.3
`gh` CLI **not installed** — user handles GitHub repo creation.
Platform: Windows 11. Shell: PowerShell primary, Git Bash available.

**Windows gotchas** — these will bite you:
- Use forward slashes in config/paths where possible.
- PowerShell has no `&&`. Use `;` + `if ($?)`, or use the Bash tool.
- Long paths: keep directory nesting shallow.
- Set `git config core.autocrlf false` to avoid CRLF churn in diffs.

## Secrets
Real values live in `D:\Prep\Moksha\.env` (gitignored). **Currently populated:** `FIGMA_TOKEN`,
`FIGMA_FILE_KEY`. Everything else (Google OAuth, Stripe, Anthropic, DB) is **pending** — the user
will supply them after implementation. Build against `.env.example` and fail loudly with a clear
message when a var is missing; never silently no-op.

## Deployment targets
- Both frontends → **Vercel**
- FastAPI backend → **Render** (Docker, free tier)
- Postgres → **Neon** free tier
- Known limitation to document: Render free tier cold-starts (~50s) after ~15 min idle. Ship a
  `/health` endpoint so the demo can be warmed before the interview.

## Final submission checklist (root `README.md` is the index)
- [ ] GitHub repository, clean history
- [ ] Live URL — A1 page
- [ ] Live URL — A2 app (+ backend `/docs`)
- [ ] README with setup instructions (root + per assignment)
- [ ] Database schema doc
- [ ] API documentation
- [ ] One-page system design + scaling write-up
- [ ] AI tools used + how
- [ ] Total time taken
- [ ] Seeded demo accounts (1 customer, 1 admin) + Stripe test card documented
