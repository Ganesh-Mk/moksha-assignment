# Progress — Assignment 2 (Moksha AI E-Commerce)

## Status
**Phases 0–9 complete and pushed. Phase 10 (deploy) is the only remaining work**, and it needs
accounts I do not have.

Everything runs. `./scripts/verify.ps1` runs all eight quality gates in one command:

```
backend  · ruff lint · ruff format · mypy --strict · pytest (191)
frontend · tsc --strict · oxlint · vitest (20) · vite build
All gates passed.
```

## Phase checklist
- [x] 0. Foundation — compose, fail-loud config, async SQLAlchemy, Alembic, `/health`, correlation IDs
- [x] 1. Data model + idempotent seed
- [x] 2. Auth — Google JWKS → our JWT, customer/admin RBAC
- [x] 3. Products — public reads, admin writes, soft delete
- [x] 4. Orders — server-authoritative totals, `FOR UPDATE` stock, ownership, state machine
- [x] 5. Stripe — Checkout + signature-verified idempotent webhook
- [x] 6. LangGraph agent — tools over services, identity outside the model's reach, SSE, rate limit
- [x] 7. Frontend — 9 screens on a hand-built token design system
- [x] 8. Tests — 191 backend + 20 frontend, all green with no credentials
- [x] 9. Docs — schema, API, system design, decisions, README
- [ ] 10. Deploy — **needs the user's Neon / Render / Vercel accounts**

## Deliverables
| # | Deliverable | Status |
|---|---|---|
| 1 | GitHub repository, clean history | ✅ `github.com/Ganesh-Mk/moksha-assignment` |
| 2 | Live/demo URL | ⏳ Phase 10 |
| 3 | README with setup | ✅ `README.md` |
| 4 | Database schema | ✅ `docs/DATABASE_SCHEMA.md` |
| 5 | API documentation | ✅ `docs/API.md` + live `/docs` |
| 6 | One-page system design + scaling | ✅ `docs/SYSTEM_DESIGN.md` |
| 7 | Total time taken | ⏳ user to fill in |
| 8 | AI tools used | ✅ in `README.md` |

## What is verified, and how

Every integration was exercised against its real third party, not only against mocks.

| Claim | Evidence |
|---|---|
| Oversell is impossible | Commented out `.with_for_update()` and re-ran: 5 concurrent buyers took **3** units from a stock of 2 and the tests failed. Restored → exactly 2 win. The test is not vacuous. |
| A real card can be charged | Drove Stripe Checkout in a real browser with `4242…`. Order → `paid`, `stripe_payment_intent` recorded, stock stayed decremented. |
| The webhook is really verified | Live `stripe listen` session; every delivery signature-checked and answered 200. |
| The webhook is idempotent | Stripe's CLI redelivered two events unprompted; both logged `webhook_duplicate_ignored`. Proven by Stripe's own retry behaviour. |
| Stock is released on abandonment | Expired a real session: order 63→61→cancelled→63. |
| The agent uses real data | Live Anthropic calls answered all three of the brief's questions from database rows; listed 11 products, correctly omitting the 1 deactivated one. |
| The agent resists prompt injection | Four real attacks against the live model. None reached another customer's order; the model's own reply names the reason ("there's no user_id parameter"). |
| Migrations are reversible | Two full up/down cycles after adding the ENUM drops autogenerate omits. |
| Every route's authz is declared | `test_authz.py` reads the OpenAPI document and fails on any unclassified route — it caught the payments and chat routes as they were added. |
| The UI works | Real browser: no console errors and no horizontal overflow at 320/390/768/1024/1440, light and dark. Success page shows "Confirming…" for pending and "Payment confirmed" for paid; another customer's order renders "Order not found". |

## Three real bugs found by running, not by reading
1. **Alembic never drops ENUM types.** `downgrade` left `user_role` and `order_status` behind, so
   the next `upgrade` failed with *"type user_role already exists"*. Fixed with explicit `DROP TYPE`.
2. **`uvicorn app.main:app` is broken on Windows.** uvicorn builds its loop from a factory hardcoded
   to `ProactorEventLoop`, which psycopg's async mode cannot use. `/health` worked; every database
   route 500'd. Added `run.py`.
3. **`is_active` read as `None` on a brand-new user**, because the column default applies at flush
   and the check ran before it. First sign-in was rejected as "account disabled".

## For the user — three things to decide

1. **Port 5173 is contested.** Assignment 1's dev server and this one both want it. Only A2 needs
   it (Google authorises `http://localhost:5173` and nothing else), so **A1 should move to 5174**.
   Ask me and I will not touch A1 — it is the other session's folder.
2. **`ADMIN_EMAILS` is not in the root `.env`**, only in `.env.example`. Without it nobody gets the
   admin role. It is set in `backend/.env.local` for local work; the deployment needs it too.
3. **Deploy accounts** — Neon, Render, Vercel — are all Phase 10 needs.

## Local environment notes
- **Docker Desktop's WSL backend is broken on this machine** (`wslexec … 0xc00000fd`). Repairing it
  most likely means discarding a 14 GB `docker_data.vhdx` that is the user's, so I did not.
  Development ran against a private Postgres cluster from `scripts/pg-local.ps1` — its own data
  directory, port 55432, no impact on the machine's PostgreSQL 18 service. `docker-compose.yml`
  parses (`docker compose config` succeeds) but has not been run; see `docs/VERIFICATION_PENDING.md`.
- Local overrides live in `backend/.env.local` and `frontend/.env.local`, both gitignored, not in
  the shared root `.env`.

## Decisions
Full rationale in [`docs/DECISIONS.md`](docs/DECISIONS.md) (D-001 … D-014).

## Time log
| Date | Phases |
|---|---|
| 2026-09-07 | 0–9, complete. Google, Stripe and Anthropic credentials arrived mid-build; every integration verified live. |
