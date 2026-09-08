# Progress — Assignment 2 (Moksha AI E-Commerce)

## Status
**All ten phases complete. Deployed and verified in production.**

- App — https://moksha-ecommerce.vercel.app
- API — https://moksha-api-mv1j.onrender.com/docs

Everything runs. `./scripts/verify.ps1` runs all eight quality gates in one command:

```
backend  · ruff lint · ruff format · mypy --strict · pytest (196)
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
- [x] 8. Tests — 196 backend + 20 frontend, all green with no credentials
- [x] 9. Docs — schema, API, system design, decisions, README
- [x] 10. Deploy — Vercel (web) · Render (API, Docker) · Neon (Postgres)

## Deliverables
| # | Deliverable | Status |
|---|---|---|
| 1 | GitHub repository, clean history | ✅ `github.com/Ganesh-Mk/moksha-assignment` |
| 2 | Live/demo URL | ✅ web + API `/docs`, both verified live |
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

## Deployment incidents — the interesting part

Four bugs that passed every local gate and were found only by deploying. Written up in the
README's "What deploying actually surfaced"; the short version:

1. **The Dockerfile had never been built.** `docker compose` bind-mounts the source over `/app`, so
   the image's own code never runs and the build path is never exercised. Two bugs hid there — one
   that failed the build, one that built clean and would have failed at import.
2. **No SPA fallback.** Every deep link 404'd, including Stripe's `/checkout/success` return URL.
3. **Payments and webhooks on different Stripe accounts.** Orders stuck at `pending_payment`
   forever; the success page was behaving correctly and looked hung.
4. **The API served its own secret key.** `STRIPE_PUBLISHABLE_KEY` held the secret key, and
   `/payments/config` is public by design.

The through-line: each was a boundary the tests did not cross. Fail-loud config caught *missing*
variables from day one; it had nothing to say about a variable holding the *wrong kind* of value —
which is now checked.

## Post-deploy: a reviewer sign-in (2026-09-08)

Google OAuth is the real sign-in and stays the real sign-in — but the consent screen is in Testing
mode, so Google only lets allow-listed accounts through. A reviewer opening the live URL could not
authenticate at all, which meant the public catalogue and nothing else: no checkout, no order
history, no AI agent, no admin console. Most of what is graded was invisible.

`POST /auth/demo` takes one shared password and a role, and signs you into a seeded demo account.
No email field — the password does not identify an account, it unlocks two fixed ones.

The framing that matters, and the one to defend in the interview: **this is an authentication
shortcut, not an authorization bypass.** It issues the same JWT `/auth/google` issues, for an
ordinary user row with an ordinary role. There is no "is demo" flag anywhere; `require_admin`, the
404-not-403 ownership rule and the agent's closure-scoped identity are untouched. The tests state
it as a pair — a demo *admin* token opens `/admin/orders`, a demo *customer* token gets 403 from
it. If the second one ever fails, the feature has become the thing it claims not to be.

Off unless `DEMO_LOGIN_PASSWORD` is set (404, not 503 — see D-016 for why), constant-time compare,
5 attempts a minute per client address with a reset on success. The rate limiter moved out of
`chat_service` into `core/rate_limit.py` when it acquired a second caller.

## Open items

1. **Set `DEMO_LOGIN_PASSWORD=moksha@123` on Render.** The code is deployed — `/health/db` already
   reports the `demo_login` key — but the variable is missing, so it reads `disabled` and the login
   page says the door is switched off. Nothing else needs it; the frontend has no matching env var.
2. **Roll the Stripe secret key** — briefly exposed by `/payments/config` before the prefix guard.
   Test-mode, bounded risk, but it should not stay live.
3. **Total time taken** — the one deliverable still blank, and only the user can fill it in.
4. **Port 5173** is contested with Assignment 1 locally. Only A2 needs it (Google authorises that
   origin and no other), so A1 should move. Not my folder to change.

## Local environment notes
- **Docker** was intermittently broken on this machine early on (`wslexec … 0xc00000fd`), which is
  why development ran against a private Postgres cluster from `scripts/pg-local.ps1` — its own data
  directory, port 55432, no impact on the machine's PostgreSQL 18 service. It recovered after a
  clean `wsl --shutdown`, and the production image has since been built and run locally by
  `backend/scripts/docker-verify.sh`. `docker-compose.yml` itself still has not been run end to end.
- `pg-local.ps1 start` waits up to 90s: after an unclean shutdown Postgres replays the WAL before
  accepting connections, and a shorter timeout reports a healthy recovery as a failure.
- Local overrides live in `backend/.env.local` and `frontend/.env.local`, both gitignored, not in
  the shared root `.env`.

## Decisions
Full rationale in [`docs/DECISIONS.md`](docs/DECISIONS.md) (D-001 … D-016).

## Time log
| Date | Phases |
|---|---|
| 2026-09-07 | 0–9. Google, Stripe and Anthropic credentials arrived mid-build; every integration verified against its real service. |
| 2026-09-08 | 10 — deployed to Vercel + Render + Neon, and the four production-only bugs above found and fixed. Light theme, order thumbnails, and the reviewer sign-in added after walking the live app. |
