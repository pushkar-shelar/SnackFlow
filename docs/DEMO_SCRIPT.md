# SnackFlow — Video Walkthrough & Demo Script

**Target Duration:** ≤ 8 minutes (Timed Narration Script)  
**Target Audience:** NIT Trichy CDI Internship Evaluation Panel  
**System:** SnackFlow (Packaged Food Manufacturing ERP)  
**Company Context:** Sri Murugan Snacks (Madurai, Tamil Nadu — GSTIN: `33AAAAA0000A1Z5`)  

---

## Timeline & Scene Overview

| Time Interval | Scene / Persona | Core Feature Demonstrated |
|---|---|---|
| **00:00 – 01:00** | Introduction & Architecture | Problem statement, 5 personas, append-only ledger invariant, zero floats |
| **01:00 – 02:15** | Act 1: Salesman Mobile PWA | $390 \times 844$ viewport, offline Dexie outbox, stepper entry, live GST |
| **02:15 – 03:45** | Act 2: Admin Order Inbox | Split-view desktop, coverage chips, FEFO dispatch, WhatsApp & UPI, backorders |
| **03:45 – 05:15** | Act 3: Production Floor Wizard | 4-step tablet wizard, touch targets $\ge 44\text{px}$, $\pm 3\%$ variance flags, overhead closeout |
| **05:15 – 06:30** | Act 4: Statutory Auditor Hub | Read-only hub, reconciled invariant proof, GSTR-1/3B, Excel/CSV exports |
| **06:30 – 07:30** | Act 5: Executive Owner Dashboard | 37.7% gross margin, Ind AS 2 WAC vs FIFO sensitivity, debtor ageing |
| **07:30 – 08:00** | Verification & Wrap-up | `pnpm benchmark` 15/15 checks, Docker Compose single command |

---

## Detailed Narration Script

### [00:00 – 01:00] Scene 0: Architectural Foundation
*(Screen displays SnackFlow landing page at `http://localhost:3000`)*

**Speaker:**
> "Hello everyone. Welcome to the technical demonstration of **SnackFlow**, an Order-to-Audit system engineered specifically for packaged South Indian snack manufacturers, modelled on Sri Murugan Snacks in Madurai.
> 
> Small-to-medium food enterprises in India struggle with disconnected tools: salesmen take orders on WhatsApp, plant supervisors scribble batch yields on paper, accountants re-key invoices into Tally, and statutory auditors spend days hunting inventory discrepancies.
> 
> SnackFlow solves this with three non-negotiable architectural invariants:
> 1. **Enter once, at source:** data captured by salesmen or plant operators automatically cascades across all downstream modules without manual re-entry.
> 2. **Ledger-first immutability:** stock balances are strict mathematical projections of an append-only `stock_ledger` protected by PostgreSQL database triggers.
> 3. **Zero floating-point arithmetic:** all monetary amounts, quantities, and moving weighted costs use exact `NUMERIC` precision end-to-end.
>
> Let's walk through our 5 personas."

---

### [01:00 – 02:15] Act 1: Salesman Mobile PWA (`/sales`)
*(Screen switches to Chrome DevTools simulating mobile viewport: $390 \times 844$, logged in as Ramu S, Salesman)*

**Speaker:**
> "We start on the field with Ramu, our salesman in Madurai. He opens SnackFlow on his mobile browser. The UI is built to WCAG 2.2 touch standards with high-contrast buttons and instant response.
> 
> Notice the top status bar: Ramu is currently in the wholesale market where cellular connectivity is patchy. SnackFlow uses **Dexie.js IndexedDB** for offline catalog caching.
> 
> Ramu selects **Retailer A (Madurai)** from his scoped customer list. He taps the Murukku 200g item. Instead of typing tricky keyboard numbers, he uses our touch stepper or toggles between loose packets and 20-packet master cartons. He selects **150 packets** (or 7 cartons plus 10 loose).
> 
> In the sticky bottom sheet, he gets an instant GST breakdown: ₹7,500 taxable plus 2.5% CGST and 2.5% SGST, totaling ₹7,875.00.
> 
> He taps **'Submit Order'**. The order is generated with a client-side UUIDv7, tagged with silent GPS coordinates, and written to his local Dexie outbox. The moment connectivity resumes, it synchronizes idempotently to the central server with zero duplicate risks."

---

### [02:15 – 03:45] Act 2: Admin Order Inbox & Billing (`/admin/orders`)
*(Screen switches to Admin desktop split-view, logged in as Kavitha N, Operations Admin)*

**Speaker:**
> "Back at headquarters, Kavitha, the Operations Admin, views her master-detail order inbox. 
> 
> She sees Retailer A's incoming order for 150 packets. Notice our real-time **Stock Coverage Chip**: it displays a green badge indicating sufficient on-hand inventory. Kavitha can use our keyboard shortcuts: `A` to approve, `R` to reject, or `H` to hold. She presses `A`.
> 
> With one click on **'Post Invoice & Dispatch'**, three atomic actions execute inside a single PostgreSQL database transaction:
> 1. The sequential document sequence is locked `FOR UPDATE`, assigning financial year invoice number `INV/2627/00001`.
> 2. Our **strict FEFO dispatch engine** allocates physical stock: 50 packets from the earlier expiring opening batch, and 100 packets from the latest production batch.
> 3. `InventoryService.postMovements()` records the outward dispatch in the append-only ledger and releases the soft reservation.
> 
> Kavitha clicks **'Share Invoice'**. The system generates an **HMAC-SHA256 signed public URL** and a pre-formatted **WhatsApp deep link** alongside an **NPCI-compliant UPI QR code** for instant payment collection.
> 
> Next, Kavitha inspects Distributor B's order from Bengaluru requesting 120 packets. The coverage badge flags **amber**: only 88 packets remain on hand. SnackFlow prevents overselling: it approves 88 packets now (generating ₹4,400 + ₹220 IGST = ₹4,620) and automatically creates a backorder for the remaining 32 packets, simultaneously signaling a shortfall alert to the factory floor."

---

### [03:45 – 05:15] Act 3: Production Floor Tablet Wizard (`/production`)
*(Screen switches to Production interface, logged in as Muthu K, Plant Supervisor)*

**Speaker:**
> "Now let's move to the production plant floor where Muthu, our supervisor, operates an industrial tablet with $\ge 44\text{px}$ touch targets.
> 
> Muthu starts a production run for Murukku 200g. 
> 
> **Step 1: Material Issue.** The standard Bill of Materials pre-fills standard consumption for a 1.0 batch factor: 40 kg Flour, 10 L Oil, 1.2 kg Spices, 188 Pouches, and 9 Cartons. Materials are automatically issued at our moving Weighted Average Cost (WAC), where flour has updated from ₹42.00 to ₹43.125 following our morning GRN.
> 
> **Step 2: Actual Output & Scrap.** At the end of the frying and packaging cycle, Muthu enters actual output: 188 finished packets and 6 damaged pouches.
> 
> **Step 3: Real-Time Variance Calculation.** SnackFlow instantly calculates recipe variances and flags any deviation exceeding $\pm 3\%$:
> - Yield variance is **-6.0%** (188 vs standard 200 packets) — **Flagged Alert**.
> - Oil consumption is **+5.0%** (10.5 L vs standard 10.0 L) — **Flagged Alert**.
> - Pouch consumption is **+3.19%** (194 used vs 188 good) — **Flagged Alert**.
> 
> **Step 4: Overhead Remainder Close-Out.** Muthu enters ₹1,800 in batch overheads. Because 100 packets were already dispatched to Retailer A earlier in the day, our Ind AS 2 remainder allocation method splits the cost with zero paise drift: **₹842.55** is capitalized into on-hand inventory (88 packets), and **₹957.45** is posted directly to COGS."

---

### [05:15 – 06:30] Act 4: Statutory Auditor Hub (`/audit`)
*(Screen switches to Auditor portal, logged in as Sankaran & Co, Statutory Auditor)*

**Speaker:**
> "Next, we switch to our Statutory Auditor role. By design, this account has zero mutating permissions.
> 
> In the **Stock Summary Report**, the auditor verifies that every SKU's closing balance exactly equals the sum of its append-only ledger rows with **zero discrepancy**:
> - Raw Flour closing: 120 kg @ ₹43.125 = ₹5,175.00
> - Oil closing: 19.5 L
> - Spice mix closing: 3.8 kg
> - Pouches closing: 306 units
> - Cartons closing: 21 units
> - Finished Murukku: 88 packets on hand
> 
> The auditor can drill down from any balance directly to physical transaction IDs in the immutable ledger.
> 
> In the **GST Compliance Tab**, SnackFlow formats outward sales into statutory GSTR-1 structures: Table 4 (B2B), Table 7 (B2CS), and Table 12 (HSN 19059040 summary), alongside GSTR-3B Table 3.1(a). With one click, the auditor exports formatted **Excel (.xlsx)** workbooks or streaming **CSV** files."

---

### [06:30 – 07:30] Act 5: Executive Owner Dashboard (`/owner`)
*(Screen switches to Owner dashboard, logged in as S. Murugesan, Managing Director)*

**Speaker:**
> "Finally, we view the system through the eyes of the business owner, Mr. Murugesan.
> 
> He sees real-time executive KPI cards:
> - Today's Sales: **₹7,875.00**
> - Gross Margin: **37.7%** (selling price ₹50.00 minus unit cost ₹31.14 = ₹18.86 profit per packet)
> - Plant Yield Alert: **-6.0%** flagged for supervisor follow-up
> - Collections: **₹4,000.00** received from Retailer A, reducing outstanding balance to ₹3,875.00
> 
> The dashboard also features an **Ind AS 2 Inventory Valuation Sensitivity Matrix**, demonstrating the exact financial difference between Moving WAC (₹31.14/packet) and FIFO (₹30.90/packet), alongside debtor ageing buckets (0-30, 31-60, 61-90, 90+ days)."

---

### [07:30 – 08:00] Wrap-up & Automated Verification
*(Screen shows terminal executing `pnpm benchmark`)*

**Speaker:**
> "To prove that our entire system complies 100% with every business rule and mathematical formula, we run our automated benchmark suite: `pnpm benchmark`.
> 
> In less than 3 seconds, the test replays the complete operational scenario against PostgreSQL and validates all 15 benchmark figures from Section 14 with 100% exact numerical match.
> 
> SnackFlow boots completely offline with `docker compose up --build`, or connects to hosted serverless PostgreSQL via Neon.
> 
> Thank you for your time and consideration."
