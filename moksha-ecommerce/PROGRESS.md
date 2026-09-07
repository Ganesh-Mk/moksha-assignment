# Progress — Assignment 2 (Moksha AI E-Commerce)

> Update at every phase boundary. Assume context may be lost at any moment — this file is how the
> next session recovers.

## Status
**Phases 0–6 complete and pushed.** Backend is done: 191 tests green, every integration verified
against its real third-party service. Phase 7 (frontend) is next.

## Phase checklist
- [x] 0. Foundation — compose, fail-loud config, async SQLAlchemy, Alembic, `/health`, correlation IDs
- [x] 1. Data model + idempotent seed (12 products, 2 demo accounts)
- [x] 2. Auth — Google JWKS verification → our JWT, customer/admin RBAC
- [x] 3. Products API — public reads, admin writes, soft delete
- [x] 4. Orders — server-authoritative totals, `FOR UPDATE` stock, ownership, state machine
- [x] 5. Stripe — Checkout + signature-verified idempotent webhook
- [x] 6. LangGraph agent — tools over services, identity outside the model's reach, SSE, rate limit
- [ ] 7. Frontend
- [ ] 8. Tests — final sweep, coverage of anything Phase 7 adds
- [ ] 9. Docs — DATABASE_SCHEMA, API, SYSTEM_DESIGN, READMEs
- [ ] 10. Deploy (needs the user's Neon / Render / Vercel accounts)

## Deliverables checklist
- [x] GitHub repository, clean history — `github.com/Ganesh-Mk/moksha-assignment`
- [ ] Live/demo URL
- [ ] README
- [ ] Database schema doc
- [ ] API documentation
- [ ] One-page system design + scaling answer
- [ ] Total time taken
- [ ] AI tools used

## What is verified, and how

| Claim | Evidence |
|---|---|
| Oversell is impossible | Commented out `.with_for_update()` and re-ran: 5 concurrent buyers took **3** units from a stock of 2 and the tests failed. Restored → exactly 2 win. The test is not vacuous. |
| Stripe signatures are really checked | Real `stripe listen` session; the CLI's own deliveries verified and answered 200. |
| The webhook is idempotent | Stripe's CLI redelivered two events unprompted; both logged `webhook_duplicate_ignored`. Proven by Stripe's real retry behaviour, not a simulated one. |
| Full payment round-trip | Real order (stock 63→61) → real Checkout session built from DB prices → expired it → genuine signed `checkout.session.expired` → order cancelled, stock released (61→63). |
| The agent uses real data | Live Anthropic call answered all three of the brief's questions from database rows; listed 11 products, correctly omitting the 1 deactivated one. |
| The agent resists prompt injection | Four real attacks against the live model (admin-mode, fake SYSTEM UPDATE, authority claim, identity claim) — none reached another customer's order. |
| Migrations are reversible | Two full `upgrade`/`downgrade` cycles after adding the ENUM drops autogenerate omits. |
| Every route's authz is declared | `test_authz.py` reads the OpenAPI document and fails if any route is unclassified — it has already caught the payments and chat routes as they were added. |

## Architecture, in one paragraph
Routers do HTTP. Services own every business rule. The agent's tools import the same service
functions the routers call, so a rule is enforced once and holds for both — the AI cannot bypass a
rule because there is no second code path to bypass it through. Domain exceptions map to HTTP in a
single handler, so services never import `HTTPException` and stay callable from the agent.

## Decisions
Full rationale in [`docs/DECISIONS.md`](docs/DECISIONS.md) (D-001 … D-014).

## Local environment notes (not deliverables, but the next session will hit these)
- **Docker Desktop's WSL backend is broken on this machine** (`wslexec … exit status 0xc00000fd`),
  and repairing it would mean discarding a 14 GB `docker_data.vhdx` that is the user's. Development
  therefore runs against a *private* Postgres cluster created by `scripts/pg-local.ps1` — its own
  data directory, port 55432, no impact on the machine's Postgres 18 service. `docker-compose.yml`
  remains the documented path and still needs one verification run (see VERIFICATION_PENDING).
- **`uvicorn app.main:app` does not work on Windows.** uvicorn builds its loop from a factory
  hardcoded to `ProactorEventLoop`, which psycopg's async mode cannot use; `/health` works and every
  database route 500s. Use `python run.py`. Linux and the Docker image are unaffected.
- Local overrides live in `backend/.env.local` (gitignored), not the shared root `.env`.

## Open items for the user
- `ADMIN_EMAILS` is **not** in the root `.env` (only in `.env.example`). It is set in
  `backend/.env.local` for local work, but the deployment will need it or nobody gets admin.
- Deploy accounts: Neon, Render, Vercel.

## Time log
| Date | Phases | Notes |
|---|---|---|
| 2026-09-07 | 0–6 (backend complete) | Google, Stripe and Anthropic credentials all arrived mid-build; every integration verified live |
