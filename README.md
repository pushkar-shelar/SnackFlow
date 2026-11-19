# SnackFlow — Order-to-Audit ERP System

> **A production-grade manufacturing ERP prototype for packaged food manufacturers, built for the NIT Trichy Centre for Development of Insights (CDI) Internship Evaluation.**  
> Modeled on **Sri Murugan Snacks** (Madurai, Tamil Nadu — GSTIN: `33AAAAA0000A1Z5`).

[![CI](https://github.com/snackflow/snackflow/actions/workflows/ci.yml/badge.svg)](https://github.com/snackflow/snackflow/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.3-red.svg)](https://turbo.build/)
[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-Ready-2496ED.svg)](https://docs.docker.com/compose/)

---

## 1. Executive Summary & Core Architectural Invariants

SnackFlow connects the physical factory floor, field sales, inventory, and statutory compliance into a unified, tamper-proof system with **zero floating-point math** and an **append-only inventory ledger**.

### Non-Negotiable Engineering Standards:
1. **Enter Once, at Source:** Salesmen capture orders on a mobile PWA; operators record yields on a tablet wizard. Data flows automatically into inventory, production, accounts, and GST with zero manual re-entry.
2. **Append-Only Ledger:** Stock balances are strict projections of `stock_ledger`. No balances are manually edited. An authoritative PostgreSQL trigger (`trg_stock_ledger_append_only`) physically rejects any `UPDATE` or `DELETE` statement at the database engine level.
3. **Strict Fixed-Point Precision (No Floats):** Every monetary calculation uses `Decimal(14,2)`, quantities use `Decimal(14,4)`, and moving weighted costs use `Decimal(14,6)`. A custom ESLint AST rule fails the build if `parseFloat` or `Number()` is applied to numbers.
4. **Default-Deny Security:** Every HTTP endpoint requires an explicit `@RequirePermission()` decorator or fails at build and runtime with HTTP 403 Forbidden.
5. **Deterministic Concurrency Control:** All inventory movements route exclusively through `InventoryService.postMovements()`, which acquires sorted row-level locks (`SELECT ... FOR UPDATE`) across `(item_id, batch_id)` to prevent deadlocks and double-spending.

---

## 2. Quickstart & Deployment Options

### Option A: Run Locally (Offline Evaluator via Docker Compose)
Evaluators can run SnackFlow 100% offline with zero cloud dependencies:

```bash
# 1. Clone the repository
git clone https://github.com/snackflow/snackflow.git
cd SnackFlow

# 2. Copy the environment template
cp .env.example .env

# 3. Boot all services with Docker Compose
docker compose up --build
```

The system initializes PostgreSQL 16, Redis 7, applies migrations, executes seed data, and boots:
- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **API Server & OpenAPI Docs:** [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **Mailpit Email Inspector:** [http://localhost:8025](http://localhost:8025)

### Option B: Hosted Cloud Deployment (Neon Serverless Postgres)
SnackFlow natively supports **Neon Serverless PostgreSQL** for cloud hosting and copy-on-write CI branching:

```bash
# Set your Neon connection strings in .env:
DATABASE_URL="postgresql://app_runtime:PASSWORD@ep-sample-pooler.ap-southeast-1.aws.neon.tech/snackflow?sslmode=require"
DIRECT_URL="postgresql://snackflow_owner:PASSWORD@ep-sample.ap-southeast-1.aws.neon.tech/snackflow?sslmode=require"
READONLY_DATABASE_URL="postgresql://app_readonly:PASSWORD@ep-sample-pooler.ap-southeast-1.aws.neon.tech/snackflow?sslmode=require"

# Deploy migrations & seed baseline data:
pnpm db:migrate
pnpm db:seed
```

---

## 3. Test Credentials & 5 Persona Profiles

SnackFlow features an interactive **Persona Switcher** in the navigation header allowing instant switching between all 5 seeded roles:

| Persona | Name | Seeded Email | Password | Primary Scope & Access |
|---|---|---|---|---|
| **Salesman** | Ramu S | `salesman@snackflow.com` | `Password@123` | Mobile PWA ($390 \times 844$), offline Dexie outbox, customer orders, live GST preview. |
| **Admin** | Kavitha N | `admin@snackflow.com` | `Password@123` | Split-view order inbox, keyboard shortcuts (`A`/`R`/`H`), one-click invoice & dispatch, WhatsApp & UPI QR. |
| **Production** | Muthu K | `production@snackflow.com` | `Password@123` | Industrial tablet wizard ($\ge 44\text{px}$ targets), BOM auto-fill, live $\pm 3\%$ variance alerts, overhead close-out. |
| **Auditor** | Sankaran & Co | `auditor@snackflow.com` | `Password@123` | Strict read-only view, ledger-balance reconciliation verification, GSTR-1 & GSTR-3B, Excel/CSV exports. |
| **Owner** | S. Murugesan | `owner@snackflow.com` | `Password@123` | Executive BI overview, 37.7% gross margin, yield alerts, Ind AS 2 WAC vs FIFO comparison, debtor ageing. |

---

## 4. Section 14 Authoritative Benchmark Reproduction

SnackFlow implements an automated benchmark test suite validating 100% of the numbers from **ARCHITECTURE.md §14** against the end-to-end operational sequence from Section 5:

```bash
pnpm benchmark
```

### Benchmark Results (15 / 15 Passed):

| # | Benchmark Check | Authoritative Target (`§14`) | System Output | Status |
|---|---|---|---|:---:|
| 1 | **Flour closing stock** | **120 kg**, value ₹5,175.00 @ ₹43.125 | `120 kg @ ₹43.125 (₹5,175.00)` | **PASS** |
| 2 | **Oil closing stock** | **19.5 L** | `19.5 L` | **PASS** |
| 3 | **Spice mix closing stock** | **3.8 kg** | `3.8 kg` | **PASS** |
| 4 | **Pouches closing stock** | **306 pouches** | `306 pouches` | **PASS** |
| 5 | **Cartons closing stock** | **21 cartons** | `21 cartons` | **PASS** |
| 6 | **FG stock after run** | **238 packets** | `238 packets` | **PASS** |
| 7 | **Yield variance** | **−6.0 %, flagged** | `-6.00% (Flagged)` | **PASS** |
| 8 | **Oil consumption variance** | **+5.0 %, flagged** | `+5.00% (Flagged)` | **PASS** |
| 9 | **Pouch consumption variance** | **+3.19 %, flagged** | `+3.19% (Flagged)` | **PASS** |
| 10 | **Retailer A invoice** | **₹7,500 + ₹187.50 CGST + ₹187.50 SGST = ₹7,875** | `₹7,875.00` | **PASS** |
| 11 | **FG stock after Retailer A dispatch** | **88 packets** (Strict FEFO: 50 opening + 100 run) | `88 packets` | **PASS** |
| 12 | **Retailer A outstanding** | **₹3,875.00** (₹7,875 - ₹4,000 payment) | `₹3,875.00` | **PASS** |
| 13 | **Distributor B shortage** | **Short by 32 flagged; backorder 32** | `88 Approved, 32 Backordered` | **PASS** |
| 14 | **Cost per packet (WAC)** | **₹31.14**; margin ₹18.86 (**37.7 %**) | `₹31.14 cost, 37.7% margin` | **PASS** |
| 15 | **Overhead close-out after dispatch** | **₹842.55 (batch) / ₹957.45 (COGS)** | `₹842.55 / ₹957.45` | **PASS** |

---

## 5. Technology Stack & Architectural Rationale

| Layer | Technology | Architectural Rationale |
|---|---|---|
| **Domain Package** | `@snackflow/shared` (tsup, decimal.js) | Dual CJS/ESM package housing 100% of tax, money, variance, and UoM math to guarantee zero duplication between client and server. |
| **Backend API** | NestJS 10, Fastify/Express, TypeScript | Enterprise modularity, strict default-deny dependency injection, OpenAPI documentation, and RFC 7807 problem details. |
| **ORM & Database** | Prisma 6, PostgreSQL 16 Alpine | Native `NUMERIC` types, row-level concurrency locks (`SELECT ... FOR UPDATE`), and immutable append-only triggers. |
| **Database Cloud** | Neon Serverless Postgres | Pooled transaction runtime, least-privilege roles, and zero-copy copy-on-write ephemeral branching in GitHub Actions CI. |
| **Frontend PWA** | Next.js 15 (App Router), React 19, Tailwind CSS | Server and client boundaries, responsive viewports ($390 \times 844$ mobile to desktop), and Tamil localization. |
| **Offline Cache** | Dexie.js (IndexedDB) | Robust client-side catalog storage and background queued order synchronization with exponential backoff. |
| **Job Queue** | BullMQ 5, Redis 7 | Asynchronous background processing for heavy statutory PDF/Excel exports and scheduled stock audits. |

---

## 6. Monorepo Scripts & Verification Commands

```bash
# Run all linters, typechecks, and unit/integration tests across all packages
pnpm verify

# Run Section 14 benchmark test suite
pnpm benchmark

# Safe local database reset (refuses to touch non-local hosts)
pnpm db:reset:local

# Reset Neon evaluator demo branch to baseline
pnpm demo:reset
```

---

## 7. Assumptions & Known Gaps

### Documented Assumptions (§15):
1. Opening finished goods (50 packets) are valued at standard material cost at opening rates: ₹3,970 ÷ 200 = **₹19.85/packet**, assigned batch `OPENING`, with earlier expiry so FEFO ships it first.
2. Retailer A and Distributor B are registered taxpayers with dummy GSTINs that pass mod-36 checksum validation.
3. Shelf life for Murukku 200g is configured to 90 days.
4. Normal pouch damage and frying yield losses are absorbed directly into batch manufacturing cost per Ind AS 2.
5. Overheads in the benchmark are absorbed directly into the run; unattributed monthly overheads allocate using the kg-output rule.

### Known Gaps (§16):
- **Full-line credit notes:** Partial line returns are currently handled via full-line credit notes and re-invoicing.
- **Mock IRP Gateway:** e-Invoice IRN (SHA-256) and signed QR codes conform to NIC payload specifications, but mock the live government NIC sandbox credentials.
- **Single Currency:** Transactions are strictly denominated in Indian Rupees (INR).
