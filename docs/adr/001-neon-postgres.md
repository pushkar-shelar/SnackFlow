# ADR 001: Neon Serverless Postgres for Hosted Demo and CI Branching

## Status
**Accepted**

## Date
2026-11-20

## Context & Problem Statement
SnackFlow requires a hosted cloud database for live demo deployments and pull request CI validation, while strictly preserving 100% offline local evaluation for evaluators via `docker compose up --build`. The database must enforce strict relational integrity, PostgreSQL triggers (e.g. append-only `stock_ledger`), row-level concurrency locking (`SELECT ... FOR UPDATE`), and exact fixed-precision decimal arithmetic (`NUMERIC(14,2)`, `NUMERIC(14,4)`, `NUMERIC(14,6)`).

## Decision
We adopt **Neon Serverless PostgreSQL** as the single system of record for cloud environments, paired with standard **PostgreSQL 16 Alpine** for local Docker execution.

### Key Architectural Choices:
1. **Dual-Profile Connection Strategy:**
   - `DATABASE_URL`: Pooled connection string (`-pooler` endpoint) running in transaction mode, utilizing `app_runtime` credentials.
   - `DIRECT_URL`: Unpooled direct connection string used strictly for Prisma CLI schema migrations and master seed scripts with owner privileges.
   - `READONLY_DATABASE_URL` / `READ_REPLICA_URL`: Pooled read-only endpoint utilized by `PrismaReadService` for auditor and reporting queries.
2. **Least-Privilege Roles:**
   - `app_runtime`: Granted operational DML, but explicitly denied `UPDATE` and `DELETE` on `stock_ledger` and `audit_log`.
   - `app_readonly`: Strictly limited to `SELECT` operations across all schema objects.
3. **Resilience & Scale-to-Zero Handling:**
   - Startup connections implement bounded retry (up to 3 attempts with exponential backoff: 2s, 4s, 8s).
   - `DB_CONNECT_TIMEOUT_S` configured to 15s to absorb scale-to-zero wake-up latency.
4. **Ephemeral Branching in CI:**
   - GitHub Actions spawns copy-on-write branches (`ci/<run_id>`) from `seed-baseline`, validates migrations and benchmarks, and tears down the branch upon completion.
5. **No MongoDB (Explicit Rejection):**
   - MongoDB was evaluated and strictly rejected because it lacks declarative database triggers for append-only immutability, lacks native fixed-point `NUMERIC` types required for statutory paise precision, and introduces operational overhead for ACID transactions across multi-line invoices, ledger postings, and inventory reservations.

## Consequences
- **Positive:** Evaluators can run the entire system offline with zero external dependencies, or connect to Neon in the cloud without modifying application code.
- **Positive:** Zero idle hosting costs on Neon when the system is inactive.
- **Positive:** Instant isolated database branches for CI testing without seeding delays.
- **Negative / Trade-off:** First request after prolonged idle may encounter a 1-3 second cold-start delay, handled gracefully via health-check timeouts.
