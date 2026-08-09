# Direct's systems — the full map (and where our app fits)

Written 2026-08-09 from the real exported screens/data Abdulrahman shared (Google Drive:
"Main Direct", "Direct Corporate – B2B Admin Panel", "Executive CRM Dashboard"). This is the
picture any new session needs before touching Leads / Clients / Finance. Keep it accurate; it
is the reference for what we **own** vs **reflect**.

Direct already runs three production systems, built by a full team over years. **Our app
(Direct Business) is a fourth, thinner layer** that owns the one thing they don't have — the
**leads lifecycle** — and adds the **reporting/workflow layer**, reflecting the rest read-only.

---

## The one rule the whole thing hangs on

**Before `Won`, a company is fully ours (a lead). After `Won`, the facts live in Direct's
systems; our app keeps the relationship + reporting and only *reflects* their numbers — never
re-typing them.** Link key = the **Direct client ID** (a plain number, e.g. 95, 93, 92).

---

## 1 · Direct Payments — "Direct Desk" (the hub)  ← the source of truth for money & clients

The operational finance engine. Everything about a real client and their money lives here.

- **Corporate clients** — ID · Legal Name (EN + AR) · Trading Name · Customer Type
  (Government / Listed / Small Co / …) · **Payment Configuration** (Pre-Paid wallet /
  Post-Paid credit / Tender, with billing cycle, credit term, tender amount, **expected COGS**
  & **expected GP**) · VAT/CR registration · contacts · Agreement Status. (~42 clients.)
- **The B2B money model** (this is the important part):
  **Service → Transaction → Tax Invoice.**
  - A **service** is one cost line — a ticket, a hotel night, a visa, an activity. It splits
    into **cost** (pass-through expense, paid to a supplier) and **service fee** (Direct's
    income, the taxable part). Every cost line carries its **proof** — ticket/booking ref,
    merchant (`iata_bsp`, `akbar_travel`, `rate_hawk`, `travelfusion`), card, approver.
  - Cost lines are approved by finance: **Pending → Under Review → Approved / Rejected**.
  - A **transaction** (own number) holds one or many services.
  - A **tax invoice** (own number + ZATCA DPIN/TTIN) holds one or many transactions — issued
    only after expenses are approved. It carries client, amount, issue/due date, status
    (*Issued – waiting for settlement* / *Overdue* / settled).
  - **Gross billed = cost + service fee. Direct's real revenue is the service fees, not the
    gross volume.** (~8.7M SAR volume, thin service-fee margin on travel; higher on pure
    services.)
- **Service/expense lines:** Flights, Hotels, Visa, Packages, Course, Support, Activities,
  Insurance, Embassy/Gov fees, Provider price.
- **Also here:** Pricing Settings (service fees per client per item), Settlements, COGS
  report, Credit Notes, Proformas, Payment Receipts, Refund Requests, GMV/receivable stats.
- **Design:** Vue (Vuexy admin template). Orange `#fc8004`, dark navy `#283046`, muted
  `#6e6b7b`; semantics green `#28c76f` / red `#ea5455` / amber. Dense classic admin.

## 2 · Direct Corporate – B2B Admin Panel (the corporate self-service portal)

The **new** system: a corporate travel-management portal. Client companies that want a real
booking system get access; **their own HR / purchasing staff raise travel requests**, which go
through policy compliance and approval, then become transactions/invoices in the hub.

- **Nav:** Company comparison · Team Management · Companies · Transactions · Invoicing ·
  Pending Action · Compliance Requests · HR Requests.
- **Companies:** Company Details · Admin & Commercial SPOC · **Onboarding status** ·
  Team & Stats · Financial Summary · Actions.
- **Team Management:** Avatar · Name · Email · Phone · **Roles** · Status (per-company users,
  role-based — Admin, HR, etc.). Good reference for how they model corporate users & roles.
- **Dashboard:** agent performance — Submitted HR Requests · Checked Policies · Approved ·
  Rejected · Avg Response Time. (Workflow = request → policy check → approve/reject.)
- **Design:** React + Tailwind. Orange `#e66000`, Tailwind slate/stone neutrals
  (`#64748b`, `#475569`, `#1e293b`, `#f1f5f9`, `#78716c`), clean/airy modern SaaS,
  `react-toastify` for toasts.

## 3 · Executive CRM Dashboard (leadership / strategy)

The **exec** view — where directors track contracts, tenders and projects, and the strategy
team pulls reports. Bilingual ("لوحة التحكم التنفيذية").

- **Pages:** Finance 26 – Project Management · B2B Updates Management 2026 · Tenders Updates
  Management 2026.
- **Finance / Project table:** Contract · Type · Status · Receivable · Total Contract ·
  Cost · **Markup** (= the service fee / margin) · Received · Remaining · Collection Date ·
  **Attachments** (proof) · Actions. "You may submit a report for review" → report-approval flow.
- **Design:** modern/executive. Blue `#0081f2` (`#1a93fe`, `#1487fa`), warm-grey `#34322D` /
  `#f8f8f7`, `SF Pro` / system fonts, `ui-monospace` for figures, red `#ee3a3a` alerts.

## 4 · Direct Business (our app) — the leads + reporting layer

- **Owns:** the leads CRM and the full lead lifecycle, built for travel (service-fit across
  Flights / Hotels / Visa / licence / insurance / transport / car rental / MICE), and the
  reporting/workflow the team and board read.
- **Reflects (read-only, by Direct client ID):** the client master and the money (invoices,
  service-fee income, cost, margin) from the hub. Never re-types client/finance facts.
- **Brand orange `#F47A1F`** — same Direct-orange family as the hub (`#fc8004`) and the
  corporate panel (`#e66000`). We're visually consistent with the family; keep our orange.

---

## How a company flows across all four

```
Lead (our app)
  → Won  →  becomes a Corporate Client in Direct Payments (hub)      [client ID assigned]
            └─ optionally given access to the B2B Admin Panel        [their HR/purchasing self-serve]
  → their travel  →  Services → Transaction → Tax Invoice (hub)      [finance approves expenses]
  → tracked at contract/tender level in the Executive CRM            [markup, receivable, collection]
  → our app reflects the money read-only for the account team + reporting
```

## What our app must NOT duplicate (it all lives in Direct's systems)

Client master · invoices/tax · expenses & approval · per-item pricing · transactions ·
corporate-user (HR/purchasing) management · the request→policy→approval booking workflow.
Re-typing any of it is the "duplication trap" that caused drift before.

## Design cues worth reusing (so our app feels part of the family)

- **Orange stays** — it's the shared Direct accent across systems.
- **System fonts only** (SF Pro / -apple-system / Segoe) — none of the three ships an exotic
  webfont; our app should too (keeps it fast, and consistent).
- **Proof on every number** (Attachments / ID reference / DPIN) is a house rule across all
  three — we already adopted it in the Finance "income by service" view.
- **Roles + Status** as first-class columns on people; **Onboarding status** on companies —
  patterns we can mirror when we build the client-reflection page.
