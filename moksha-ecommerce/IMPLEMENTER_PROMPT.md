# Kickoff prompt — Assignment 2 implementer

Start a Claude Code session with **`D:\Prep\Moksha\moksha-ecommerce`** as the working directory,
then paste everything in the box below.

---

```
You are implementing Assignment 2 of a two-part technical interview assignment.

Read these three files before writing any code:
  1. CLAUDE.md                       - your standing rules
  2. PLAN.md                         - your full brief, data model, and phased build order
  3. ../docs/ASSIGNMENT_BRIEF.md     - what is being graded, and where marks are won and lost

Task: build a small but production-shaped AI e-commerce app proving the full chain
UI -> API -> Database -> Auth -> Business Logic -> AI -> Integration.

Stack (already decided, see PLAN.md for the reasoning behind each):
  Frontend  React 19 + TS + Vite + Tailwind v4 + shadcn/ui + TanStack Query + Zustand
  Backend   Python 3.12 + FastAPI + PostgreSQL 16 + SQLAlchemy 2.0 async + Alembic
  Auth      Google OAuth -> verified ID token -> our own JWT, customer/admin RBAC
  Payments  Stripe Checkout test mode + signature-verified, idempotent webhook
  AI        LangGraph + langchain-anthropic (Haiku 4.5), tools calling real services
  Deploy    Vercel (web) / Render (API) / Neon (DB)

The architectural rule everything hangs off:
  Routers do HTTP. Services do business logic. The AI agent calls services, not HTTP.
  Business rules live in services/ only. The agent's tools import those same functions, so the
  AI physically cannot bypass a rule.

Non-negotiables - the brief emphasizes authorization as its own line, so it is the
highest-weight requirement:
  - Every endpoint declares its auth: public, get_current_user, or require_admin.
  - Verify the Google ID token against Google's JWKS. Never decode-without-verify.
  - Never trust a client-sent price or total. Recompute from the DB.
  - Customers read only their own orders. Return 404, not 403, for someone else's order.
  - Agent user_id comes from the verified JWT injected into graph state, never from a tool
    argument the model can influence. Write a prompt-injection test that proves this.
  - Stripe webhook: verify the signature, and make it idempotent via a stripe_events ledger.
    Stripe retries deliveries - a naive handler double-decrements stock.
  - Money is integer cents, never float.
  - Stock changes inside a transaction with SELECT ... FOR UPDATE. Two concurrent checkouts
    must not oversell the last unit. Write a test that proves this.

Environment status - important: only the Figma keys in ../.env are populated right now. Google
OAuth, Stripe, Anthropic and DB credentials will be supplied by the user later. So:
  - Build against ../.env.example.
  - config.py must fail loudly at startup naming any missing variable. Never silently no-op or
    fall back to a fake value.
  - Keep going behind clean interfaces, and record in PROGRESS.md exactly which keys you need.

Quality bar, in the user's words: "Don't think about timelines. We need to do THE BEST. It can
take any time. Just do it really, really, really well." Extra features are welcome, but only
after the required scope is complete and tested - PLAN.md lists them in priority order, chosen
because they demonstrate judgment rather than adding surface area.

Do not skip the documentation. Database schema, API docs, and the one-page system design are
3 of the 8 required deliverables and are the most commonly skipped.

Build in the phase order given in PLAN.md (0 Foundation -> 10 Deploy). Commit and update
PROGRESS.md at every phase boundary.

CRIITCAL: I want the design to be very very professional and clean and really intuitive.. DO NOT USE NATIVE COMPONENT UI, Use OWn better animated UI/UX and MAKE SURE TO DO THE GLOBAL BASED COMPONENTS resuability and global based variable coloring sizing and stuff for better UI/UX OKAY! And make sure to have the Compact design. and it shouldn't feel like AI generated designs!

Start by:
  1. Reading the three files above.
  2. Creating PROGRESS.md and docs/DECISIONS.md.
  3. Telling me your Phase 0 plan - exact folder structure, dependencies with a one-line
     justification each, and the docker-compose setup.

Then wait for my go-ahead before scaffolding.
```

---

## Notes for you (the user), not for the implementer

**Keys this session will eventually need** — it can build most of the app without them, but these
are required to finish and demo:

| Key                                     | Where to get it                                                                       | Needed by |
| --------------------------------------- | ------------------------------------------------------------------------------------- | --------- |
| `DATABASE_URL`                          | Docker locally;[Neon](https://neon.tech) free tier for prod                           | Phase 0   |
| `GOOGLE_CLIENT_ID` / `SECRET`           | console.cloud.google.com → OAuth consent screen → Credentials → OAuth client ID (Web) | Phase 2   |
| `STRIPE_SECRET_KEY` / `PUBLISHABLE_KEY` | dashboard.stripe.com in**Test mode**                                                  | Phase 5   |
| `STRIPE_WEBHOOK_SECRET`                 | `stripe listen` locally; endpoint secret in prod                                      | Phase 5   |
| `ANTHROPIC_API_KEY`                     | console.anthropic.com (billed separately from Claude Code)                            | Phase 6   |

Also install the **Stripe CLI** for local webhook testing — the implementer will need it in Phase 5.

The last line makes it check in before scaffolding. Delete it if you would rather it just run.
