# Graph Report - SnackFlow  (2026-11-20)

## Corpus Check
- 126 files · ~55,605 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .example 1, .migrate 1)

## Summary
- 1287 nodes · 2521 edges · 93 communities (75 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a5227406`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Role
- app.module.ts
- scripts
- ReportsService
- Public
- Permission
- @nestjs/common
- api/package.json
- dependencies
- billing.controller.ts
- web/package.json
- CatalogService
- dto/index.ts
- shared/package.json
- PrismaService
- api.ts
- enums/index.ts
- BillingController
- Order-to-Audit System — Architecture & Build Spec
- Order-to-Audit System — Architecture & Build Spec
- PrismaReadService
- scripts
- OrderStatus
- @prisma/client
- devDependencies
- reports.service.ts
- toDecimal
- shared.spec.ts
- compilerOptions
- RequirePermission
- lucide-react
- compilerOptions
- SnackFlow — Code Tour & Live Defense Guide
- SnackFlow — Order-to-Audit ERP System
- .create
- tasks
- Antigravity Prompt — Order-to-Audit System
- .createPayment
- statemachines/index.ts
- environment
- CurrentUser
- parties.controller.ts
- compilerOptions
- SnackFlow — Technical Design Note
- payments.controller.ts
- services
- Detailed Narration Script
- uom/index.ts
- 5. Core engines (all pure functions in `packages/shared`, called by API services)
- .create
- sales/page.tsx
- postgres
- MovementType
- gst/index.ts
- STEPS
- manifest.json
- worker
- depends_on
- env
- with
- Antigravity Prompt — Neon (Serverless Postgres) Implementation
- @nestjs/swagger
- AuthenticatedUser
- web/tsconfig.json
- ADR 001: Neon Serverless Postgres for Hosted Demo and CI Branching
- postgres
- verify-local
- scripts/db.ts
- verify-neon
- steps
- nest-cli.json
- ProductionService
- scripts
- healthcheck
- redis
- 5. Core engines (all pure functions in `packages/shared`, called by API services)
- shared/tsconfig.json
- env.ts
- web
- on
- RunStatus
- demo-reset.ts
- api
- migrate-seed
- next.config.mjs
- zod@^3.24.1
- BLOCKERS.md
- CHANGE_REQUESTS.md
- PROGRESS.md
- pnpm-workspace.yaml

## God Nodes (most connected - your core abstractions)
1. `RequirePermission()` - 61 edges
2. `@nestjs/common` - 57 edges
3. `toDecimal()` - 57 edges
4. `AuthenticatedUser` - 46 edges
5. `CurrentUser` - 43 edges
6. `PrismaService` - 43 edges
7. `Permission` - 35 edges
8. `roundMoney()` - 25 edges
9. `Role` - 22 edges
10. `ReportsService` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Key Architectural Choices:` --references--> `PrismaReadService`  [INFERRED]
  docs/adr/001-neon-postgres.md → apps/api/src/prisma/prisma-read.service.ts
- `Defence in Depth:` --references--> `RbacGuard`  [INFERRED]
  docs/CODE_TOUR.md → apps/api/src/core/guards/rbac.guard.ts
- `5.2 Ledger posting (`InventoryService.postMovements(tx, movements[])`)` --references--> `InsufficientStockError`  [INFERRED]
  ARCHITECTURE.md → apps/api/src/modules/inventory/inventory.service.ts
- `5.2 Ledger posting (`InventoryService.postMovements(tx, movements[])`)` --references--> `InsufficientStockError`  [INFERRED]
  docs/ARCHITECTURE.md → apps/api/src/modules/inventory/inventory.service.ts
- `17.1 Single System of Record & Connection Topology` --references--> `PrismaReadService`  [INFERRED]
  ARCHITECTURE.md → apps/api/src/prisma/prisma-read.service.ts

## Import Cycles
- None detected.

## Communities (93 total, 18 thin omitted)

### Community 0 - "Role"
Cohesion: 0.10
Nodes (21): AppModule, AuthGuard, RbacGuard, BenchmarkRow, createTestContext(), resetSalesAndStock(), TestContext, RFC-7807 (+13 more)

### Community 1 - "app.module.ts"
Cohesion: 0.07
Nodes (13): ProblemDetails, Rfc7807ExceptionFilter, IdempotencyInterceptor, ZodValidationPipe, AuthModule, BillingModule, CatalogModule, ProductionModule (+5 more)

### Community 2 - "scripts"
Cohesion: 0.06
Nodes (39): description, devDependencies, eslint@^10.15.0, prettier@^3.4.2, turbo@^2.3.3, typescript@^5.7.2, @typescript-eslint/eslint-plugin@^8.73.0, @typescript-eslint/parser@^8.73.0 (+31 more)

### Community 3 - "ReportsService"
Cohesion: 0.11
Nodes (3): ExportService, ReportsController, ReportsService

### Community 4 - "Public"
Cohesion: 0.09
Nodes (6): HealthController, Public(), AuthController, AuthService, TestController, LoginDto

### Community 5 - "Permission"
Cohesion: 0.06
Nodes (25): AlertsController, AlertsModule, AlertsService, SystemAlert, Permission, AUDIT_READ, BOM_MANAGE, DASHBOARD_READ (+17 more)

### Community 6 - "@nestjs/common"
Cohesion: 0.16
Nodes (9): IS_PUBLIC_KEY, PERMISSIONS_KEY, InventoryModule, InventoryService, StockMovementInput, PurchasingService, CreatePurchaseDto, @nestjs/common (+1 more)

### Community 7 - "api/package.json"
Cohesion: 0.09
Nodes (32): devDependencies, dotenv@^16.4.7, @nestjs/cli@^10.4.9, @nestjs/schematics@^10.2.3, @nestjs/testing@^10.4.15, prisma@^6.1.0, supertest@^7.0.0, tsx@^4.19.2 (+24 more)

### Community 8 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, bullmq@^5.34.4, cookie-parser@^1.4.7, exceljs@^4.4.0, helmet@^8.0.0, ioredis@^5.4.2, @nestjs/common@^10.4.15, @nestjs/config@^3.3.0 (+24 more)

### Community 9 - "billing.controller.ts"
Cohesion: 0.14
Nodes (10): BillingService, CreditNoteService, CreateCreditNoteDto, PostInvoiceDto, InvoiceStatus, CANCELLED, DRAFT, POSTED (+2 more)

### Community 10 - "web/package.json"
Cohesion: 0.10
Nodes (28): dependencies, clsx@^2.1.1, decimal.js@^10.4.3, dexie@^4.0.10, @hookform/resolvers@^3.9.1, react-dom@^19.0.0, react-hook-form@^7.54.0, recharts@^2.14.1 (+20 more)

### Community 11 - "CatalogService"
Cohesion: 0.11
Nodes (7): CatalogController, CatalogService, ItemKind, FINISHED, PACKAGING, RAW, WIP

### Community 12 - "dto/index.ts"
Cohesion: 0.10
Nodes (20): DispatchService, ApproveOrderDto, ApproveOrderSchema, CreateCreditNoteSchema, CreateOrderDto, CreateOrderSchema, CreateOverheadDto, CreateOverheadSchema (+12 more)

### Community 13 - "shared/package.json"
Cohesion: 0.10
Nodes (24): dependencies, decimal.js@^10.4.3, zod@^3.24.1, devDependencies, tsup@^8.3.5, typescript@^5.7.2, vitest@^2.1.8, decimal.js (+16 more)

### Community 14 - "PrismaService"
Cohesion: 0.08
Nodes (3): AuditInterceptor, ApprovalService, PrismaService

### Community 15 - "api.ts"
Cohesion: 0.21
Nodes (15): next@^15.1.0, metadata, RootLayout(), LoginFormContent(), LoginPage(), HomePage(), Header(), getStoredSession() (+7 more)

### Community 16 - "enums/index.ts"
Cohesion: 0.10
Nodes (20): CostMethod, BATCH_ACTUAL, WAC, OverheadType, GAS_POWER, LABOUR, OTHER, PartyKind (+12 more)

### Community 18 - "Order-to-Audit System — Architecture & Build Spec"
Cohesion: 0.11
Nodes (18): 0. Non-negotiables (from the brief, turned into rules), 10. Reports (all filterable by date range; Excel, CSV, PDF), 11. Integrations that make it stand out (build in this priority order, only after must-haves pass), 12. Scalability path, 13. Testing strategy, 14. Benchmark — expected results and how the system gets them, 15. Documented assumptions, 16. Known gaps (to state honestly in README) (+10 more)

### Community 19 - "Order-to-Audit System — Architecture & Build Spec"
Cohesion: 0.11
Nodes (18): 0. Non-negotiables (from the brief, turned into rules), 10. Reports (all filterable by date range; Excel, CSV, PDF), 11. Integrations that make it stand out (build in this priority order, only after must-haves pass), 12. Scalability path, 13. Testing strategy, 14. Benchmark — expected results and how the system gets them, 15. Documented assumptions, 16. Known gaps (to state honestly in README) (+10 more)

### Community 20 - "PrismaReadService"
Cohesion: 0.12
Nodes (8): 3. Prisma clients, PrismaReadService, 17.1 Single System of Record & Connection Topology, 17.2 Least-Privilege Role Matrix (Defence in Depth), 17.3 Branching Strategy for Demo & CI, 17.4 Resilience & Scale-to-Zero Handling, 17.5 Architectural Justification: Why Not MongoDB?, 17. Database hosting (Neon Serverless Postgres)

### Community 21 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, benchmark, build, db:migrate, db:reset:local, db:seed, dev, lint (+10 more)

### Community 22 - "OrderStatus"
Cohesion: 0.11
Nodes (11): OrdersService, OrderStatus, APPROVED, CANCELLED, CLOSED, DISPATCHED, INVOICED, ON_HOLD (+3 more)

### Community 23 - "@prisma/client"
Cohesion: 0.14
Nodes (8): @prisma/client@^6.1.0, prisma, main(), prisma, calculateGstinChecksum(), generateValidGstin(), validateGstin(), @prisma/client

### Community 24 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.49, tailwindcss@^3.4.16, @types/node@^22.10.2, @types/react@^19.0.1, @types/react-dom@^19.0.1, typescript@^5.7.2 (+8 more)

### Community 25 - "reports.service.ts"
Cohesion: 0.16
Nodes (4): ReportsModule, ZERO_MONEY, ZERO_QTY, PrismaModule

### Community 26 - "toDecimal"
Cohesion: 0.32
Nodes (8): Key Modules:, computeLineGst(), calculateRemainderSplit(), calculateWac(), formatINR(), roundMoney(), roundUnitCost(), toDecimal()

### Community 27 - "shared.spec.ts"
Cohesion: 0.20
Nodes (7): calculateInvoiceGst(), determineSupplyType(), calculateIngredientVariance(), calculatePackagingVariance(), calculateYieldVariance(), DEFAULT_TOLERANCE_PCT, VarianceResult

### Community 28 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib (+8 more)

### Community 30 - "lucide-react"
Cohesion: 0.20
Nodes (10): lucide-react@^0.468.0, react@^19.0.0, AdminOrdersPage(), AuditorReportsPage(), ProductionWizardPage(), SalesmanPage(), apiFetch(), downloadReport() (+2 more)

### Community 31 - "compilerOptions"
Cohesion: 0.13
Nodes (15): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+7 more)

### Community 32 - "SnackFlow — Code Tour & Live Defense Guide"
Cohesion: 0.13
Nodes (14): 1. Monorepo Architecture & Directory Map, 2. Shared Domain Package (`@snackflow/shared`), 3. The Append-Only Inventory Ledger Engine (`apps/api`), 4-Phase Run State Machine:, 4. Production Lifecycle & Costing Mechanics, 5. Security & Authentication Architecture, 6. Front-End Architecture (`apps/web`), 7. How to Defend This in an Interview (Quick FAQs) (+6 more)

### Community 33 - "SnackFlow — Order-to-Audit ERP System"
Cohesion: 0.13
Nodes (14): 1. Executive Summary & Core Architectural Invariants, 2. Quickstart & Deployment Options, 3. Test Credentials & 5 Persona Profiles, 4. Section 14 Authoritative Benchmark Reproduction, 5. Technology Stack & Architectural Rationale, 6. Monorepo Scripts & Verification Commands, 7. Assumptions & Known Gaps, Benchmark Results (15 / 15 Passed): (+6 more)

### Community 35 - "tasks"
Cohesion: 0.14
Nodes (13): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+5 more)

### Community 36 - "Antigravity Prompt — Order-to-Audit System"
Cohesion: 0.15
Nodes (12): AGENT TOPOLOGY AND OWNERSHIP, ANTI-LOOP RULES, ANTI-REDUNDANCY RULES, Antigravity Prompt — Order-to-Audit System, DEFINITION OF DONE (whole project), ENGINEERING STANDARDS, FIRST OUTPUT (then wait for my approval), PHASES AND GATES (+4 more)

### Community 38 - "statemachines/index.ts"
Cohesion: 0.23
Nodes (10): canTransitionInvoice(), canTransitionOrder(), canTransitionRun(), InvalidStateTransitionError, INVOICE_TRANSITIONS, ORDER_TRANSITIONS, RUN_TRANSITIONS, validateInvoiceTransition() (+2 more)

### Community 39 - "environment"
Cohesion: 0.22
Nodes (13): environment, DATABASE_URL, HMAC_SHARE_SECRET, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, NEXT_PUBLIC_API_URL, NODE_ENV, PORT (+5 more)

### Community 41 - "parties.controller.ts"
Cohesion: 0.24
Nodes (4): PartiesModule, PartiesService, CreatePartyDto, CreatePartySchema

### Community 42 - "compilerOptions"
Cohesion: 0.17
Nodes (12): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution (+4 more)

### Community 43 - "SnackFlow — Technical Design Note"
Cohesion: 0.17
Nodes (11): 1. Domain Architecture & Entity Relationship Overview, 2.1 Append-Only Ledger Invariant, 2.2 Moving Weighted Average Cost (WAC) Formulation, 2.3 Concurrency Control & Double-Spending Prevention, 2. Inventory Ledger Mathematics & Immutability, 3.1 Standard BOM vs. Actual Consumption, 3. Production BOM & Variance Mechanics, 4.1 Batch Cost Aggregation (+3 more)

### Community 44 - "payments.controller.ts"
Cohesion: 0.27
Nodes (3): PaymentsModule, PaymentsService, CreatePaymentDto

### Community 45 - "services"
Cohesion: 0.18
Nodes (10): container_name, image, ports, restart, services, mailpit, version, volumes (+2 more)

### Community 46 - "Detailed Narration Script"
Cohesion: 0.18
Nodes (10): [00:00 – 01:00] Scene 0: Architectural Foundation, [01:00 – 02:15] Act 1: Salesman Mobile PWA (`/sales`), [02:15 – 03:45] Act 2: Admin Order Inbox & Billing (`/admin/orders`), [03:45 – 05:15] Act 3: Production Floor Tablet Wizard (`/production`), [05:15 – 06:30] Act 4: Statutory Auditor Hub (`/audit`), [06:30 – 07:30] Act 5: Executive Owner Dashboard (`/owner`), [07:30 – 08:00] Wrap-up & Automated Verification, Detailed Narration Script (+2 more)

### Community 47 - "uom/index.ts"
Cohesion: 0.24
Nodes (9): UomDimension, COUNT, MASS, VOLUME, roundQty(), convertUom(), STANDARD_UOMS, UomConversionError (+1 more)

### Community 48 - "5. Core engines (all pure functions in `packages/shared`, called by API services)"
Cohesion: 0.20
Nodes (9): InsufficientStockError, 5.1 Units, 5.2 Ledger posting (`InventoryService.postMovements(tx, movements[])`), 5.3 BOM, production run and variance, 5.4 Costing, 5.5 GST, 5.6 State machines (in `packages/shared`, enforced by API — illegal transitions return 409), 5. Core engines (all pure functions in `packages/shared`, called by API services) (+1 more)

### Community 50 - "sales/page.tsx"
Cohesion: 0.24
Nodes (7): dexie-react-hooks@^1.1.7, Item, Party, db, QueuedOrder, SnackFlowDb, dexie-react-hooks

### Community 51 - "postgres"
Cohesion: 0.20
Nodes (10): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, container_name, environment, image, ports, restart (+2 more)

### Community 52 - "MovementType"
Cohesion: 0.20
Nodes (10): MovementType, ADJUST, COST_ADJ, DISPATCH, ISSUE, OPENING, PRODUCE, PURCHASE (+2 more)

### Community 53 - "gst/index.ts"
Cohesion: 0.27
Nodes (9): SupplyType, INTER, INTRA, COMPANY_STATE_CODE, GstInvoiceCalculation, GstLineInput, GstLineResult, LineGstInput (+1 more)

### Community 54 - "STEPS"
Cohesion: 0.22
Nodes (9): 1. Environment contract, 2. Database roles (least privilege, defence in depth), 4. Migrations and seed, 5. Time and money correctness on a cloud DB, 6. Resilience (bounded, no loops), 7. Neon branching in CI (the showcase), 8. Demo environment for evaluators, 9. Documentation (Lead owns docs) (+1 more)

### Community 55 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 56 - "worker"
Cohesion: 0.31
Nodes (9): build, context, dockerfile, build, worker, build, build, container_name (+1 more)

### Community 57 - "depends_on"
Cohesion: 0.28
Nodes (9): depends_on, migrate-seed, postgres, redis, condition, depends_on, condition, condition (+1 more)

### Community 58 - "env"
Cohesion: 0.39
Nodes (9): APP_TZ, DATABASE_URL, DIRECT_URL, HMAC_SHARE_SECRET, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, READONLY_DATABASE_URL, env (+1 more)

### Community 59 - "with"
Cohesion: 0.22
Nodes (9): with, api_key, branch, branch_name, cache, node-version, parent, project_id (+1 more)

### Community 60 - "Antigravity Prompt — Neon (Serverless Postgres) Implementation"
Cohesion: 0.25
Nodes (7): Antigravity Prompt — Neon (Serverless Postgres) Implementation, FIRST OUTPUT (then wait for approval), GOAL, ROLE, RULES (same as the main prompt), SOURCES OF TRUTH, VERIFICATION GATES

### Community 61 - "@nestjs/swagger"
Cohesion: 0.14
Nodes (8): decimal.js@^10.4.3, @nestjs/passport@^10.0.3, @nestjs/platform-express@^10.4.15, @nestjs/swagger@^8.1.0, decimal.js, @nestjs/passport, @nestjs/platform-express, @nestjs/swagger

### Community 63 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (5): extends, include, exclude, extends, include

### Community 64 - "ADR 001: Neon Serverless Postgres for Hosted Demo and CI Branching"
Cohesion: 0.25
Nodes (7): ADR 001: Neon Serverless Postgres for Hosted Demo and CI Branching, Consequences, Context & Problem Statement, Date, Decision, Key Architectural Choices:, Status

### Community 65 - "postgres"
Cohesion: 0.25
Nodes (8): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, env, image, options, ports, postgres

### Community 66 - "verify-local"
Cohesion: 0.25
Nodes (8): verify-local, image, options, ports, redis, name, runs-on, services

### Community 67 - "scripts/db.ts"
Cohesion: 0.29
Nodes (4): embedded-postgres@18.7.0-beta.19, dataDir, pg, embedded-postgres

### Community 68 - "verify-neon"
Cohesion: 0.29
Nodes (6): jobs, verify-neon, name, if, name, runs-on

### Community 69 - "steps"
Cohesion: 0.38
Nodes (7): id, if, name, run, uses, steps, steps

### Community 70 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 72 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, typecheck

### Community 73 - "healthcheck"
Cohesion: 0.53
Nodes (6): interval, retries, test, timeout, healthcheck, healthcheck

### Community 74 - "redis"
Cohesion: 0.33
Nodes (6): container_name, image, ports, restart, volumes, redis

### Community 75 - "5. Core engines (all pure functions in `packages/shared`, called by API services)"
Cohesion: 0.33
Nodes (6): 5.1 Units, 5.3 BOM, production run and variance, 5.4 Costing, 5.5 GST, 5.6 State machines (in `packages/shared`, enforced by API — illegal transitions return 409), 5. Core engines (all pure functions in `packages/shared`, called by API services)

### Community 76 - "shared/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 78 - "web"
Cohesion: 0.40
Nodes (5): web, container_name, depends_on, ports, restart

### Community 79 - "on"
Cohesion: 0.40
Nodes (5): on, pull_request, push, branches, branches

### Community 80 - "RunStatus"
Cohesion: 0.40
Nodes (5): RunStatus, CLOSED, DRAFT, POSTED, REVERSED

### Community 81 - "demo-reset.ts"
Cohesion: 0.50
Nodes (3): main(), NeonBranch, neonRequest()

### Community 83 - "api"
Cohesion: 0.50
Nodes (4): container_name, ports, restart, api

### Community 84 - "migrate-seed"
Cohesion: 0.50
Nodes (4): container_name, environment, restart, migrate-seed

## Knowledge Gaps
- **75 isolated node(s):** `RFC-7807`, `SALESMAN`, `ADMIN`, `PRODUCTION`, `AUDITOR` (+70 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 560 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `@nestjs/common` to `Role`, `app.module.ts`, `Permission`, `api/package.json`, `dependencies`, `billing.controller.ts`, `parties.controller.ts`, `payments.controller.ts`, `dto/index.ts`, `reports.service.ts`, `shared.spec.ts`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `RFC-7807`, `SALESMAN`, `ADMIN` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Role` be split into smaller, more focused modules?**
  _Cohesion score 0.1014799154334038 - nodes in this community are weakly interconnected._
- **Why does `PrismaService` connect `PrismaService` to `Role`, `app.module.ts`, `Public`, `@nestjs/common`, `billing.controller.ts`, `parties.controller.ts`, `CatalogService`, `payments.controller.ts`, `dto/index.ts`, `PrismaReadService`, `OrderStatus`, `reports.service.ts`, `shared.spec.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `app.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06707317073170732 - nodes in this community are weakly interconnected._
- **Why does `toDecimal()` connect `toDecimal` to `Role`, `ReportsService`, `Permission`, `@nestjs/common`, `ProductionService`, `billing.controller.ts`, `payments.controller.ts`, `uom/index.ts`, `BillingController`, `gst/index.ts`, `reports.service.ts`, `shared.spec.ts`, `lucide-react`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.05731707317073171 - nodes in this community are weakly interconnected._