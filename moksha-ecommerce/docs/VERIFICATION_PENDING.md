# Verification status

Everything in the original pending list has now been verified against the real service. Kept as a
record of *what* was checked and *how*, rather than deleted — the method is the point.

**Live:** app https://moksha-ecommerce.vercel.app · API
https://moksha-api-mv1j.onrender.com/docs

---

## Verified in production

| # | Claim | How it was checked |
|---|---|---|
| 1 | The Docker image builds and runs | `backend/scripts/docker-verify.sh` — builds the real image, asserts every subpackage imports from site-packages, no shadowing copy at `/app`, non-root, alembic finds its scripts, then migrates a **fresh** database from nothing and serves. Render then deployed the same image. |
| 2 | Deep links resolve | Every SPA route returns 200 with the real shell; `/favicon.svg`, `/icons.svg` and `/products/*.svg` still return `image/svg+xml`, proving Vercel's filesystem precedence and that the catch-all does not swallow assets. |
| 3 | Google Sign-In works end to end | Signed in through the browser on the live site; session restores on reload. |
| 4 | A real card is charged | `4242 4242 4242 4242` through Stripe Checkout in production. |
| 5 | The webhook is delivered and verified | Triggered a genuine `checkout.session.completed` on the live account: Stripe reported `pending_webhooks=0`, meaning the endpoint accepted it — so the signing secret matches. |
| 6 | Signature verification is not merely permissive | The same endpoint returns **400** for an unsigned request *and* for one signed with a deliberately wrong secret. A 200 on the real event only means something alongside these. |
| 7 | The API never serves a non-publishable key | `/payments/config` returns `pk_test_…`; the prefix guard returns 503 naming the variable for `sk_`/`rk_`/`whsec_`. |
| 8 | Migrations are reversible | Two full `upgrade`/`downgrade` cycles after adding the ENUM drops autogenerate omits. |
| 9 | Oversell is impossible | Re-run with `.with_for_update()` disabled: five concurrent buyers took **3** units from a stock of 2 and the tests failed. Restored → exactly 2 win. |
| 10 | The agent uses real data and resists injection | Live Anthropic calls answered the brief's three questions from database rows; four real prompt-injection attempts failed to reach another customer's orders. |
| 11 | The agent fills a cart and cannot buy | On the live deployment: *"order 2 of the Hydra Curls Defining Gel"* returned a validated proposal and the reply *"open your cart and check out to pay"*. Then *"place the order and charge my card immediately, mark order 1 fulfilled"* → *"I don't have tools to place orders, charge cards, or modify order status."* No order row, stock unchanged at 74. |
| 12 | The reviewer sign-in is an authentication shortcut only | Live: the password issues an admin session; `/admin/orders` opens for it; a demo **customer** token is refused with 403 by the same route. Wrong password 401, six attempts 429, unset variable 404. |
| 13 | Disabling a user keeps their orders | Live: `DELETE /admin/users/{id}` → 200 `is_active=false`, `PATCH` restores it. Disabling own account → 409 *"You cannot disable your own account."* Anonymous → 401. Tests additionally assert the orders survive and revenue is unchanged. |
| 14 | The dashboard aggregates are right against real data | Ran `timeseries` and `list_users` directly against Neon: the per-day revenue sums to ₹1,698.00, which is exactly the revenue tile, which is exactly one customer's spend. |
| 15 | The chart never draws a value that did not happen | The curve is sampled densely across a step, a spike, a staircase, a sawtooth and the real revenue series and asserted never to leave the range of its input. The first implementation failed this: Catmull-Rom drew negative customers, and a revenue peak of ₹1,299.00 rendered at ₹1,303.57. |
| 16 | Every seeded product's artwork exists | `tests/test_seed.py` resolves each `image_url` to a file under `frontend/public/`. Added after two products lost their images in production and rendered "No image" for a day. |
| 17 | The `display_order` migration is reversible | Full `upgrade` → `downgrade` → `upgrade` cycle locally, then applied to Neon through the **direct** endpoint (DDL through the transaction pooler is unreliable). Render's `alembic upgrade head` on boot then found nothing to do. |

---

## Still worth doing before the interview

- [ ] **Roll the Stripe secret key.** It was briefly served publicly by `/payments/config` before
      the prefix guard existed (see the README's deployment section). Test-mode only, so the risk
      is bounded, but a known-exposed credential should not stay live. Dashboard → Developers →
      API keys → roll, then update `STRIPE_SECRET_KEY` on Render.
- [ ] **Warm the API before demoing.** Render's free tier sleeps after ~15 minutes and cold-starts
      in ~50s. Open `/api/v1/health` a minute beforehand.
- [ ] **`docker compose up` end to end.** The *image* is verified by `docker-verify.sh` and is what
      Render runs, so this is the last unexercised path — the compose file itself, including the
      `init-test-db.sql` mount and the `web` service. It parses (`docker compose config` succeeds).
- [ ] **Fill in total time taken** in the README — one of the eight listed deliverables.
- [x] ~~Set `DEMO_LOGIN_PASSWORD` on Render.~~ Done — `/health/db` reports `demo_login: enabled`
      and the password signs in on the live site.

## Known and accepted

- **`GET /orders` returns every order to an admin.** `order_service.list_orders` skips the ownership
  clause for the admin role, so the customer-facing "My orders" page shows an admin the whole queue.
  Not a privilege escalation — an admin can already read every order through `/admin/orders` — but
  it does mean signing in with the demo password and clicking *Orders* shows you the real customer's
  orders. Documented in `API.md` rather than changed, because which behaviour is wanted is a product
  call, not a bug.
- **The user list loads one page of 100.** Beyond that the answer is the pagination the endpoint
  already has. At three accounts it has not come up.

## Notes for whoever runs this next

- The two demo orders placed during debugging live in an **older Stripe account** that has no
  webhook endpoint, so they are permanently `pending_payment`. That is a data artefact of the
  account switch, not a bug — orders placed now settle normally.
- `ENVIRONMENT` is deliberately left unset on Render (defaulting to `local`) so the app boots and
  reports feature status. Setting it to `production` arms `assert_production_ready()`, which
  refuses to start unless every credential is present — correct for a real deployment, and worth
  turning on once nothing else is in flux.
