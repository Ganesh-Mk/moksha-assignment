# Moksha — AI Full Stack Developer Technical Assignment

Submission for the AI Full Stack Developer technical interview assignment.
Two independent deliverables in one repository.

| | Assignment | Stack | Live |
|---|---|---|---|
| **1** | [Figma → Responsive React Page](./hydra-curls) | React 19 · TypeScript · Vite · Tailwind v4 · shadcn/ui | _TBD_ |
| **2** | [Mini AI E-Commerce Application](./moksha-ecommerce) | React · TS · Tailwind · shadcn · FastAPI · PostgreSQL · LangGraph · Stripe | _TBD_ |

---

## Repository layout

```
Moksha/
├── docs/
│   ├── AI Full Stack Developer Technical Interview Assignment.pdf   # source brief
│   ├── ASSIGNMENT_BRIEF.md          # distilled requirements + evaluation criteria
│   └── figma/
│       ├── DESIGN_SPEC.md           # extracted design tokens, section map, constraints
│       ├── raw/                     # Figma node tree + image refs (regenerable)
│       └── reference/               # reference renders for visual diffing
│
├── hydra-curls/                     # ASSIGNMENT 1
│   ├── PLAN.md · CLAUDE.md · PROGRESS.md · README.md
│   ├── scripts/figma-extract.mjs    # Figma REST API extraction pipeline
│   └── src/
│
├── moksha-ecommerce/                # ASSIGNMENT 2
│   ├── PLAN.md · CLAUDE.md · PROGRESS.md · README.md
│   ├── backend/                     # FastAPI + PostgreSQL + LangGraph
│   ├── frontend/                    # React + TypeScript
│   └── docs/                        # SYSTEM_DESIGN · DATABASE_SCHEMA · API · DECISIONS
│
├── CLAUDE.md                        # shared working agreement
├── .env.example                     # environment template
└── .gitignore
```

---

## Assignment 1 — Hydra Curls

A 1920 × 15249px Figma landing page for *Parachute Advanced — Hydra Curls*, rebuilt as a
responsive React application.

- Full design extraction via the Figma REST API (95 image assets, complete node tree)
- 16 sections, semantic flow layout, fluid `clamp()` type scale
- Responsive across mobile / tablet / laptop / desktop
- Performance-first: AVIF/WebP, explicit dimensions, lazy loading below the fold

→ [Setup and details](./hydra-curls/README.md)

## Assignment 2 — Moksha AI E-Commerce

An e-commerce application demonstrating the full chain
`UI → API → Database → Authentication → Business Logic → AI → Integration`.

- Google OAuth → server-verified ID token → application JWT
- Customer / admin RBAC **enforced server-side**
- Stripe Checkout (test mode) with a signature-verified, idempotent webhook
- LangGraph support agent whose tools query real product and order data, scoped to the caller
- Concurrency-safe stock handling; server-authoritative order totals

→ [Setup and details](./moksha-ecommerce/README.md)
→ [System design](./moksha-ecommerce/docs/SYSTEM_DESIGN.md)
→ [Database schema](./moksha-ecommerce/docs/DATABASE_SCHEMA.md)
→ [API documentation](./moksha-ecommerce/docs/API.md)

---

## Quick start

```bash
git clone <repo-url> && cd Moksha
cp .env.example .env        # fill in your keys

# Assignment 1
cd hydra-curls && npm install && npm run dev

# Assignment 2
cd moksha-ecommerce && docker compose up
```

---

## AI tools used

_To be completed on submission — see each assignment's README for detail._

## Total development time

_To be completed on submission._
