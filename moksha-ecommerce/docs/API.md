# API reference

Base URL `{host}/api/v1`. Interactive documentation is served live at **`/docs`** (Swagger) and
**`/redoc`** — generated from the same Pydantic schemas the code validates against, so it cannot
drift from the implementation. This document adds what OpenAPI cannot express: *why* each endpoint
behaves as it does.

---

## Authorization at a glance

Every endpoint declares exactly one posture. There is no fourth, and no implicit default — a route
with no dependency is public **by decision**, and `tests/test_authz.py` fails if any route is
unclassified.

| Posture | Requirement | Failure |
|---|---|---|
| **Public** | none | — |
| **Authenticated** | valid access token, active account | `401` |
| **Admin** | the above, plus `role = admin` | `403` |
| **Signature** | valid `Stripe-Signature` header | `400` |

> The brief states it as its own emphasized line: *"The backend must enforce authorization. Do not
> rely only on frontend restrictions."* Hiding the admin link in the navigation is UX. `core/deps.py`
> is the control.

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | Public |
| GET | `/health/db` | Public |
| POST | `/auth/google` | Public |
| POST | `/auth/demo` | Public *(404 unless enabled)* |
| POST | `/auth/refresh` | Public |
| GET | `/auth/me` | Authenticated |
| POST | `/auth/logout` | Authenticated |
| GET | `/products` | Public |
| GET | `/products/categories` | Public |
| GET | `/products/{slug}` | Public |
| POST | `/orders` | Authenticated |
| GET | `/orders` | Authenticated *(own only)* |
| GET | `/orders/{id}` | Authenticated *(owner only)* |
| POST | `/orders/{id}/cancel` | Authenticated *(owner only)* |
| GET | `/payments/config` | Public |
| POST | `/payments/create-checkout-session` | Authenticated *(owner only)* |
| POST | `/payments/webhook` | **Signature** |
| POST | `/chat` | Authenticated |
| POST | `/chat/stream` | Authenticated |
| GET | `/admin/products` | **Admin** |
| POST | `/admin/products` | **Admin** |
| PATCH | `/admin/products/{id}` | **Admin** |
| DELETE | `/admin/products/{id}` | **Admin** |
| GET | `/admin/orders` | **Admin** |
| GET | `/admin/orders/{id}` | **Admin** |
| PATCH | `/admin/orders/{id}/status` | **Admin** |
| GET | `/admin/stats` | **Admin** |

---

## Conventions

**Money is integer cents, everywhere.** `price_cents`, `total_cents`, `unit_price_cents`. The API
never sends a float amount — a float that survives one JSON round trip has already lost precision.

**Authentication** is `Authorization: Bearer <access_token>`.

**Every error has one shape**, and carries the correlation id that also appears in the
`X-Request-ID` response header, so a user can quote one value that pulls up the whole server-side
trace:

```json
{
  "error": {
    "code": "insufficient_stock",
    "message": "Only 1 of “Curl Defining Gel” left — you asked for 3.",
    "details": { "product_name": "Curl Defining Gel", "requested": 3, "available": 1 }
  },
  "request_id": "3f9c1e2a4b7d4e2f8c6a1b0d5e3f7a92"
}
```

| Status | When |
|---|---|
| `400` | malformed request; webhook signature invalid |
| `401` | missing, expired, malformed or forged token |
| `402` | Stripe rejected the payment attempt |
| `403` | authenticated, but not an administrator |
| `404` | not found — **or someone else's order** (see below) |
| `409` | conflict: insufficient stock, duplicate slug, illegal state transition |
| `422` | request body failed schema validation |
| `429` | chat rate limit; carries `Retry-After` |
| `503` | a feature is not configured — the body names the missing variable |

**Paginated responses** are `{ items, total, limit, offset }`. `total` is the count *after* filters
and *before* pagination — and for a customer's orders it is scoped to them, so it never leaks how
many orders exist overall.

---

## Authentication

### `POST /auth/google` · Public

Exchanges a Google ID token for our own tokens.

```json
{ "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..." }
```

The signature is verified against **Google's live JWKS** via `google-auth` before a single claim is
trusted. It is never decoded without verification — that is the most common critical bug in this
integration, because the token looks identical in a debugger either way, and anyone can mint an
unsigned JWT claiming any email address, including one on the admin allowlist.

Also refused: an unverified Google email (the admin allowlist is keyed on email, so accepting one
would let anyone claim an address they do not control), and a disabled account.

The user is created on first sign-in and matched on Google's stable `sub` thereafter, falling back
to email — which is what lets a seeded demo account adopt its real Google identity rather than
colliding on the unique email index. The role is **re-evaluated on every sign-in** from
`ADMIN_EMAILS`, so removing an address actually demotes that user.

**200**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": { "id": 1, "email": "you@example.com", "name": "You",
            "picture_url": "https://...", "role": "customer",
            "created_at": "2026-09-07T10:00:00Z" }
}
```

**401** — signature invalid, expired, wrong audience, unverified email, or disabled account.

### `POST /auth/demo` · Public — only when `DEMO_LOGIN_PASSWORD` is set

```json
{ "password": "...", "role": "admin" }
```

`role` defaults to `admin` and accepts `customer`. There is **no email field**: the password does
not identify an account, it unlocks two fixed seeded ones (`demo.admin@moksha.test`,
`demo.customer@moksha.test`, both on the RFC 2606 `.test` TLD so they cannot collide with a real
Google identity). Returns the same body as `/auth/google`.

**This is an authentication shortcut, not an authorization bypass.** It issues exactly the same JWT
for a real user row with a real role. `require_admin`, order ownership and the agent's identity
scoping are unchanged and still apply — nothing downstream knows which door the caller came
through. Two tests pin that down: a demo *admin* token opens `/admin/orders`, and a demo *customer*
token still gets **403** from it.

It exists because the Google consent screen is in **Testing** mode, so only allow-listed Google
accounts can sign in at all. Without it a reviewer sees the public catalogue and nothing else.

| Response | When |
|---|---|
| **200** | Correct password |
| **401** | Wrong password — compared with `secrets.compare_digest`, so no timing signal |
| **404** | `DEMO_LOGIN_PASSWORD` is unset. Deliberately *not* 503: a misconfigured feature is a 503, an absent one is a 404, and "this exists but is unavailable" invites someone to come back for it |
| **429** | More than 5 attempts a minute from one client address. A success resets the counter, so typos never lock out a reviewer |

### `POST /auth/refresh` · Public

`{ "refresh_token": "..." }` → the same body as above.

The token's `type` claim is checked: an **access** token presented here is rejected. Without that
check, a short-lived access token could be traded for a fresh pair indefinitely and its lifetime
would mean nothing.

The account is re-read from the database, so one disabled or demoted since the refresh token was
issued cannot renew.

### `GET /auth/me` · Authenticated

Returns the caller. Used to restore a session on page load.

The user is loaded from the database on **every** authenticated request, not reconstructed from
token claims. That costs one indexed primary-key lookup and buys immediate revocation: an account
disabled a second ago cannot keep acting on an access token that is still within its hour. It is
also why a token minted with `role: admin` for a customer's id grants nothing.

### `POST /auth/logout` · Authenticated → `204`

Honest about what it does not do: with stateless JWTs an already-issued access token stays valid
until it expires. Real revocation needs a denylist of `jti` values checked on every request — a
stated trade-off, not an oversight. The short access lifetime bounds the exposure.

---

## Products

### `GET /products` · Public

| Query | Type | Notes |
|---|---|---|
| `search` | string ≤ 100 | matches name or description; ILIKE wildcards in the input are escaped, so `%` does not return the whole catalogue |
| `category` | string ≤ 64 | |
| `in_stock_only` | bool | |
| `min_price_cents`, `max_price_cents` | int ≥ 0 | |
| `limit` | 1–100, default 24 | |
| `offset` | int ≥ 0 | |

**Active products only, unconditionally.** `include_inactive` is a service argument passed by the
admin router — it is not a query parameter. A soft delete a client can undo with
`?include_inactive=true` is not a soft delete.

### `GET /products/categories` · Public

Distinct categories of active products. Declared *before* `/{slug}`: FastAPI matches in declaration
order, and the reverse would resolve this as a product named "categories".

### `GET /products/{slug}` · Public

**404** for an unknown *or withdrawn* product — from outside, a product that has been withdrawn is
indistinguishable from one that never existed.

---

## Orders

### `POST /orders` · Authenticated → `201`

```json
{ "items": [ { "product_id": 4, "quantity": 2 } ] }
```

**There is no price field, anywhere in this schema.** The client sends product ids and quantities;
the server recomputes the total from the rows it locks. That is stronger than remembering to ignore
a client-sent amount — there is nothing to ignore. A checkout that trusted the client would let
anyone buy anything for one cent.

Stock is validated and decremented inside **one transaction** holding `SELECT … FOR UPDATE` on the
product rows, locked in ascending `product_id`. The ordering is not cosmetic: two carts holding
`{1,2}` and `{2,1}` would deadlock if each locked in its own request order.

Stock is reserved at **creation**, before payment. That is a real trade-off — an abandoned checkout
holds inventory until Stripe reports the session expired — and the alternative (reserving at
payment) oversells whenever two people pay in the same instant.

Duplicate lines for one product are merged before the stock check. Unmerged, each would be
validated against the full stock independently and together could oversell it.

**409** `insufficient_stock`, with `details.available` so the UI can say "only 2 left" rather than
"failed". Any failing line rolls back the whole order — it is never half-reserved.

### `GET /orders` · Authenticated

The caller's own orders only. The scope is a `WHERE` clause applied **before** pagination, not a
filter over results — filtering afterwards produces mostly-empty pages and leaks a total that
includes other people's orders.

### `GET /orders/{id}` · Authenticated, owner only

**Another customer's order returns 404, not 403.** A 403 would confirm the id exists, turning the
endpoint into an oracle for counting our orders. The response is byte-identical to a genuinely
nonexistent id, and there is a test asserting exactly that. Admins read any order via
`/admin/orders/{id}`.

Response includes `allowed_transitions` — the states this order may legally move to next — so the
admin UI can grey out illegal moves instead of keeping a copy of the state machine that drifts.

### `POST /orders/{id}/cancel` · Authenticated, owner only

Cancels a `pending_payment` order and returns its stock. **409** if it is past that state: a paid
order needs a refund, which is money moving, and so is an admin action rather than a self-service
button. **404** if it is not yours.

---

## Payments

### `GET /payments/config` · Public

`{ "publishable_key": "pk_test_..." }`. The publishable key is designed to be public — it identifies
the account and can only create payment attempts. Served from here rather than baked into the
frontend bundle so one build works against test and live accounts.

### `POST /payments/create-checkout-session` · Authenticated, owner only

```json
{ "order_id": 12 }
```

An order id and nothing else. With no amount, currency or line items in the request, there is
nothing a client could send that changes what it is charged; the session is built from the order
rows already in our database.

Paying for another customer's order returns **404**, matching `GET /orders/{id}` — otherwise the
payment route becomes the ownership oracle the order route is careful not to be.

**409** if the order is not awaiting payment. **503** naming `STRIPE_SECRET_KEY` if Stripe is not
configured. If a session already exists and is still open, its URL is returned rather than a second
one created: two live sessions against one order means two ways to pay it.

### `POST /payments/webhook` · Signature-authenticated

**Public endpoint, but not unauthenticated.** Stripe has no bearer token to send; the
`Stripe-Signature` header *is* the credential, verified with `stripe.Webhook.construct_event`
against the signing secret. An unsigned or badly-signed request is rejected with **400** before any
work happens — verification precedes even the ledger insert, so an attacker cannot poison the
ledger with an event id and have the genuine delivery later discarded as a duplicate.

**This is the only thing that marks an order paid.** The browser's redirect to `/checkout/success`
is a client-side navigation a user can perform by typing a URL. Trusting it would hand out free
orders.

**Idempotent.** Stripe delivers at-least-once and retries on any non-2xx. The event id is inserted
into `stripe_events` *before* any work; a unique violation returns 200 immediately.

| Event | Effect |
|---|---|
| `checkout.session.completed` | → `paid` — but only if `payment_status == "paid"`. A completed session can be unpaid for delayed payment methods, and treating that as paid fulfils an order that has not been charged. |
| `checkout.session.async_payment_succeeded` | → `paid` |
| `checkout.session.expired` | → `cancelled`, stock released |
| `checkout.session.async_payment_failed` | → `payment_failed`, stock released |
| anything else | acknowledged with 200 and ignored — a non-2xx would make Stripe retry an event we will never act on, forever, until it disables the endpoint |

**200** `{ "received": true, "outcome": "paid" | "duplicate" | "ignored" | "awaiting-payment" | "cancelled" | "payment-failed" | "order-not-found" }`

The raw request body is passed to the verifier byte-for-byte. Re-serializing parsed JSON changes
whitespace and key order and breaks the HMAC — the classic reason a webhook "randomly" fails.

---

## AI support agent

### `POST /chat` · Authenticated

```json
{ "message": "what's the price of the curl gel?", "history": [] }
```
→ `{ "reply": "The Curl Defining Gel is ₹649.00. Only 1 left." }`

### `POST /chat/stream` · Authenticated

Server-Sent Events. Each `data:` line is a JSON object: `{"delta": "..."}`, `{"done": true}`, or
`{"error": {...}}`.

Errors travel **inside** the stream because the response is already 200 by the time streaming
begins — a client that only checked the status would hang on a connection that simply stops
producing.

SSE rather than WebSockets: this is one-directional server-to-client text over plain HTTP, which
reconnects on its own and needs no protocol upgrade through the proxy.

**Identity is not a parameter.** The caller's id comes from the verified JWT and is bound into the
tools as a closure variable, so it never appears in any tool's JSON schema. Everything in that
schema is filled in by the model, and the model is steered by what the customer types — with a
`user_id` argument, *"show me order 7 belonging to user 3"* is a plausible completion and a helpful
model will try it. `get_my_orders` takes no arguments at all; `get_order_status` takes only an order
id. Ownership is re-checked inside the order service regardless.

Tools, all thin wrappers over the same service functions the HTTP routers call:

| Tool | Scope |
|---|---|
| `list_products(category?, in_stock_only?)` | public |
| `get_product(name_or_slug)` | public — matches "curl gel" to "Curl Defining Gel" |
| `search_products(query)` | public |
| `get_my_orders()` | **caller only, no arguments** |
| `get_order_status(order_id)` | **caller only, ownership re-checked** |

The agent is **read-only**: there is no write tool, so there is nothing to be talked into. That is a
property of the tool list, not of the system prompt — a prompt is guidance, a missing tool is an
impossibility.

**429** with `Retry-After` when the per-user rate limit is hit. Every turn is a paid API call; an
endpoint that invokes an LLM on demand with no ceiling is a billing incident waiting to be noticed.

**503** naming `ANTHROPIC_API_KEY` if the agent is not configured.

---

## Admin

`require_admin` is declared **on the router**, not per route, so a route added to `admin.py` later
is protected whether or not its author remembers to protect it. The authorization suite
parametrizes over every admin route discovered from the live OpenAPI document, so a new one is
covered the moment it exists.

### `GET /admin/products` · Admin
Includes withdrawn products — an admin needs to see what they withdrew in order to restore it.

### `POST /admin/products` · Admin → `201`
```json
{ "name": "New Product", "slug": "new-product", "description": "...",
  "price_cents": 49900, "category": "cleanse", "stock": 40, "image_url": null }
```
**409** if the slug is taken.

### `PATCH /admin/products/{id}` · Admin
PATCH semantics: an omitted field is left alone, an explicit `null` clears it — the distinction is
real because the handler uses `model_dump(exclude_unset=True)`. The slug is not updatable.

Editing a price does **not** alter past orders: `order_items` snapshots the price at purchase.

### `DELETE /admin/products/{id}` · Admin
A **soft delete** — sets `is_active = false` and returns the updated product. A hard delete would
violate the RESTRICT foreign key from `order_items` as soon as the product had been sold, and
rightly so.

### `GET /admin/orders` · Admin
Every order with its buyer attached. Filters: `status`, `user_id`.

### `PATCH /admin/orders/{id}/status` · Admin
`{ "status": "fulfilled" }`. Validated against the state machine; **409** naming both states on an
illegal move. Cancelling an order that still holds stock returns that stock exactly once — the
transition table rejects a second cancel before the release code is reached.

### `GET /admin/stats` · Admin
Revenue counts only orders that reached `paid` or `fulfilled`. A pending order is not revenue, and
counting it would overstate takings by every abandoned checkout.

---

## Health

`GET /health` — cheap, no I/O. What a load balancer polls, and what warms Render's free tier out of
a cold start before a demo.

`GET /health/db` — touches Postgres and reports which integrations are configured, so a
half-configured deployment is visible from outside rather than discovered at checkout. **503** if
the database is unreachable, so an orchestrator takes the instance out of rotation instead of
routing traffic to a pod that will 500 on every request.

```json
{ "status": "ok", "database": "ok",
  "features": { "google_sign_in": "enabled", "stripe_payments": "enabled", "ai_agent": "enabled" } }
```
