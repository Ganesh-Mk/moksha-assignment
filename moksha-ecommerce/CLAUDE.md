# CLAUDE.md — Assignment 2 (Moksha AI E-Commerce)

Standing rules for the A2 implementer session. Root rules in `../CLAUDE.md` also apply.

## Orientation — read in this order
1. `PLAN.md` — your brief, data model, phased build order
2. `../docs/ASSIGNMENT_BRIEF.md` — what is graded, and where marks are won/lost
3. `PROGRESS.md` — where you left off
4. `docs/DECISIONS.md` — decisions already made and why

## Scope
Only `moksha-ecommerce/`. Do not touch `hydra-curls/` — a different session owns it.
Shared root files are the user's; propose, don't edit.

## The architectural rule everything hangs off
> **Routers do HTTP. Services do business logic. The AI agent calls services, not HTTP.**

- `api/v1/*` — authenticate, validate, delegate, serialize. Thin. No business rules.
- `services/*` — the single source of truth for stock, totals, ownership, state transitions.
- `agent/tools.py` — imports the same service functions.

The agent therefore *cannot* bypass a business rule, and there is no HTTP-to-self. If you find
yourself writing a rule in a router or duplicating one in a tool, stop and move it to a service.

## Security rules — non-negotiable, highest-weight requirement
The brief states it as its own emphasized line: *"The backend must enforce authorization. Do not
rely only on frontend restrictions."*

- **Every** endpoint declares its auth: public, `get_current_user`, or `require_admin`. No endpoint
  is implicitly protected.
- **Verify the Google ID token against Google's JWKS.** Never decode-without-verify.
- **Never trust a client-sent price, total, or quantity.** Recompute from the DB inside the service.
- **Ownership checks are server-side.** Customers read only their own orders. Return **404**, not
  403, for another user's order — 403 confirms the id exists.
- **Agent `user_id` comes from the verified JWT, injected into graph state.** Never from a tool
  argument the model can influence. Assume users will try prompt injection; there is a test for it.
- **Stripe webhooks:** verify the signature, and make handling idempotent via the `stripe_events`
  ledger. Stripe retries — a naive handler double-decrements stock.
- Secrets only via env. `.env` is gitignored; keep `../.env.example` in sync.

Hiding a button in the frontend is **UX, not security**. Say so in the README.

## Data rules
- **Money is `int` cents.** Never float, never `Decimal`-to-float. Rounding bugs surface as
  off-by-a-cent totals and are the classic interview tell.
- **Snapshot `unit_price_cents` and `product_name` onto `order_items`.** An order is a historical
  record; later product edits must not rewrite past orders.
- **Stock changes inside a transaction with `SELECT … FOR UPDATE`** on the product rows. Two
  concurrent checkouts must not oversell the last unit. There is a test for this.
- Order status transitions live in `order_service`, in one place, not scattered across routers.

## Code rules
- `async def` throughout — async SQLAlchemy, async httpx. Do not block the event loop.
- Type hints everywhere; Pydantic v2 schemas for every request and response.
- Raise domain exceptions from services; map them to HTTP in one exception handler. Services must
  not import `HTTPException`.
- No business logic in the frontend. It is a rendering layer.
- Comments explain *why* (idempotency, race conditions, authz), never *what*.

## Environment
Real values in `../.env` (gitignored). **Currently only Figma keys are populated** — Google OAuth,
Stripe, Anthropic and DB credentials arrive later from the user.

Therefore: build against `../.env.example`, and make `config.py` **fail loudly at startup** with a
clear message naming the missing variable. Never silently no-op or fall back to a fake value — a
silently-disabled webhook verifier is exactly the bug this assignment is testing for.

Where a key is genuinely unavailable, keep going behind a clean interface and leave the wiring
obvious; note it in `PROGRESS.md` so the user knows what to hand you.

## Commands
```bash
docker compose up -d                              # postgres + api
alembic revision --autogenerate -m "..."          # after model changes
alembic upgrade head
python scripts/seed.py
pytest -v                                          # authz suite must be green
stripe listen --forward-to localhost:8000/api/v1/payments/webhook
```

## Stripe test cards
`4242 4242 4242 4242` success · `4000 0000 0000 0002` decline · `4000 0025 0000 3155` requires 3DS

## Before you say "done"
All authz tests green · Stripe success/decline/cancel all handled · agent answers the brief's three
questions from real DB data, scoped to the caller · all 8 deliverables present (repo, live URL,
README, DB schema, API docs, system design, time, AI tools) · deployed and smoke-tested in prod.

## Keep PROGRESS.md current
After each phase: what you did, what is next, decisions and why, anything surprising, and which
env keys you are still waiting on. Assume you could lose context at any moment.
