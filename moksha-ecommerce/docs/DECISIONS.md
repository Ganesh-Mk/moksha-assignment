# Decisions — Assignment 2 (Moksha AI E-Commerce)

ADR-lite. One entry per decision a reviewer could reasonably challenge in the interview.
Each is written so it can be defended in **one sentence** out loud.

Format: **Context → Decision → Why → What we gave up.**

---

## D-001 · PostgreSQL over MongoDB
**Status:** accepted · 2026-09-07

The brief allows either. Orders and stock are the whole point of the business-logic section, and
both want *transactions* (decrement stock and create the order atomically) and *referential
integrity* (an order item must point at a real product).

**Decision:** PostgreSQL 16 with SQLAlchemy 2.0 async + Alembic.

**Why:** `SELECT … FOR UPDATE` inside a transaction is the correct answer to "two people buy the
last unit at the same time". Mongo can be made to work here, but the solution is either a
single-document design that fights the shape of the data, or a multi-document transaction that
gives up Mongo's main advantage anyway. Postgres also produces a real migration history and a
schema doc, which is one of the eight required deliverables.

**Gave up:** flexible schema. We do not need it — the product shape is known and stable.

---

## D-002 · LangGraph over a LangChain agent executor
**Status:** accepted · 2026-09-07

**Decision:** LangGraph `agent ⇄ tools` loop with an explicit bounded step count.

**Why:** the graph *is* the explanation. In an interview I can point at two nodes and one
conditional edge and describe the whole control flow, including where the loop is bounded. An
`AgentExecutor` is a black box whose behaviour I would be describing from documentation rather
than from code I wrote.

**Gave up:** a few lines of boilerplate versus `create_react_agent`. Worth it for legibility.

---

## D-003 · The agent calls services, not HTTP
**Status:** accepted · 2026-09-07

This is the architectural rule the whole backend hangs off:

> **Routers do HTTP. Services do business logic. The AI agent calls services, not HTTP.**

**Decision:** every business rule lives in `app/services/`. Routers authenticate, validate,
delegate, serialize — nothing else. `app/agent/tools.py` imports the *same* service functions the
routers call.

**Why:** two payoffs. (1) The AI **physically cannot bypass a business rule**, because there is no
second code path to bypass it through — a rule is enforced once, in the function both callers
share. (2) No localhost-calling-itself: an agent that issues HTTP requests back into its own API
burns a worker, needs a token to impersonate the user, and doubles the failure surface.

**Gave up:** nothing meaningful. The cost is discipline: if a rule ever appears in a router, that is
a bug, not a shortcut.

---

## D-004 · Money as integer cents
**Status:** accepted · 2026-09-07

**Decision:** `price_cents`, `subtotal_cents`, `total_cents` are all `int`. Formatting to a currency
string happens at the presentation edge only.

**Why:** binary floating point cannot represent `0.10`, so float money accumulates error and
surfaces as an order total off by a cent. It is the classic tell that someone has not handled money
before.

**Gave up:** having to remember `* 100` at two boundaries. Cheap — and it is the same unit Stripe
uses, so the payment integration needs no conversion at all.

---

## D-005 · `stripe_events` idempotency ledger
**Status:** accepted · 2026-09-07

**Decision:** the webhook writes `event_id` into a `stripe_events` table **before** doing any work.
A unique-constraint violation means "already processed" → return 200 immediately.

**Why:** Stripe guarantees *at-least-once* delivery and retries on any non-2xx, including a timeout.
A handler without this ledger decrements stock twice on the first retry. Handling delivery
semantics unprompted is the difference between "wired up Stripe" and "integrated Stripe".

**Gave up:** one table and one insert per webhook. Negligible.

---

## D-006 · Snapshot price and name onto `order_items`
**Status:** accepted · 2026-09-07

**Decision:** `order_items` stores `unit_price_cents` and `product_name` copied at purchase time,
alongside the `product_id` FK.

**Why:** an order is a **historical record**, not a live join. If an admin raises a price or renames
a product next week, every past order must still show what the customer actually agreed to pay.
Joining to `products` for the price would silently rewrite history — and would break the moment a
product is deactivated or deleted.

**Gave up:** normalization purity. This is the textbook case where denormalization is correct.

---

## D-007 · 404, not 403, for another user's order
**Status:** accepted · 2026-09-07

**Decision:** `GET /orders/{id}` for an order you do not own returns **404 Not Found**.

**Why:** 403 says "this exists, but it is not yours" — an enumeration oracle. Walking the id space
would let an attacker count our orders. 404 leaks nothing. Admins still get 200.

**Gave up:** a marginally less precise error for the developer. The test suite documents the intent.

---

## D-008 · Agent identity comes from graph state, never from tool arguments
**Status:** accepted · 2026-09-07

**Decision:** `user_id` is read from the verified JWT in the route handler and injected into
LangGraph state. Order-scoped tools take **no** user parameter; they close over state. Ownership is
re-checked inside the service, not only at the tool boundary.

**Why:** anything in a tool's argument schema is under the model's control, and therefore under the
*user's* control via the prompt. If `get_order_status(order_id, user_id)` existed, "show me order 7
for user 3" is a plausible completion. There is a test — `test_agent_prompt_injection` — that fires
exactly that prompt and asserts it fails.

**Gave up:** nothing. Strictly the safer construction.

---

## D-009 · Stock decrement under `SELECT … FOR UPDATE`
**Status:** accepted · 2026-09-07

**Decision:** order creation opens a transaction, locks the involved product rows in a deterministic
order (ascending `product_id`, to avoid deadlock between interleaved carts), validates stock,
decrements, and commits.

**Why:** read-then-write without a lock is a lost-update race: two requests both read `stock = 1`,
both pass validation, both write `stock = 0`, and we have sold two of the last one. Ordering the
locks by id prevents two carts holding each other's rows. A concurrency test runs two checkouts
against the last unit and asserts exactly one wins.

**Gave up:** a little write throughput under contention. Correct beats fast for inventory.

---

## D-010 · The success page polls order status; the redirect proves nothing
**Status:** accepted · 2026-09-07

**Decision:** after Stripe redirects to `/checkout/success`, the frontend polls `GET /orders/{id}`
until status leaves `pending_payment`. The order is marked `paid` **only** by the verified webhook.

**Why:** the success redirect is a client-side navigation. A user can type that URL directly, so
trusting it would mark orders paid for free. The webhook is the only signed, server-to-server
statement of fact. This is the "backend-side payment verification" the brief asks for.

**Gave up:** the success page shows a brief "confirming your payment" state instead of an instant
tick. That state is honest, and it is what real checkouts do.

---

## D-011 · Our own JWT after Google, rather than passing Google's token around
**Status:** accepted · 2026-09-07

**Decision:** the frontend sends the Google **ID token** once to `POST /auth/google`; the backend
verifies its signature against Google's JWKS, finds-or-creates the user, and issues our own
short-lived access token plus a refresh token. Every later request carries our JWT.

**Why:** it is the flow the brief diagrams, and it decouples session lifetime and role claims from
Google. Our token carries `role`, so RBAC needs no extra lookup; Google's token knows nothing about
being an admin. Verification uses the `google-auth` library against the live JWKS — **never**
`decode(..., options={"verify_signature": False})`, the single most common critical bug in this
integration.

**Gave up:** having to implement refresh ourselves. Small, and expected in production anyway.

---

## D-012 · Zustand for the cart, TanStack Query for everything else
**Status:** accepted · 2026-09-07

**Decision:** server data (products, orders) lives in the TanStack Query cache. The cart — the only
genuine client-owned state — is a small Zustand store persisted to `localStorage`.

**Why:** most "state management" in a CRUD app is actually cache management, and Query does
invalidation, dedupe, and optimistic updates better than a hand-rolled reducer. That leaves exactly
one piece of real client state, and reaching for Redux to hold one store would be indefensible.

**Gave up:** a single unified state story. Two tools, each doing what it is good at, is the easier
answer to defend.

---

## D-013 · A hand-built design system, not stock shadcn defaults
**Status:** accepted · 2026-09-07

**Decision:** one token layer defines every colour, radius, spacing step, shadow, duration and
easing as CSS custom properties. Components consume tokens only — no raw hex, no one-off pixel
values. shadcn primitives are used for *behaviour* (focus trap, portal, roving tabindex) and then
restyled to our token set; the visual language is ours.

**Why:** the requirement is a compact, professional interface that does not read as AI-generated.
Default shadcn on the default Tailwind palette is precisely the look that does. Tokens also make
dark mode, density, and motion-reduction one-line changes rather than a find-and-replace.

**Gave up:** the speed of dropping components in untouched. That speed is what produces the generic
look we are avoiding.

---

## D-014 · `prefers-reduced-motion` handled at the token layer
**Status:** accepted · 2026-09-07

**Decision:** animation durations are tokens; the reduced-motion media query overrides those tokens
once, globally.

**Why:** honouring the preference per-component is a checklist that will eventually be missed. Doing
it once at the token layer makes it structurally true for every component written afterwards.

**Gave up:** nothing.
