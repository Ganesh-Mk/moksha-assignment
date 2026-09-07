# Assignment Brief — distilled from the PDF

Source: `docs/AI Full Stack Developer Technical Interview Assignment.pdf`
Read this before touching code. Everything here is **required by the brief**, not invented.

---

## Framing (from the PDF, verbatim intent)

> "You may use AI coding tools... However, **you should be able to explain the implementation,
> architecture, and technical decisions** made during the interview."

> "The goal is **not to build a very large application**. We are evaluating **how you think, how you
> structure the application, how you solve real-world problems**, and how effectively you can build a
> **production-oriented AI application**."

**Read that carefully.** Breadth of features is explicitly *not* the win condition. Depth,
correctness, and defensibility are. A small app with airtight authz, a real webhook, and a clean
system-design doc beats a sprawling one with holes.

---

## Assignment 1 — Figma → Responsive React Page

**Objective:** convert the Figma design into a functional React app with a close visual match.

Figma: `https://www.figma.com/design/Yqq9qC4hZqj0adhv5kJUNG/Untitled?node-id=1-503`
File key `Yqq9qC4hZqj0adhv5kJUNG` · target frame `1:503`

### Required
- React + TypeScript
- Tailwind CSS
- shadcn/ui **where appropriate**
- Closely match the Figma design
- Fully responsive: Desktop/Laptop · Tablet · Mobile
- Reusable, well-structured components
- Clean, maintainable code
- Good frontend performance

### Deliverables
GitHub repo · Live/deployed URL · README with setup · Total development time · AI tools used + how

### Evaluation criteria → what it actually means
| Criterion | Concretely |
|---|---|
| Figma accuracy | Side-by-side diff vs the exported reference PNG. Spacing, type scale, colors. |
| Responsive design | No horizontal scroll at 320/768/1024/1440/1920. Nothing overlaps or clips. |
| UI quality | Polish: hover/focus states, smooth transitions, no jank. |
| Code quality | Strict TS, no `any`, small focused components, no duplication. |
| Performance | Lighthouse ≥ 95, LCP < 2.0s, images optimized + lazy, no CLS. |
| Component structure | Section components composed from primitives. Data separated from markup. |
| Development speed | Tracked, but subordinate to quality per user instruction. |
| Effective use of AI tools | Documented honestly in README. |

---

## Assignment 2 — Mini AI E-Commerce Application

**Objective:** e-commerce app with Google auth, customer+admin access, product/order management,
Stripe payments, and an AI support agent.

Must demonstrate the full chain:
`UI → API → Database → Authentication → Business Logic → AI → Integration`

### Frontend (React · TypeScript · Tailwind · shadcn/ui)
- Google Sign-In
- Product listing
- Product details
- Add to cart
- Basic checkout flow
- Customer order history

### Backend (Python · FastAPI · MongoDB **or** PostgreSQL → *we chose PostgreSQL*)
- User authentication
- Customer and Admin roles
- Product APIs
- Order APIs
- Basic RBAC

> **"The backend must enforce authorization. Do not rely only on frontend restrictions."**
> This is stated as its own emphasized line in the brief. Treat it as the highest-weight
> requirement in A2. It must be provably true, not merely intended — see the authz test suite
> requirement in the A2 plan.

### AI Support Agent (LangChain **or** LangGraph → *we chose LangGraph*)
Must answer at least:
- "What is the price of Product X?"
- "What products are available?"
- "What is the status of my order?"

> **"The AI agent should retrieve actual product and order information through backend APIs/tools
> rather than relying only on general LLM knowledge."**
> Tool-calling against real data is mandatory. A model answering from its own knowledge fails this.

### Required integration 1 — Google Sign-In
Flow: `Frontend → Google Sign-In → FastAPI → Verify User → Create/Login User → Authenticated Session`

Must support: Google Sign-In · new user registration · existing user login · logout · protected
customer routes.

### Required integration 2 — Stripe (TEST MODE)
Flow: `Frontend → FastAPI → Stripe Checkout → Payment → Webhook → Payment Verification → Order Status`

Must handle: create checkout session · successful payment · failed/cancelled payment · Stripe
webhook · **backend-side payment verification** · order status update after confirmation.

### Basic business logic — all explicitly listed
- Product stock
- Cart quantity
- Order creation
- Payment success/failure
- Customer vs Admin permissions
- Customers accessing **only their own** orders
- Admin-only product/order management
- Preventing unauthorized API access

### Simple system design (one page)
Must show: Frontend · FastAPI backend · Database · AI Agent · Google Authentication · Stripe ·
**AWS/deployment approach**

Plus a brief written answer to:
> "How would you scale this application if the number of users and AI requests increased
> significantly?"

### Deliverables
GitHub repo · Live/demo URL · README · **Database schema** · **Basic API documentation** ·
**One-page system design** · Total time taken · AI tools used

---

## What they are looking for (final section of the PDF)
Frontend implementation · Backend/API development · Authentication · Business logic ·
AI integration · Third-party API integration · System design · Code quality · Problem-solving ·
Development speed · Effective use of AI development tools

---

## Admin's read on where marks are won and lost

**Highest leverage, most commonly failed:**
1. **Server-side authz that actually holds.** Most candidates hide the admin button and call it
   done. Prove it with tests that a customer's token gets `403` on every admin route and cannot
   read another user's order.
2. **A real Stripe webhook** with signature verification and **idempotency**. Stripe retries
   deliveries; a naive handler double-decrements stock. Handling that unprompted is a strong signal.
3. **Server-authoritative pricing.** Never trust a client-sent total. Recompute from the DB.
4. **Agent tools that respect identity.** "What is the status of my order?" must be scoped to the
   caller. An agent that can be prompt-injected into reading someone else's orders is a security
   bug, and a memorable one to catch.
5. **The docs.** Schema, API docs, and system design are 3 of 8 listed deliverables. They are cheap
   to produce and frequently skipped. Do not skip them.

**Deliberate extras that raise the ceiling** (the user asked for extras for visibility — these are
chosen because they *demonstrate judgment*, not because they add surface area):
- Idempotent webhook + `stripe_events` ledger table
- Optimistic-locking / row-lock on stock decrement to prevent oversell under concurrency
- Structured request logging with correlation IDs
- Rate limiting on the AI endpoint (cost control — a real production concern)
- Streaming agent responses (SSE)
- Seeded demo data + a one-command `docker compose up`
- A short `DECISIONS.md` (ADR-lite) — directly feeds the "explain your decisions" interview
