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
- [ ] **Set `DEMO_LOGIN_PASSWORD=moksha@123` on Render**, then sign in through the login page's
      password box as both Admin and Customer. Confirmed 2026-09-08 that the new code *is* deployed
      (`/health/db` lists a `demo_login` key at all) but the variable is absent, so it reports
      `disabled` and the endpoint 404s — correct behaviour, and not what a reviewer should meet.
      Everything about the feature is covered by tests (`TestDemoSignIn`) and was smoke-tested
      against a real server locally; what is unverified is only that the variable is present in the
      deployed environment.

## Notes for whoever runs this next

- The two demo orders placed during debugging live in an **older Stripe account** that has no
  webhook endpoint, so they are permanently `pending_payment`. That is a data artefact of the
  account switch, not a bug — orders placed now settle normally.
- `ENVIRONMENT` is deliberately left unset on Render (defaulting to `local`) so the app boots and
  reports feature status. Setting it to `production` arms `assert_production_ready()`, which
  refuses to start unless every credential is present — correct for a real deployment, and worth
  turning on once nothing else is in flux.
