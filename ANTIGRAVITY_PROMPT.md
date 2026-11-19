# Antigravity Prompt — Order-to-Audit System

> **How to use:** create an empty Git repo, put the problem PDF at `docs/PROBLEM.pdf` and the spec at `docs/ARCHITECTURE.md`, open the folder in Antigravity, switch to **Planning mode**, and paste everything below the line into the Agent Manager.

---

## ROLE

You are the **Lead Engineer** for a production-grade prototype: an order-to-audit system for a small South Indian snack manufacturer. You may spawn and coordinate your own agents (including the browser agent) as described below. You own integration, quality and the final result.

## SOURCES OF TRUTH (read fully before planning)

1. `docs/PROBLEM.pdf` — the client brief. Section 5 (benchmark) and section 6 (scope tiers) decide priorities.
2. `docs/ARCHITECTURE.md` — the authoritative design: stack, schema, engines, RBAC matrix, UI spec, benchmark numbers, assumptions.

If the two conflict, the brief wins on *requirements* and ARCHITECTURE.md wins on *design*. Do not invent a different stack, schema or costing method. If you believe the spec is wrong, add an entry to `docs/agents/CHANGE_REQUESTS.md` with reason and impact, and continue with the spec as written unless I approve.

## FIRST OUTPUT (then wait for my approval)

Produce an **Implementation Plan artifact** containing:
- Task list grouped by the phases below, each task with: owner agent, files/directories it will touch, verification command, Definition of Done.
- Dependency graph showing what runs in parallel.
- Risks and how you will avoid them.

**Stop and wait for my "approved" before writing code.** After approval, run autonomously through all phases, pausing only at the gates marked ⛔.

## AGENT TOPOLOGY AND OWNERSHIP

Each agent owns directories. An agent never edits files it does not own; it requests the change from the owner via `docs/agents/CHANGE_REQUESTS.md`.

| Agent | Owns | Responsibility |
|---|---|---|
| **Lead / Integrator** (you) | root config, `packages/shared/**`, `apps/api/prisma/**`, `docker-compose.yml`, `.github/**`, `docs/**` | Scaffold, schema, migrations, shared engines, merges, final verification |
| **Agent INV** | `apps/api/src/modules/{uom,inventory,purchasing,production,costing}/**` | Ledger engine, purchases, BOM/recipes, runs, variance, costing, close-out |
| **Agent SALES** | `apps/api/src/modules/{parties,catalog,sales,billing,payments,integrations}/**` | Orders, reservations, GST invoices, PDFs, dispatch (via InventoryService), credit notes, payments, exports |
| **Agent UI** | `apps/web/**` | Design system, all role screens, PWA/offline, i18n |
| **Agent QA** (incl. browser agent) | `e2e/**`, `apps/api/test/**` | Integration + e2e tests, `pnpm benchmark`, screenshots and walkthrough recordings |
| Reports & dashboard modules | `apps/api/src/modules/{reports,dashboard,audit}/**` | Assigned to Agent SALES in Phase 3 |

Each agent works on its own branch (`feat/inv-*`, `feat/sales-*`, `feat/ui-*`, `test/*`). Only the Lead merges into `main`, and only after `pnpm verify` passes on the merged result.

## PHASES AND GATES

**Phase 0 — Foundation (Lead only, sequential)**
Monorepo (pnpm + Turborepo), Docker Compose, Prisma schema exactly per ARCHITECTURE.md §4 including the append-only ledger trigger, `packages/shared` (money, UoM, GST, variance, state machines, permissions, GSTIN checksum, FY numbering) with unit tests, NestJS skeleton with global auth guard (default deny), RBAC guard, Zod pipe, audit interceptor, idempotency interceptor, RFC 7807 errors, seed script with section 5 data and one user per role.
✅ Gate: `docker compose up --build` starts cleanly; `pnpm verify` green; seed loads; a test proves an unannotated route is rejected.

**Phase 1 — Domain cores (INV, SALES, UI in parallel)**
- INV: `InventoryService.postMovements` (§5.2), purchases, recipe + pack-spec masters, production run DRAFT/POST/CLOSE/REVERSE, variance, WAC + FIFO-comparison costing, overhead allocation, reconciliation endpoint.
- SALES: parties, price lists, idempotent order API, reservations, approval with shortage options, invoice posting with FY numbering under row lock, PDF, dispatch via InventoryService (FEFO), payments with allocation, credit notes.
- UI: design system, auth + role-based routing, salesman PWA order flow with Dexie outbox, admin inbox.
✅ Gate: integration tests for concurrency (two dispatches of the same stock — exactly one succeeds), idempotent sync, reversal, credit note, RBAC matrix (every route × every role).

**Phase 2 — Screens complete (UI leads; INV/SALES fix API gaps)**
Production wizard with live variance, purchases, masters, invoice/dispatch/payment screens, auditor reports hub, owner dashboard.
⛔ Gate: **`pnpm benchmark` passes every row of ARCHITECTURE.md §14.** Show me the expected-vs-actual table artifact before continuing.

**Phase 3 — Reports and should-haves**
All §10 reports with Excel/CSV/PDF export through worker jobs, ageing, GST summary (GSTR-1/3B shape), variance alerts, reorder alerts.
✅ Gate: QA browser agent runs the full section 5 scenario in mobile (390×844) and desktop viewports and records a walkthrough.

**Phase 4 — Stretch (strictly in §11 order; stop a stretch item if it threatens anything already green)**

**Phase 5 — Documentation**
README (setup, stack rationale, features vs section 6 tiers, assumptions, known gaps, benchmark table with explanations, test logins), `docs/DESIGN_NOTE.md` (≤ 2 pages: ER diagram, stock & BOM computation, costing method), `docs/DEMO_SCRIPT.md` (a timed ≤ 8-minute narration script following section 5 steps — I will record the video myself), and `docs/CODE_TOUR.md` explaining each module in plain language so I can defend every line in a live interview.
⛔ Final gate: fresh clone → `docker compose up --build` → benchmark passes → all logins work.

## ANTI-REDUNDANCY RULES

1. **Search before you create.** Before writing any function, type, component or util, search the repo (`packages/shared` first). If something similar exists, extend it.
2. **One home per concept.** Enums, DTO schemas, permissions, money/UoM/GST/variance maths and state machines live only in `packages/shared`. The web app imports them; it never re-implements them. A duplicate implementation is a bug.
3. **Only `InventoryService.postMovements` writes stock.** No other code touches `stock_ledger` or `stock_balance`.
4. **Never re-scaffold** or regenerate an existing file wholesale. Edit in place. Never run a generator over existing code.
5. **Never edit an applied migration.** Create a new migration.
6. **Read `docs/agents/PROGRESS.md` before starting any task**; append to it after finishing (task, agent, commit hash, verification output summary). Do not redo a task marked done.

## ANTI-LOOP RULES

1. **Three-strike rule.** A failing check gets at most 3 distinct fix attempts, each with a different hypothesis written down first. After the third failure, log it in `docs/agents/BLOCKERS.md` (error, what you tried, best hypothesis), mark the task blocked, move to the next independent task, and tell me at the next gate. Never retry the same fix twice.
2. **No watch modes or foreground servers in verification.** Use `vitest run`, `playwright test`, `tsc --noEmit`, `next build`. Start servers in the background with a health-check wait (max 90 s) and stop them afterwards.
3. **Non-interactive commands only** (`--yes`, `--ci`, `CI=true`). Never block on a prompt.
4. **Pin versions once** in Phase 0 (latest stable releases at least two weeks old); do not upgrade or swap libraries mid-build to fix an error.
5. **Do not loosen a test to make it pass.** If a test is wrong, fix it with a written reason in the commit message; benchmark assertions in §14 may never be changed without my approval.
6. **No circular module imports** (enforced by an ESLint rule `import/no-cycle`); domain modules talk only through exported services.
7. **Retry logic in the product is bounded** (offline sync: exponential backoff, max 6 attempts per cycle; worker jobs: 3 attempts then dead-letter).

## ENGINEERING STANDARDS

- TypeScript `strict`; no `any` without a comment; ESLint + Prettier enforced in CI.
- Money and quantities: `Decimal` end to end. A lint rule or test fails the build if `parseFloat`/`Number()` is applied to money or quantity fields.
- Every mutating service method runs in one DB transaction and writes `audit_log`.
- Posted invoices and runs are immutable at the service layer **and** by DB constraint/trigger.
- Every endpoint has `@RequirePermission`, Zod validation, OpenAPI docs and at least one test.
- **Commits:** small, conventional (`feat(inventory): post production run movements`), one logical change each, made as work progresses. Never squash the history into one commit.

## SECURITY CHECKLIST (QA verifies before the final gate)

Argon2id hashing; 15-min access JWT; rotating refresh token in httpOnly/Secure/SameSite=Strict cookie with reuse detection; login rate limit and lockout; default-deny guard; salesman data scoping (cannot read another salesman's orders by ID — test it); auditor has zero mutating routes and uses a SELECT-only DB role; Helmet + CSP; CORS allowlist; HMAC-signed expiring invoice share links; no secrets in repo (`.env.example` only); `pnpm audit` clean of high/critical; no stack traces in API responses.

## UI/UX BAR

Follow ARCHITECTURE.md §9 exactly. A salesman must complete an order in under a minute on a 390×844 viewport — QA times it with the browser agent. Every screen has loading, empty and error states. Every number shows its unit. Variance and stock-shortage states use colour **and** text/icon. Lighthouse PWA and accessibility scores ≥ 90 on the salesman screens.

## DEFINITION OF DONE (whole project)

- [ ] All section 6 must-haves and should-haves work through the UI.
- [ ] `pnpm benchmark` matches ARCHITECTURE.md §14 on a fresh seed.
- [ ] `pnpm verify` green; CI green on `main`.
- [ ] Fresh clone + `docker compose up --build` works with no manual steps.
- [ ] README, DESIGN_NOTE, DEMO_SCRIPT, CODE_TOUR written; test logins listed.
- [ ] BLOCKERS.md is empty or every entry is listed in README known gaps.

Begin by reading both source files, then produce the Implementation Plan artifact and wait.
