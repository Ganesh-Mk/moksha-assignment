# Progress — Assignment 2 (Moksha AI E-Commerce)

> Update at every phase boundary. Assume context may be lost at any moment — this file is how the
> next session recovers.

## Status
**Phase 0 — planned, awaiting go-ahead to scaffold.** Nothing written to `backend/` or `frontend/`
yet.

## Done
- **2026-09-07 (admin session)** — requirements distilled (`../docs/ASSIGNMENT_BRIEF.md`), stack
  chosen (`PLAN.md`), data model and business rules designed, phases 0→10 sequenced.
- **2026-09-07 (implementer)** — read `CLAUDE.md`, `PLAN.md`, `../docs/ASSIGNMENT_BRIEF.md`.
  Wrote `docs/DECISIONS.md` (D-001…D-014). Phase 0 plan drafted and presented for approval.

## Next
1. Get go-ahead on the Phase 0 plan (folder tree, dependency list, docker-compose).
2. Scaffold Phase 0: compose file (Postgres 16 + API), FastAPI app factory, `config.py` with
   fail-loud validation, async SQLAlchemy engine/session, Alembic init, `/health`, structured
   logging + correlation-id middleware, CORS.
3. Verify: `docker compose up` → `/health` 200, `/docs` renders, `alembic upgrade head` on an empty
   DB succeeds.

## Phase checklist
- [ ] 0. Foundation
- [ ] 1. Data model + seed
- [ ] 2. Auth (Google OAuth → JWT, RBAC)  ← highest-weight requirement
- [ ] 3. Products API
- [ ] 4. Orders + business logic
- [ ] 5. Stripe + idempotent webhook
- [ ] 6. LangGraph agent
- [ ] 7. Frontend
- [ ] 8. Tests (authz suite)
- [ ] 9. Docs (schema, API, system design)
- [ ] 10. Deploy

## Deliverables checklist
- [ ] GitHub repository, clean history
- [ ] Live/demo URL (web + API `/docs`)
- [ ] README with setup
- [ ] Database schema doc
- [ ] API documentation
- [ ] One-page system design + scaling answer
- [ ] Total time taken
- [ ] AI tools used

## Decisions
Full rationale in [`docs/DECISIONS.md`](docs/DECISIONS.md). Index:

| ID | Decision |
|---|---|
| D-001 | PostgreSQL over MongoDB |
| D-002 | LangGraph over a LangChain agent executor |
| D-003 | Agent tools call services, not HTTP |
| D-004 | Money as integer cents |
| D-005 | `stripe_events` idempotency ledger |
| D-006 | Snapshot price + name onto `order_items` |
| D-007 | 404 not 403 for another user's order |
| D-008 | Agent identity from graph state, not tool arguments |
| D-009 | Stock decrement under `SELECT … FOR UPDATE` |
| D-010 | Success page polls; the redirect proves nothing |
| D-011 | Own JWT issued after verifying Google's ID token |
| D-012 | Zustand for cart, TanStack Query for server state |
| D-013 | Hand-built token-driven design system, not stock shadcn |
| D-014 | `prefers-reduced-motion` handled at the token layer |

## Blocked / waiting on the user
Nothing blocks Phase 0 or 1 — local Postgres comes from docker-compose.

| Key | Needed by phase | Status |
|---|---|---|
| `GOOGLE_CLIENT_ID` | 2 — Auth | pending |
| `GOOGLE_CLIENT_SECRET` | 2 — Auth (only if we add a server-side code exchange; ID-token flow does not need it) | pending |
| `STRIPE_SECRET_KEY` · `STRIPE_PUBLISHABLE_KEY` | 5 — Payments | pending |
| `STRIPE_WEBHOOK_SECRET` | 5 — Payments (from `stripe listen`) | pending |
| `ANTHROPIC_API_KEY` | 6 — Agent | pending |
| Neon `DATABASE_URL` | 10 — Deploy | pending |
| GitHub repo (`gh` not installed) | 10 — Deploy | user handles |

Until each arrives, the code is written and committed behind its interface, and `config.py` fails
at startup naming the missing variable rather than degrading silently.

## Notes & surprises
- `.env.example` lists `DATABASE_URL` with the `postgresql+psycopg` driver. That is compatible with
  `create_async_engine` (psycopg 3 speaks both sync and async), so no root-file change is needed —
  and using one driver for both the app and Alembic is simpler than pairing asyncpg with psycopg2.
  Keeping it.
- The oversell test needs real `SELECT … FOR UPDATE`, which SQLite does not implement. The test
  suite must therefore run against a real Postgres — compose exposes a `moksha_test` database for
  exactly this.

## Time log
| Date | Phase | Hours |
|---|---|---|
| 2026-09-07 | Reading brief, decisions, Phase 0 plan | in progress |
