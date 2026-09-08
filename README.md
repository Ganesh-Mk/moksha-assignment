# Moksha — AI Full Stack Developer Technical Assignment

Two deliverables, one repository.

| | Assignment | Live | Code |
|---|---|---|---|
| **1** | Figma → responsive React page | **[moksha-hydra-curls.vercel.app](https://moksha-hydra-curls.vercel.app/)** | [`hydra-curls/`](./hydra-curls) |
| **2** | Mini AI e-commerce app | **[moksha-ecommerce.vercel.app](https://moksha-ecommerce.vercel.app/)** · [API docs](https://moksha-api-mv1j.onrender.com/docs) | [`moksha-ecommerce/`](./moksha-ecommerce) |

> **Signing in to assignment 2** — admin password **`moksha@123`**, or sign in with Google as a
> customer. The AI assistant is the chat button, bottom right. Stripe is in test mode: card
> `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined.
>
> The API is on free-tier hosting, so the first request may take ~50 seconds to wake.

---

## Documentation

**Assignment 1**
[README](./hydra-curls/README.md) · [build log](./hydra-curls/PROGRESS.md) ·
[design spec extracted from Figma](./docs/figma/DESIGN_SPEC.md)

**Assignment 2**
[README](./moksha-ecommerce/README.md) · [system design](./moksha-ecommerce/docs/SYSTEM_DESIGN.md) ·
[database schema](./moksha-ecommerce/docs/DATABASE_SCHEMA.md) ·
[API reference](./moksha-ecommerce/docs/API.md) ·
[design decisions](./moksha-ecommerce/docs/DECISIONS.md) ·
[build log](./moksha-ecommerce/PROGRESS.md)

**Shared**
[the brief, distilled](./docs/ASSIGNMENT_BRIEF.md)

---

## Assignment 1 — Hydra Curls

A 1920 × 15249px Figma landing page rebuilt as a responsive React app.

React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui

- Design pulled through the Figma REST API — full node tree and 95 image assets — so measurements
  came from the file rather than from eyeballing a screenshot
- 16 sections rebuilt with semantic flow layout and a fluid `clamp()` type scale
- Responsive 320px → 1920px
- AVIF/WebP with explicit dimensions and lazy loading below the fold

Two fonts in the design are licensed and could not ship — the substitutions are explained in the
[README](./hydra-curls/README.md).

## Assignment 2 — Moksha

An e-commerce app proving the chain `UI → API → Database → Auth → Business logic → AI → Integration`.

React · TypeScript · Tailwind · shadcn/ui · FastAPI · PostgreSQL · LangGraph · Stripe

- Google OAuth → server-verified ID token → application JWT
- Customer/admin RBAC **enforced server-side**, with tests asserting it on every route
- Stripe Checkout with a signature-verified, idempotent webhook — payment state comes from the
  webhook, not the browser redirect
- LangGraph agent whose tools read real product and order data, scoped to the signed-in user. It
  can fill a cart; it cannot spend anyone's money
- Order totals recomputed from the database; stock decremented under a row lock so concurrent
  checkouts cannot oversell
- Admin console — catalogue, order queue, customers, activity chart

---

## Running locally

```bash
cp .env.example .env        # fill in your keys

cd hydra-curls && npm install && npm run dev

cd moksha-ecommerce && docker compose up
```

Per-assignment setup, environment variables and test commands are in each folder's README.

---

## AI tools

Claude Code, used throughout the build. The architecture, design and UI/UX decisions were mine.

## Time taken

Roughly 12 hours in total, working on both assignments in parallel.
