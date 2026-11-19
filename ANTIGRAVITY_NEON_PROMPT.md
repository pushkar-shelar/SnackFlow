# Antigravity Prompt — Neon (Serverless Postgres) Implementation

> **How to use:** paste everything below the line into Antigravity's Agent Manager in **Planning mode**. It works whether the project is not started yet (Neon setup becomes part of Phase 0) or already partly built (the agent treats it as a change and keeps everything green). Before you start, create a Neon project yourself (choose the region closest to India and the same Postgres major version as the local Docker image), and keep the connection strings and an API key ready. **Never paste secrets into the chat**; put them in `.env` and GitHub Secrets.

---

## ROLE

You are the **Lead / Integrator** agent from `ANTIGRAVITY_PROMPT.md`. This task belongs to you because it touches files you own: `apps/api/prisma/**`, root config, `docker-compose.yml`, `.github/**` and `docs/**`. Do not delegate it to a domain agent. You may use the browser agent only to verify the deployed demo.

## GOAL

Make **Neon serverless Postgres** the hosted database for the demo and CI, while:
- keeping local Docker Postgres for `docker compose up --build` (evaluators must be able to run offline), and
- keeping one codebase and one migration history. Only environment variables differ between local and Neon.

**MongoDB is out of scope.** Do not add it, any second database, or any dual-write logic. Neon is the only system of record. Redis remains only for the job queue.

## SOURCES OF TRUTH

1. `docs/ARCHITECTURE.md`: schema, ledger rules, RBAC, benchmark (§14). Unchanged by this task except for the new section you add (step 9).
2. The **current official Neon docs** for Prisma and connection pooling, and the **docs for the Prisma version already pinned in this repo**. Read them before writing config. Prisma has moved where connection URLs are configured (schema `datasource` vs `prisma.config.ts`) across major versions, so follow the pinned version's docs exactly. Do not upgrade Prisma to make Neon work.

## FIRST OUTPUT (then wait for approval)

An Implementation Plan artifact listing: current repo state (detected, not assumed), each step below with the files touched, the verification command and Definition of Done, plus the exact env variables and GitHub Secrets I must create. **Wait for my "approved".**

## STEPS

### 1. Environment contract
Create or extend `apps/api/src/config/env.ts`, validated with Zod at startup. The app refuses to start on missing or malformed values, and never logs secret values.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Runtime, **pooled** Neon endpoint (hostname contains `-pooler`), `sslmode=require`; runtime role `app_runtime` |
| `DIRECT_URL` | Migrations and seed, **direct** endpoint; owner role |
| `READONLY_DATABASE_URL` | Pooled, role `app_readonly` (SELECT only), used by reports and auditor endpoints |
| `READ_REPLICA_URL` | Optional. If set, heavy report queries use it; if unset, fall back to `READONLY_DATABASE_URL` |
| `DB_POOL_SIZE` | Per-instance Prisma pool size (default 5; keep small, Neon pools server-side) |
| `DB_CONNECT_TIMEOUT_S` | Default 15, to absorb scale-to-zero cold starts |
| `APP_TZ` | `Asia/Kolkata` |

Commit `.env.example` (placeholders only) for **both** profiles: local Docker and Neon. `.env` stays git-ignored. Add a secret-scanning step to CI (gitleaks or equivalent).

### 2. Database roles (least privilege, defence in depth)
- **Owner role** (Neon's default owner): migrations and seed only, via `DIRECT_URL`.
- **`app_runtime`**: `SELECT, INSERT, UPDATE` on business tables, `INSERT, SELECT` only on `stock_ledger` and `audit_log` (no UPDATE/DELETE), `USAGE` on sequences.
- **`app_readonly`**: `SELECT` only, used by auditor and report endpoints.

Create the roles with the Neon console, API or `neonctl` (they generate the passwords). Write all `GRANT`/`REVOKE` statements, plus `ALTER DEFAULT PRIVILEGES` so future tables inherit them, in an **idempotent SQL migration**. Locally, `docker/postgres/init/01-roles.sql` creates the same roles with dev passwords, so local and Neon behave identically. The existing append-only trigger on `stock_ledger` stays: privileges and the trigger are two independent guards.

### 3. Prisma clients
In `apps/api/src/database/`, create exactly **two** providers, reusing any that already exist rather than adding parallel ones:
- `PrismaService` → `DATABASE_URL` (all writes and transactional reads)
- `PrismaReadService` → `READ_REPLICA_URL` ?? `READONLY_DATABASE_URL` (reports, dashboard, auditor)

Rules:
- All posting logic (ledger, invoices, runs, payments) uses **interactive transactions on `PrismaService`**. `SELECT … FOR UPDATE` inside a transaction is compatible with transaction-mode pooling; keep it.
- **No session-level state** through the pooler: no session `SET`, session advisory locks, `LISTEN/NOTIFY` or session temp tables. Request context for audit/DB triggers uses `SET LOCAL` (or `set_config(..., true)`) **inside** the transaction.
- If prepared-statement errors appear, check the current Neon and Prisma docs for the recommended pooler setting **once**, apply it, and note it in the ADR. Do not cycle through random URL flags.
- Graceful shutdown disconnects both clients.

### 4. Migrations and seed
- `prisma migrate deploy` and `prisma db seed` always use `DIRECT_URL`. Never run `migrate dev` or `db push` against Neon.
- The seed is **idempotent** (upserts by natural keys such as SKU, GSTIN and username) and loads exactly the section 5 data plus one user per role.
- Add scripts: `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset:local` (Docker only; refuses to run if the URL host is not localhost or the compose service name).

### 5. Time and money correctness on a cloud DB
- All timestamps are `timestamptz` stored in UTC. The DB session time zone is not relied on.
- Financial year, month-end reports, ageing and invoice dates are computed in `APP_TZ` (Asia/Kolkata) by shared helpers in `packages/shared`. Add tests for 31 March 23:30 IST and 1 April 00:30 IST (FY boundary) and a month-end boundary.
- Money and quantity stay `NUMERIC` / `Decimal`; nothing changes there.

### 6. Resilience (bounded, no loops)
- `/health` = process up. `/ready` = `SELECT 1` on both clients, with a timeout of `DB_CONNECT_TIMEOUT_S`.
- Startup DB connect: at most 3 attempts with exponential backoff (2 s, 4 s, 8 s), then exit non-zero with a clear message. No infinite retry.
- A transaction that fails on serialization or deadlock is retried **at most twice** with jitter, only for errors flagged as retryable, then surfaces as RFC 7807 `409`.
- Cold start: document that the first request after idle may be slow. Do not add a keep-warm pinger that burns compute unless I ask.

### 7. Neon branching in CI (the showcase)
Add a GitHub Actions job using Neon's official create/delete-branch actions, or `neonctl` with `NEON_API_KEY` and `NEON_PROJECT_ID` secrets:
1. Create branch `ci/<run_id>` from a branch named `seed-baseline` (a branch holding the migrated + seeded state).
2. Run `pnpm db:migrate` against it (applies any new migrations), then `pnpm verify` and `pnpm benchmark`.
3. **Always** delete the branch in a final step that runs even when earlier steps fail (`if: always()`), and set a branch expiry/TTL as a second safety net.
4. Pull requests get a comment with the benchmark expected-vs-actual table.

Also keep the existing CI job that runs everything against Docker Postgres, so the project never depends on Neon to pass CI.

### 8. Demo environment for evaluators
- Branch `main` = my demo data. Branch `evaluator` = branched from `seed-baseline`, used by the public demo link, so evaluators can rerun the benchmark freely.
- Add `pnpm demo:reset`, which resets `evaluator` to `seed-baseline` through the Neon API / `neonctl`. Document it in the README. It requires `NEON_API_KEY` locally and refuses to touch `main`.

### 9. Documentation (Lead owns docs)
- Add **§17 "Database hosting (Neon)"** to `docs/ARCHITECTURE.md`: one system of record, the pooled vs direct URLs, the three roles, branching strategy, cold starts, and why MongoDB was not used (cross-table ACID transactions, row locks, exact `NUMERIC`, foreign keys, ledger triggers, SQL reporting).
- Write ADR `docs/adr/00X-neon-postgres.md` (context, decision, consequences, alternatives considered).
- Update the README setup with two paths, "Run locally (Docker)" and "Hosted (Neon)", plus the env variable table.
- Append to `docs/agents/PROGRESS.md`.

## VERIFICATION GATES

1. Local: fresh clone → `docker compose up --build` → `pnpm verify` and `pnpm benchmark` green, with **no Neon variables set**.
2. Neon: `pnpm db:migrate && pnpm db:seed` against a scratch Neon branch → `pnpm benchmark` green → the seed run twice produces identical results (idempotency).
3. Privileges: integration test proves `app_runtime` cannot `UPDATE`/`DELETE` `stock_ledger` or `audit_log`, and `app_readonly` cannot write anything.
4. Concurrency on Neon: the two-simultaneous-dispatches test passes on the pooled URL (exactly one succeeds).
5. CI: a PR run creates and deletes its Neon branch; the Neon console shows no leftover `ci/*` branches.
6. ⛔ Show me the gate results as an artifact before merging to `main`.

## RULES (same as the main prompt)

- Search before creating; extend existing config and database modules instead of adding parallel ones.
- Three-strike rule on any failing check, then log to `docs/agents/BLOCKERS.md` and stop that step.
- No watch modes, no interactive CLI prompts (`--yes`/`CI=true`), no version upgrades to fix errors.
- Never print, commit or echo connection strings or API keys, including in logs, artifacts, test snapshots and commit messages.
- Small conventional commits, e.g. `feat(db): add pooled and read-only Prisma clients`, `ci(neon): ephemeral branch per run`.

Begin by inspecting the repo and the pinned Prisma version, then produce the Implementation Plan artifact and wait.
