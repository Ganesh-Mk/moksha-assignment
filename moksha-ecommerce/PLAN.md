# Assignment 2 — Moksha · Mini AI E-Commerce · Implementation Plan

**You are the implementer for Assignment 2.** This is your brief. Read it fully, then
`../docs/ASSIGNMENT_BRIEF.md`, before writing code.

**Goal:** a small but *production-shaped* e-commerce app proving the full chain
`UI → API → Database → Auth → Business Logic → AI → Integration`.

**Quality bar (user's words):** *"Don't think about timelines. We need to do THE BEST. It can take
any time. Just do it really, really, really well."* — plus: extra features welcome where they raise
the assignment's visibility.

**The brief's own framing, which should shape every tradeoff:**
> "The goal is **not to build a very large application**. We are evaluating **how you think, how you
> structure the application, how you solve real-world problems**."

So: **depth over breadth.** Airtight authz, a correct webhook, and clean docs beat a pile of
half-finished features. Every extra feature below was chosen because it *demonstrates judgment*,
not because it adds surface area.

---

## Stack

| Layer | Choice | Why (be ready to defend this) |
|---|---|---|
| Frontend | React 19 + TS + Vite + Tailwind v4 + shadcn/ui | Required by brief |
| Routing | React Router v7 | Standard; protected-route pattern is easy to show |
| Server state | TanStack Query v5 | Cache/invalidation/optimistic updates without hand-rolling |
| Client state | Zustand (cart only) | Cart is the only real client state. Redux would be overkill and you would have to justify it. |
| Backend | Python 3.12 + FastAPI | Required |
| DB | PostgreSQL 16 + SQLAlchemy 2.0 (async) + Alembic | Chosen over Mongo: orders/stock want transactions and FK integrity, and it produces a real schema doc |
| Validation | Pydantic v2 | Ships with FastAPI |
| Auth | Google OAuth → verified ID token → **our own JWT** | Exactly the flow the brief diagrams |
| Payments | Stripe Checkout (test mode) + webhook | Required |
| AI | **LangGraph** + `langchain-anthropic` (Haiku 4.5) | Required "LangChain or LangGraph"; LangGraph's explicit state machine is far easier to explain than an opaque agent executor |
| Tests | pytest + httpx AsyncClient | The authz suite is a deliverable, not optional |
| Local | Docker Compose (Postgres + API + web) | One-command startup for the reviewer |
| Deploy | Vercel (web) · Render (API) · Neon (DB) | Confirmed |

---

## Structure

```
moksha-ecommerce/
├── backend/
│   ├── app/
│   │   ├── main.py                 # app factory, middleware, routers
│   │   ├── config.py               # pydantic-settings; fail loudly on missing env
│   │   ├── database.py             # async engine + session dependency
│   │   ├── models/                 # user, product, order, order_item, stripe_event
│   │   ├── schemas/                # pydantic request/response
│   │   ├── api/v1/                 # auth, products, orders, cart, payments, admin, chat
│   │   ├── core/
│   │   │   ├── security.py         # JWT issue/verify
│   │   │   ├── deps.py             # get_current_user, require_admin  <-- authz lives here
│   │   │   ├── exceptions.py
│   │   │   └── logging.py          # structured logs + correlation id
│   │   ├── services/               # BUSINESS LOGIC — the single source of truth
│   │   │   ├── product_service.py
│   │   │   ├── order_service.py    # stock, totals, transitions
│   │   │   ├── payment_service.py  # stripe + idempotent webhook
│   │   │   └── auth_service.py
│   │   └── agent/
│   │       ├── graph.py            # LangGraph state machine
│   │       ├── tools.py            # tools -> services, identity-scoped
│   │       └── prompts.py
│   ├── alembic/
│   ├── tests/                      # test_authz.py is the headline
│   ├── scripts/seed.py
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   └── src/{components,pages,features,hooks,lib,store,types}
├── docs/
│   ├── SYSTEM_DESIGN.md            # deliverable
│   ├── DATABASE_SCHEMA.md          # deliverable
│   ├── API.md                      # deliverable
│   └── DECISIONS.md                # ADR-lite; feeds the live interview
├── docker-compose.yml
├── PLAN.md · PROGRESS.md · CLAUDE.md · README.md
```

**Architectural rule that makes the whole thing work:**
> **Routers do HTTP. Services do business logic. The AI agent calls services, not HTTP.**

Every rule (stock, totals, ownership) lives in `services/`. Routers are thin: authenticate,
validate, delegate, serialize. The agent's tools import the *same* service functions — so the AI
physically cannot bypass a rule, and there is no localhost-calling-itself silliness. This is the
cleanest answer you can give to "how did you structure it?"

---

## Data model

```
users            id · google_sub(uq) · email(uq) · name · picture · role(customer|admin)
                 · is_active · created_at · updated_at
products         id · name · slug(uq) · description · price_cents(int!) · currency
                 · image_url · category · stock(int) · is_active · created_at · updated_at
orders           id · user_id(fk) · status · subtotal_cents · total_cents · currency
                 · stripe_session_id(uq) · stripe_payment_intent · created_at · updated_at
order_items      id · order_id(fk) · product_id(fk) · quantity
                 · unit_price_cents  <-- price AT PURCHASE TIME
                 · product_name      <-- denormalized snapshot
stripe_events    id · event_id(uq) · type · processed_at   <-- webhook idempotency ledger
```

**Four decisions to be able to explain:**

1. **`price_cents` as integer.** Never float for money. Floats produce rounding errors that show up
   as off-by-a-cent order totals. This is the classic interview tell.
2. **`unit_price_cents` + `product_name` snapshotted onto `order_items`.** An order is a historical
   record. If an admin edits a product's price or name later, past orders must not silently change.
3. **`stripe_events` table.** Stripe retries webhook deliveries and can deliver out of order. The
   `event_id` unique constraint makes replay a no-op — without it, a retry double-decrements stock.
4. **`orders.status` state machine**, transitions enforced in `order_service`, not scattered:
   ```
   pending_payment ──> paid ──> fulfilled
          │
          ├──> payment_failed
          └──> cancelled          (stock released on both)
   ```

---

## Build order

Sequenced so each phase is verifiable before the next depends on it. Commit and update
`PROGRESS.md` at every phase boundary.

### Phase 0 — Foundation
Docker Compose (Postgres), FastAPI skeleton, config with fail-loud validation, async SQLAlchemy,
Alembic init, `/health`, structured logging + correlation-id middleware, CORS.
**Verify:** `docker compose up` → `/health` returns 200, `/docs` renders.

### Phase 1 — Data + seed
All models, first migration, `scripts/seed.py` with ~12 realistic products (use the Hydra Curls
range for a nice thematic tie-in), 1 demo customer + 1 demo admin.
**Verify:** migration up/down cleanly; seed is idempotent.

### Phase 2 — Auth ⚠️ highest-weight requirement
- `POST /api/v1/auth/google` — receive Google ID token, **verify signature against Google's JWKS**
  (`google-auth` library; never trust an unverified token), find-or-create user, issue our JWT.
- `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- `core/deps.py`: `get_current_user`, `require_admin`
- Role assignment: emails in `ADMIN_EMAILS` env → `admin`, else `customer`.

**Verify with tests, not by hand.** This is where marks are won.

### Phase 3 — Products
`GET /products` (paginate, filter, search) · `GET /products/{slug}` — public.
`POST|PATCH|DELETE /products` — **admin only**.
**Verify:** customer token gets `403` on all three write routes.

### Phase 4 — Orders + business logic
- `POST /orders` — server **recomputes the total from DB prices**; ignores any client-sent amount.
- Stock validated and decremented inside one transaction with `SELECT ... FOR UPDATE` on the
  product rows, so two concurrent orders cannot oversell the last unit.
- `GET /orders` — customer sees **only their own**; admin sees all.
- `GET /orders/{id}` — 404 (not 403) if it is not yours and you are not admin. *404 avoids leaking
  that the id exists — a small detail worth mentioning in the interview.*
- `PATCH /orders/{id}/status` — admin only.
**Verify:** the oversell test and the cross-user access test both pass.

### Phase 5 — Stripe
- `POST /payments/create-checkout-session` — build from the **order in the DB**, set
  `client_reference_id`, success/cancel URLs.
- `POST /payments/webhook` — `stripe.Webhook.construct_event` with the signing secret (**reject
  unverified**), insert into `stripe_events` first (unique violation → return 200 immediately),
  then handle `checkout.session.completed` → `paid`, `expired`/`async_payment_failed` → release stock.
- Success page **polls order status** rather than trusting the redirect. The redirect is a client
  navigation and proves nothing; the webhook is the source of truth.
**Verify:** `stripe listen --forward-to localhost:8000/api/v1/payments/webhook`, run test cards
`4242…` (success) and `4000 0000 0000 0002` (decline). Replay an event — stock must not move twice.

### Phase 6 — AI agent (LangGraph)
Graph: `agent ⇄ tools` loop with a bounded step count.

Tools — all thin wrappers over `services/`:
| Tool | Scope |
|---|---|
| `list_products(category?, in_stock_only?)` | public |
| `get_product(name_or_slug)` | public — fuzzy match on name |
| `search_products(query)` | public |
| `get_my_orders()` | **caller only** |
| `get_order_status(order_id)` | **caller only — ownership re-checked in the tool** |

**The security point that makes this answer good:** `user_id` is injected into the graph state
from the verified JWT, **never** taken from the model's tool arguments. If it came from arguments,
a user could type *"show me order 5 belonging to someone else"* and the model might comply. Write a
test that attempts exactly that prompt-injection and assert it fails.

Also: system prompt constrains scope to this store; unknown answers say so rather than inventing;
rate-limit `/chat` per user (AI calls cost money — a real production concern).

`POST /api/v1/chat` — authenticated, SSE streaming.

### Phase 7 — Frontend
Pages: Login · Products · Product detail · Cart · Checkout · Success/Cancel · Order history ·
Order detail · Admin (products CRUD, orders list + status).
Cross-cutting: `ProtectedRoute` + `AdminRoute`, auth context, TanStack Query hooks, Zustand cart
persisted to localStorage, chat widget with streaming, skeletons, empty states, error boundary,
toasts. Mobile-responsive throughout.

> Hiding the admin nav is **UX, not security**. Say so in the README — the reviewer is watching for
> whether you know the difference.

### Phase 8 — Tests
`tests/test_authz.py` is the headline deliverable:
- customer → `403` on every admin route (parametrized over all of them)
- customer A → cannot read customer B's order
- unauthenticated → `401` on every protected route
- expired/tampered/malformed JWT → `401`
- agent cannot reach another user's order (prompt-injection attempt)
- oversell: concurrent orders for the last unit → one succeeds, one fails
- webhook: unsigned rejected; duplicate event is a no-op

### Phase 9 — Docs (3 of the 8 listed deliverables — do not skip)
- `docs/SYSTEM_DESIGN.md` — one-page diagram (Mermaid) showing Frontend, FastAPI, DB, AI Agent,
  Google Auth, Stripe, **AWS/deployment approach**, plus the scaling answer (below).
- `docs/DATABASE_SCHEMA.md` — ER diagram, every table/column, indexes, and *why*.
- `docs/API.md` — every endpoint: method, path, auth, request, response, error codes.
- `docs/DECISIONS.md` — ADR-lite, the decisions above with rationale.
- `README.md` — setup, demo credentials, Stripe test cards, AI tools used, time taken.

### Phase 10 — Deploy
Neon DB → Render API (Dockerfile, env, Stripe webhook endpoint pointed at it) → Vercel frontend.
Update Google OAuth authorized origins/redirects for the live domains. Smoke-test the whole flow
in production. Document the Render cold-start caveat.

---

## The scaling answer (they ask for it explicitly — draft it properly)

Structure it as **bottleneck → fix**, in the order they would actually bite:

1. **Stateless API** → JWT means no server sessions, so scale horizontally behind an ALB. Free.
2. **Database first to hurt** → read replicas for the product catalog; PgBouncer for connection
   pooling (serverless + Postgres = connection exhaustion, a real failure mode); indexes on
   `orders.user_id`, `products.slug`, `products.category`.
3. **Cache the catalog** → Redis/ElastiCache for product reads (high read:write ratio); invalidate
   on admin write. Cuts the majority of DB load.
4. **AI is the expensive path** → this is the part they are really asking about:
   - Semantic cache on common questions ("what products do you have") — most traffic is repetitive
   - Route simple intents to a cheaper/smaller model, escalate only when needed
   - Per-user rate limits + a global spend cap
   - Stream responses (better perceived latency, no extra cost)
   - Move long conversations to a queue (SQS) + workers so a slow LLM call never occupies a web
     worker; push results over WebSocket/SSE
   - Batch/parallelize tool calls within a turn
5. **Static + media** → CloudFront CDN; product images to S3.
6. **Webhooks must never be lost** → enqueue on receipt, ack Stripe fast, process async with retries
   and a DLQ. Idempotency ledger already makes retries safe.
7. **Observability** → structured logs, traces (OpenTelemetry), token-spend dashboards, alerts on
   webhook failures and agent error rate.
8. **AWS shape** → ECS Fargate (or App Runner) behind ALB · RDS Postgres Multi-AZ · ElastiCache ·
   S3 + CloudFront · Secrets Manager · SQS + Lambda for webhooks/agent jobs.

Mention what you would **not** do yet, and why. Knowing when *not* to add Kafka is a stronger signal
than listing it.

---

## Extra features (chosen for signal, in priority order)

Do these **only after the required scope is complete and tested**.

1. **Idempotent webhook ledger** — already core above. Highest signal per line of code.
2. **Concurrency-safe stock** (`FOR UPDATE`) with a test that proves it.
3. **Agent prompt-injection test** — memorable, and shows security thinking in AI systems.
4. **Streaming chat (SSE)** — makes the demo feel real.
5. **Rate limiting on `/chat`** — cost awareness.
6. **Correlation IDs + structured logging** — request traceable end to end.
7. **Admin dashboard stats** — revenue, orders by status, low-stock alerts. Cheap, demos well.
8. **Order status timeline UI** — makes the state machine visible to a reviewer.
9. **`docker compose up` one-command startup** — respects the reviewer's time.
10. **Optimistic cart updates** with rollback.

---

## Definition of done

- Live URLs for web + API `/docs`; full flow works in production
- Every authz test green; no route relies on frontend hiding
- Stripe: success, decline, and cancel paths all handled and demonstrable
- Agent answers all three brief questions from **real DB data**, scoped to the caller
- All 8 deliverables present
- You can explain every table, endpoint, and dependency in one sentence each
