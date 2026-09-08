# Moksha — Mini AI E-Commerce

Assignment 2. An e-commerce application demonstrating the full chain
`UI → API → Database → Authentication → Business Logic → AI → Integration`.

| | |
|---|---|
| **Live app** | **https://moksha-ecommerce.vercel.app** |
| **API docs** | **https://moksha-api-mv1j.onrender.com/docs** (Swagger) · [`/redoc`](https://moksha-api-mv1j.onrender.com/redoc) |
| **Health** | [`/api/v1/health/db`](https://moksha-api-mv1j.onrender.com/api/v1/health/db) — reports which integrations are configured |
| **Reviewer sign-in** | password **`moksha@123`** — on the login page, pick *Admin* or *Customer*. No email needed. [Why this exists](#demo-accounts) |
| **Stack** | React 19 · TypeScript · Tailwind v4 · FastAPI · PostgreSQL 16 · LangGraph · Stripe |

> **Warm the API before trying the demo.** Render's free tier sleeps after ~15 minutes idle and
> cold-starts in roughly 50 seconds. Open the health link above first; the frontend also says so
> rather than showing a generic failure.

**Documentation:** [System design](docs/SYSTEM_DESIGN.md) · [Database schema](docs/DATABASE_SCHEMA.md)
· [API reference](docs/API.md) · [Decisions](docs/DECISIONS.md)

---

## The five things worth looking at

If you read nothing else, these are where the thinking is.

**1 · Authorization is enforced on the server, and proved.**
`backend/tests/test_authz.py` discovers every route from the app's own OpenAPI document and
parametrizes over it — so a route added tomorrow is tested tomorrow, without anyone remembering to
add a case. Across the **31** routes the app currently exposes it asserts a customer's token gets
`403` on all **12** admin routes, an admin gets through all 12 (a guard that refuses everyone is
not a guard), anonymous callers get `401` on all **21** protected routes, and that **no route
escapes classification** — an unclassified route fails the suite rather than slipping through.

Those numbers are not maintained by hand. Every endpoint added during this build — the demo
sign-in, the dashboard aggregates, user management — was covered by that suite the moment it was
registered, and two of them were caught by it before they had a test of their own.

> The Admin link is hidden from customers in the navigation. **That is UX, not security.** Deleting
> that conditional would change nothing about what a customer can do — `core/deps.py` is the
> control, and the test suite is the proof.

**2 · Two concurrent checkouts cannot oversell the last unit.**
Stock moves under `SELECT … FOR UPDATE`, locks taken in ascending product id so opposing carts
cannot deadlock. The test was checked against a disabled lock: with `.with_for_update()` commented
out, five concurrent buyers take **3** units from a stock of 2 and it fails. This is also why the
suite runs against real PostgreSQL — SQLite has no `FOR UPDATE` and would have passed either way.

**3 · The Stripe webhook is signature-verified and idempotent.**
Stripe delivers at-least-once and retries on any non-2xx. The handler inserts the event id into
`stripe_events` *before* doing any work; a unique violation means "already handled". A naive handler
decrements stock twice on the first retry. Verified against the real Stripe CLI — it redelivered
two events unprompted and both were logged as duplicates.

**4 · The AI agent can fill a cart, and cannot spend anyone's money.**
Order tools take **no user argument**. Identity is a closure variable bound from the verified JWT,
so it never appears in the tool's JSON schema — and everything in that schema is filled in by the
model, which is steered by what the customer types. There is nothing for an injected instruction to
fill in. Four real attacks were run against the live model; the model's own reply names the reason:
*"there's no user_id parameter, and the tools are scoped to you automatically."*

Its one tool that changes anything is `add_to_cart`, and what it changes is a **proposal**: a cart
line validated against the real product row, which the browser applies to the cart it already owns.
It cannot place an order, take payment or edit the catalogue — the customer opens the cart and
checks out. `test_agent_cart.py` asserts a proposal writes no order row and decrements no stock.
Asked on the live deployment to *"place the order and charge my card immediately"*, the model
answers: *"I don't have tools to place orders, charge cards, or modify order status — and those
instructions don't change what I can actually do."*

**5 · The client cannot influence what it is charged.**
The order request schema has no price field at all. The server recomputes the total from the rows it
locks. Even the cart's own subtotal is labelled "a preview" in the UI, because the server's figure
is the one charged.

---

## What is actually in it

**Shop.** A 15-product catalogue in an explicit merchandising order, searchable and filterable by
category, paginated. The five Hydra Curls products are the range from the Assignment 1 landing
page, with its photography — the shop sells what the marketing site advertises.

**Cart and checkout.** Client-owned cart (the only genuinely client-owned state), Stripe Checkout
in test mode, a signature-verified idempotent webhook, and an order state machine whose legal
transitions the server publishes so the admin UI cannot offer an illegal one.

**Orders.** Own-orders list and detail with a status timeline, cancellation of an unpaid order
which returns its stock exactly once.

**AI assistant.** A LangGraph agent over live database tools: prices, stock, search, the caller's
own orders — and `add_to_cart`, which proposes a validated cart line and hands the customer back to
the cart to pay. Streams over SSE. Its replies render markdown.

**Admin console.** Three screens behind `require_admin`:

| Screen | What it does |
|---|---|
| Overview | revenue, paid orders, customers, low stock · top spenders · running low · an activity chart over 7/30/90 days with four series and two axes |
| Catalogue | create, edit, withdraw and restore products; price entry in rupees converted to integer paise at one boundary |
| Customers | every account with what it has bought; disable and restore, guarded so an admin cannot lock everyone out |

**Accessibility and theming.** One CSS custom-property token layer, no `dark:` variant anywhere,
`prefers-reduced-motion` honoured once at the token layer, semantic HTML, visible focus rings,
keyboard-reachable everything.

---

## Running it

### Option A — Docker (one command)

```bash
cp ../.env.example ../.env     # fill in your keys
docker compose up
```

- Web → http://localhost:5173
- API → http://localhost:8000 · docs at `/docs`
- Postgres → `localhost:5432` (`moksha` / `moksha`)

The API container runs `alembic upgrade head` on boot and waits for the database's health check
rather than sleeping. Compose reads the repository-root `.env`, so secrets live in exactly one place
and never appear in `docker-compose.yml`.

The production image is verified separately by `backend/scripts/docker-verify.sh`, which builds it
and runs it against a real database — see the note under [Tests](#tests) for why compose cannot do that.

### Option B — run the pieces directly

**Database.** Either `docker compose up -d db`, or — with PostgreSQL already installed — a private
cluster that will not touch it:

```bash
./scripts/pg-local.ps1 init     # own data dir, port 55432, own superuser
```

**Backend.**

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate   # source .venv/bin/activate on macOS/Linux
pip install -e ".[dev]"
alembic upgrade head
python scripts/seed.py
python run.py                                     # http://localhost:8000
```

> **Windows:** use `python run.py`, not `uvicorn app.main:app`. uvicorn builds its event loop from a
> factory hardcoded to `ProactorEventLoop` on Windows, which psycopg's async mode cannot use — the
> symptom is `/health` working while every database route 500s. `run.py` supplies the selector loop.
> Linux and the Docker image are unaffected.

**Frontend.**

```bash
cd frontend
npm install
npm run dev                                       # http://localhost:5173
```

> Port 5173 is not a preference. It is the only origin authorized in the Google Cloud console, so
> sign-in fails anywhere else.

**Stripe webhooks, locally.**

```bash
stripe listen --forward-to localhost:8000/api/v1/payments/webhook
```

Use the `whsec_…` the CLI prints — some versions issue a different secret per listen session than
`--print-secret` returns.

---

## Environment

Copy `../.env.example` to `../.env`. Nothing has a fallback: `config.py` fails loudly and names the
variable, because a webhook verifier that quietly disables itself when its secret is missing is
exactly the bug this project is about.

| Variable | Needed by |
|---|---|
| `DATABASE_URL` | everything |
| `JWT_SECRET` | session tokens — a long random string in production |
| `GOOGLE_CLIENT_ID` | sign-in |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | payments |
| `ANTHROPIC_API_KEY` | the support agent |
| `ADMIN_EMAILS` | comma-separated; these addresses get the admin role on Google sign-in |
| `DEMO_LOGIN_PASSWORD` | *optional* — enables the reviewer sign-in below (`moksha@123` on the live demo). Unset, that endpoint 404s |
| `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` | frontend (Vite only exposes `VITE_`-prefixed vars) |

A feature whose credential is absent is **disabled and says so** — `/health/db` reports it, and
calling it returns `503` naming the variable. In production `assert_production_ready()` refuses to
boot at all: an instance that comes up with Stripe disabled looks healthy to the load balancer and
takes orders it cannot charge.

---

## Demo accounts

The catalogue is browsable signed out. Everything else — checkout, order history, the AI assistant,
the admin console — needs a session. There are two doors to one.

**1. Google (the real one).** The consent screen is in **Testing** mode, so only allow-listed
Google accounts get through it. Your address in `ADMIN_EMAILS` makes that account an admin.

**2. Reviewer sign-in (a password, no email).** Because of the above, a reviewer with no
allow-listed account cannot use door 1 and would see the catalogue and nothing else. So the login
page also offers a password box. One field — no email, no role picker.

> ### Password: `moksha@123`

It signs you into the seeded admin (`demo.admin@moksha.test`), which is every screen in the app:
the shop, the cart, checkout, order history, the AI assistant, and the admin console. A seeded
customer (`demo.customer@moksha.test`) exists alongside it and is reachable through the API, but
the UI does not offer it — an admin can already do everything a customer can, and a genuine
customer session is what Google sign-in is for.

Yes, that password is written down in a public repository, and yes it grants admin on the live
demo to anyone who reads it. That is the intended trade for a reviewable demo, not an oversight —
it is why the whole thing is gated behind an env var (`DEMO_LOGIN_PASSWORD`) that a real deployment
simply leaves unset, at which point the endpoint does not exist.

> **This is an authentication shortcut, not an authorization bypass**, and the difference is the
> whole design. It issues the *same* JWT Google sign-in issues, for a real user row with a real
> role. `require_admin`, the 404-not-403 order-ownership rule and the agent's identity scoping are
> untouched and still apply — nothing downstream knows which door you came through. A demo
> **customer** token is still refused by `/admin/orders` with 403, and there is a test that says so.
>
> It is off unless `DEMO_LOGIN_PASSWORD` is set (the endpoint 404s), the password is compared in
> constant time, and it is rate limited to 5 attempts a minute per client. See
> [D-016](docs/DECISIONS.md).

**Stripe test cards** — any future expiry, any CVC:

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | succeeds → order becomes `paid` via the webhook |
| `4000 0000 0000 0002` | declined → order stays `pending_payment` |
| `4000 0025 0000 3155` | 3-D Secure challenge, then succeeds |

**Two seed rows are deliberately awkward**, so the edge cases can be seen without setting them up:
*Curl Defining Gel* has `stock = 1` (run two checkouts at once), and *Silk Press Finishing Serum* is
withdrawn — invisible in the catalogue, still resolvable from a past order.

---

## Tests

```bash
./scripts/verify.ps1                    # all eight gates: lint, types, tests, build
cd backend && ./scripts/docker-verify.sh   # builds the production image and proves it runs

cd backend && pytest -v                 # 321 tests
cd frontend && npm test                 # 50 tests
```

**`docker compose up` does not verify the Dockerfile.** Compose bind-mounts the source over
`/app`, so the image's own copy of the code never executes and the build path is never exercised.
Two bugs shipped through that gap and were caught only by a real deploy — see
`backend/scripts/docker-verify.sh`, which now closes it.

**The whole suite runs green with no API credentials.** Google, Stripe and Anthropic are each
reached through a seam the production code already has, and tests substitute a fake at it — so the
real application code path runs and only the network call is replaced.

Where a fake would weaken a test, there is none:

- **Stripe signatures are verified for real.** The tests compute a genuine HMAC and drive the real
  `stripe.Webhook.construct_event` against a self-contained test secret. A stubbed verifier would
  make "rejects an unsigned webhook" prove nothing.
- **Our own JWTs are real.** Only *Google's* verification is faked; every token the suite issues and
  checks is genuinely signed. An authz test using a fake token would be testing the fake.
- **The prompt-injection tests script a model that has already been manipulated.** The stub asks for
  the victim's order; the test asserts the service refuses anyway. That is the only guarantee worth
  having — one that does not depend on the model resisting.

| File | Covers |
|---|---|
| `test_authz.py` | the headline: RBAC across every discovered route, cross-customer access |
| `test_auth.py` | JWKS verification, forged / `alg:none` / expired / tampered tokens, role assignment |
| `test_orders.py` | server-authoritative totals, oversell under concurrency, deadlock avoidance, the state machine |
| `test_payments.py` | signature verification, idempotency, every payment outcome |
| `test_agent_authz.py` | prompt injection, tool schemas, what the agent still cannot do, rate limiting |
| `test_agent.py` | the brief's three questions answered from real database rows |
| `test_agent_cart.py` | the cart tool proposes and never purchases; refuses unknown, sold-out, withdrawn |
| `test_dashboard.py` | the activity series is dense; spend agrees with revenue; disabling a user keeps their orders |
| `test_seed.py` | every seeded product's artwork exists on disk, prices are integers, slugs unique |
| `test_models.py` | database-level invariants — constraints, snapshots, the ledger |
| `test_health.py` | boot, readiness, correlation ids |

On the frontend, `npm test` covers the three pieces of real logic that live there: money
formatting, the cart store (including the lines the agent proposes), the markdown the assistant
replies in, and the chart's curve — which is sampled densely and asserted never to leave the range
of its data, because the first implementation drew negative customers.

---

## Layout

```
moksha-ecommerce/
├── backend/
│   ├── app/
│   │   ├── api/v1/        routers — authenticate, validate, delegate, serialize
│   │   ├── core/          deps.py (the security boundary), security, exceptions, logging
│   │   ├── services/      BUSINESS LOGIC — the single source of truth
│   │   ├── agent/         LangGraph graph, tools, prompt
│   │   ├── models/        SQLAlchemy 2.0
│   │   └── schemas/       Pydantic v2
│   ├── tests/
│   ├── scripts/seed.py
│   └── run.py             local entrypoint (see the Windows note above)
├── frontend/
│   ├── public/products/   SVG artwork, plus the five Hydra Curls photographs from A1
│   ├── src/
│   │   ├── styles/        the token layer — every colour, size and duration
│   │   ├── components/ui/ primitives built on those tokens
│   │   ├── components/admin/  the activity chart and its metric definitions
│   │   ├── hooks/         TanStack Query wrappers, auth, SSE chat
│   │   ├── lib/           pure logic, tested without a DOM: money, markdown, the chart curve
│   │   └── store/cart.ts  the only genuinely client-owned state
│   └── scripts/generate-product-art.mjs
└── docs/
```

---

## Deploying

**Set `ENVIRONMENT` last.** `assert_production_ready()` refuses to boot unless *every* credential
is present — deliberately, because an instance that comes up with Stripe disabled looks healthy to
the load balancer and takes orders it cannot charge. It exits with code 3 and names the missing
variable, which on a first deploy (before Vercel exists, so no `STRIPE_WEBHOOK_SECRET` or
`FRONTEND_URL`) reads as a crash loop.

So the order is:

1. Deploy with `ENVIRONMENT` **unset** — it defaults to `local`, the app boots, and `/health/db`
   reports which integrations are still missing.
2. Add `FRONTEND_URL` once Vercel is up, and `STRIPE_WEBHOOK_SECRET` once the Stripe endpoint
   points at the Render URL. That secret is **not** the one from `stripe listen`; a dashboard
   endpoint has its own.
3. *Then* set `ENVIRONMENT=production` and redeploy, so the guard is armed for the demo.

**Register the Stripe webhook endpoint — this is a separate step from setting the keys, and
nothing warns you if you skip it.** Without it, payments succeed at Stripe and the order stays
`pending_payment` forever: the success page sits on "Confirming your payment", because it waits
for the signed webhook rather than trusting the redirect. That is the design working correctly,
and it is indistinguishable from a hang if the endpoint was never registered.

In the Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

| | |
|---|---|
| **URL** | `https://<your-api-host>/api/v1/payments/webhook` |
| **Events** | `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` |

Then copy **that endpoint's** signing secret into `STRIPE_WEBHOOK_SECRET` on the API host. It is
**not** the secret `stripe listen` prints — that one belongs to the CLI's forwarding session and
will fail signature verification against dashboard deliveries.

To confirm the endpoint is live before sending a real payment, POST to it unsigned. A correct
deployment answers `400 webhook_signature_invalid` — reachable, and refusing what it cannot
verify:

```bash
curl -X POST https://<your-api-host>/api/v1/payments/webhook      -H 'Content-Type: application/json' -d '{}'
```

Orders stranded by a missing endpoint are recoverable: register it, then **Resend** the past event
from the Stripe Dashboard. The `stripe_events` ledger makes replay safe, so the order settles
exactly once.

**`frontend/vercel.json` — the SPA fallback.** Without it, `/orders` returns 404 in production.
Vercel serves the build as static files, and there is no `orders` file on disk — the route only
exists inside React Router, once the JavaScript has loaded. Only `/` worked, so any refresh,
bookmark, or link shared into Slack broke. Vite's dev server rewrites unmatched paths to
`index.html` for you, which is exactly why this is invisible until it is deployed.

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

The catch-all looks like it would swallow every asset, and it does not: Vercel gives
**precedence to the filesystem before rewrites are applied**, so anything that exists on disk is
served as itself and only unmatched paths fall through to the shell.

That ordering is load-bearing here rather than incidental, because this app has a genuine
collision — `/products/:slug` is a React Router route *and* `/products/*.svg` is a real directory
of generated product artwork. Filesystem-first is what lets `/products/argan-hair-oil.svg` return
the image while `/products/argan-hair-oil` returns the app. If rewrites ran first, every product
image on the catalogue would be broken.

The Stripe return URLs (`/checkout/success`, `/checkout/cancelled`) depend on this too — they are
entered by a redirect from an external origin, which is a cold page load, not client-side
navigation.

**Migrations and connection pooling.** `MIGRATION_DATABASE_URL` is optional and overrides
`DATABASE_URL` for Alembic only. On Neon, point it at the **direct** endpoint while the app keeps
the pooled one: the pooled endpoint is PgBouncer in transaction mode, which hands each transaction
a different backend session — fine for the app, hostile to multi-statement DDL.

For the same reason the async engine sets `prepare_threshold=None`. psycopg 3 auto-prepares a
statement after five uses and prepared statements are session-scoped, so through a transaction
pooler the second use lands on a backend that has never seen it. The symptom is an intermittent
`DuplicatePreparedStatement` under load and nothing at all in testing.

## What deploying actually surfaced

Everything below passed locally, and every one of these was found only by deploying. Kept here
because "it worked on my machine" is the interesting part, not an embarrassment to hide.

**1 · The Dockerfile had never been built.** `pip install .` failed on Render with
`package directory 'app' does not exist` — the image copied `pyproject.toml` before the source.
It survived local testing because `docker compose` bind-mounts the source over `/app`, so the
image's own copy of the code is never executed. Behind it hid a second, worse bug:
`packages = ["app"]` installs the *top-level* package only, so `app.api` and `app.services` were
missing from the wheel — that one **built clean** and would have failed at import. A local
editable install masked it, because `pip install -e .` puts the source tree on `sys.path`.
→ `backend/scripts/docker-verify.sh` now builds the real image and runs it against a real
database. The gap was never a missing test; it was a deliverable with no test at all.

**2 · Every deep link 404'd.** No SPA fallback, so `/orders` and — worse — `/checkout/success`,
Stripe's return URL, returned 404 in production. A real payment landed on a broken page. Invisible
locally because Vite's dev server rewrites for you. → `frontend/vercel.json`.

**3 · Payments and webhooks were on different Stripe accounts.** The API charged one account while
the webhook endpoint lived in another, so orders stayed `pending_payment` forever and the success
page sat on "Confirming your payment". That page was *correct* — it waits for the signed webhook
rather than trusting the redirect — but "correctly refusing to lie" and "hung" look identical from
outside. Diagnosed by decoding the account id embedded in the publishable key the live API serves,
which settles it in one request.

**4 · The API served its own secret key.** `STRIPE_PUBLISHABLE_KEY` was set to the *secret* key.
`/payments/config` is public by design, so the API handed a live Stripe secret to anyone who
asked. Nothing objected, because to the code a key is just a string. → the endpoint now checks the
prefix and returns a 503 naming the variable instead. Six regression tests assert `sk_`, `rk_` and
`whsec_` values are never served and never appear in the response body.

The through-line: each was a **boundary the tests did not cross** — the image rather than the app,
the platform's routing rather than the router, the account rather than the API, and a config value
whose *type* was never checked. Fail-loud config caught missing variables all along; it had nothing
to say about a variable holding the wrong kind of value.

## AI tools used

Built with **Claude Code** (Opus), used as an implementation partner rather than an autocomplete:
architecture and trade-offs discussed first, then implemented, then verified by running things.

What that meant concretely — and what it did *not* mean:

- Every integration was verified against the real third party, not only against mocks. A real card
  was charged through Stripe Checkout; four real prompt-injection attempts were run against the live
  Anthropic model; the agent's answers were checked against actual database rows.
- Claims in the test suite were themselves checked. The oversell test was re-run with the row lock
  disabled to confirm it fails without it — a test that passes either way proves nothing, and that
  is not visible from reading it.
- Three real bugs were found by running rather than by review: the ENUM types Alembic's autogenerate
  never drops (so `downgrade` then `upgrade` failed), uvicorn's hardcoded Windows event loop (which
  psycopg cannot use), and stock reserved for a line in an order that had already failed.
- The first pass at product imagery hotlinked stock photos and was thrown away: a search for twelve
  specific haircare products returns twelve photos of *approximately* the right thing, and a
  wide-tooth comb illustrated by a perfume bottle is worse than no photo.

Every decision in `docs/DECISIONS.md` is one I can defend in a sentence, which was the bar rather
than the volume of code produced.

## Time taken

_To be completed on submission._
