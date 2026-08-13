# Leads · Clients · Finance — benchmark vs. industry leaders, and the plan

**Written:** 2026-08-08 · grounded in how Salesforce, HubSpot, Pipedrive (CRM) and modern
AR/collections dashboards work, compared against what Direct's three pages do today.

This is a plan for Abdulrahman to react to — **nothing here is built yet.** It ends with one
recommended first step, because "enhance and link the three" is a product direction where your
priorities should lead.

---

## The one big idea: turn three separate pages into one "Customer 360"

Every leading tool treats a customer as **a single record that carries its whole story** — how
they came in (lead → funnel → source), what they've bought (lifetime billed, paid, outstanding),
how healthy they are (recent activity, overdue money, upcoming review), and what to do next.

Direct today has the *pieces* but they live on **three disconnected pages**:
- **Leads** knows how a company entered and its pipeline stage.
- **Clients** knows the won accounts and their managers.
- **Finance** knows the money (invoices, revenue, aging) — but by `client_group` name, not linked
  to the client record.

The single highest-value move is to **link them**: a client's page should show their money, and
Finance should link back to the client. The good news — the plumbing largely **already exists** in
the code (`arAgingFor(clientId)`, invoices keyed by client, won→client auto-conversion). This is
connecting what's there, not building from zero.

---

## Page-by-page: what leaders do vs. where Direct is

### Leads
| Leaders (Salesforce/HubSpot/Pipedrive) | Direct today | Gap → enhancement |
|---|---|---|
| **Lead score / priority** so reps work the hottest first | All leads shown flat, equal weight | Add a simple score (funnel + stage age + source + has-invoice-history) and a **"work these first"** view |
| **Next best action** per lead | `Next action` is free-text, often empty | Suggest a next action from stage + days-since-contact |
| **Owner + "my leads"** | Real owner, per-rep pipeline | `assigned_to` is free text — **0 of ~1,015 leads have a real owner** (backlog #7). Blocks "my leads" |
| **Conversion analytics** (rate, time-to-convert, pipeline value) | Stage chips only | Add a small conversion strip: this-month new, conversion %, avg days to win |
| **Aging leads flagged** | "Needs attention" banner ✓ (good) | Keep; extend to "no touch in 14+ days" surfacing |

### Clients
| Leaders | Direct today | Gap → enhancement |
|---|---|---|
| **Health score** (trend arrow + main risk + last engagement + recommended action) | Static fields (tier, area, won SAR) | Add a **client health** signal from: days since activity, outstanding/overdue money, review overdue, spend trend |
| **Lifetime value** pulled from finance | `Won (SAR)` only | Show **lifetime billed / paid / outstanding** on the client (from Finance data) |
| **Activity timeline** on the record | Activities exist but not surfaced richly | Put a compact timeline on the client detail |
| **Renewals / reviews surfaced** | `Next review` column + "reviews overdue" chip ✓ | Surface overdue reviews as an action list |

### Finance
| Leaders (AR/collections dashboards) | Direct today | Gap → enhancement |
|---|---|---|
| **DSO** and **% of AR overdue** headline the dashboard | Revenue/Cost/Profit/Received/Outstanding tiles | Add **DSO** and **% overdue** tiles — the two numbers collections leaders live by |
| **Aging trend** (this month's bucket mix vs last) | Aging buckets exist (on Invoices) | Show aging on Finance with a **"vs last month"** direction — a stable total hiding a growing 61–90 bucket is the classic early warning |
| **Top clients link to the record** | "Top clients by revenue" is a flat table | **Link each row to the client** + show their outstanding/aging |
| **Collections/dunning overlaid on aging** | Dunning column on Invoices | Surface overdue + dunning stage on Finance as an action list |

---

## Recommended sequence (highest value, lowest risk first)

1. **Link Clients ↔ Finance (the Customer 360 core).** On a client's detail: a finance snapshot —
   lifetime billed, paid, **outstanding**, and their **AR aging** mini-widget (function already
   exists). On Finance: make "Top clients" rows **open the client**. *This is the "link them
   together" you asked for, and it reuses existing data.*
2. **Add the two finance numbers leaders headline: DSO and % overdue**, plus an "aging vs last
   month" arrow. Small, high-signal.
3. **Client health signal** — a simple, explainable score (recency + overdue + review-due) with a
   colour and the main reason. Not a black box.
4. **Lead prioritisation** — a lightweight lead score + a "work these first" view. (Depends partly
   on fixing owners — backlog #7 — for "my leads".)
5. **Conversion strip on Leads** — this-month new, conversion %, avg days-to-win.

Each ships the same careful way as the Arabic/Settings work: build on the branch, verify in the
harness, screenshot for your approval, then live.

---

## Progress — what has shipped

- **Step 1 — Clients ↔ Finance (Customer 360 core):** ✅ shipped. Client detail now shows a finance
  snapshot (lifetime billed / paid / outstanding + AR aging), keyed to the client by exact name.
- **Step 2 — DSO + % overdue + aging:** ✅ shipped. Finance overview now leads with the two
  collections numbers plus an aging read.
- **Step 3 — Client health signal:** ✅ shipped. A calm, explainable badge (Good / Watch / At risk /
  New) on every client, from real activity + review governance. Red is reserved for a genuine
  problem (overdue account review, or contact that has actually happened and gone stale 90+ days);
  a client with no history logged yet reads **New**, not a false "At risk". Sortable, and the
  Clients **"At risk"** chip now filters to exactly those clients.
- **Step 4 — Lead prioritisation:** ✅ shipped. A **Priority** column on Leads surfaces the existing
  lead score as Hot / Warm / Cool / Cold; click the header to sort and work the hottest first.
- **Step 5 — Conversion strip on Leads:** ✅ shipped. New-this-month, in-pipeline, conversion %,
  and average time-to-win across the top of the Leads list.
- **Step 6 — Finance income-by-service (the service-fee model):** ✅ shipped. The Finance overview
  carries an "income by service line" card that splits every service into **gross billed** (cost +
  service fee), **cost** (the pass-through expense), **service-fee income** (Direct's taxable income),
  and margin — with a drill into the ledger for the proof (invoice # / DPIN). **Values were not
  changed** — the team's numbers are shown as-is, restructured for review. (Cost-0 rows are flagged.)
- **Step 7 — Leads service-fit map:** ✅ shipped. On each lead, an all-in-one capture of which Direct
  services the company already buys, could win, buys elsewhere, or doesn't need — the "one partner for
  everything" angle, per Direct service (flights, hotels, visa, transfers, MICE, and the growth lines).
- **Step 8 — Won → Client link (the link key):** ✅ shipped. A client detail shows a **Direct client ID**
  banner: linked (with a deep link into Direct Payments) or an amber "not linked yet" prompt. The ID is
  captured at handover (the convert modal) or in one tap on the banner. This is the key that ties our
  reflection to Direct's source of truth.
- **Step 9 — Suggested next step per stage (v35):** ✅ shipped. Each active lead shows a calm one-line
  nudge for its stage (New → assign an owner; Contacted → discovery call; Qualified → send the proposal;
  Won → complete the Direct handover). A prompt from the travel lifecycle, not a task — EN + AR.
- **Step 10 — Client profile "managed in Direct" (v36, the reflection boundary):** ✅ shipped. The client
  master (registration, documents, pricing scheme, credit line) is owned by Direct Payments, so the
  duplicate local onboarding form is now **collapsed behind a note** with a "Manage profile in Direct ↗"
  deep link. **Reversible, nothing deleted:** the local form still exists and stays reachable via a quiet
  "local form" fallback and the "Edit client profile (full form)" button. This closes the duplication trap
  named in `DIRECT_SYSTEMS_MAP.md`.

## Declutter done alongside (2026-08-08)

Removed dead weight from Leads / Clients / Finance so the signal stands out:
- Removed the **"Open in Direct"** column from both Leads and Clients (a link column nobody worked from).
- Scoped the **"Has app"** filter to Leads only (it belongs to the Service-Integration-Partners funnel).
- Removed the **"Active"** client chip — it matched nothing and duplicated "All clients".
- Fixed the **"At risk"** client chip so it actually filters (was matching zero rows).
- Fixed the **Export** dropdown so its items return to English when you switch the app back from Arabic.
Meaningful controls were kept: the category chips (Anchor / Convert / Re-engage) are real business
segmentation, not clutter, so they stayed.

---

## What I need from you to start

"Enhance and link" is yours to steer. My recommendation is to **start with step 1 (link Clients ↔
Finance)** — it's the literal "link the three together," it's the biggest single win, and the data
is already there. But if a different one matters more to how your team actually works, say so and
I'll start there.

**Sources:** industry practice drawn from
[Salesforce lead-gen guide](https://www.salesforce.com/marketing/lead-generation-guide/best-lead-generation-tools/),
[lead scoring best practices](https://prometheusagency.co/insights/lead-scoring-best-practices),
[360 customer view](https://crmsearch.com/strategy/360-customer-view/),
[customer health score guide](https://www.accoil.com/blog/customer-health-score),
[AR aging dashboard best practices](https://www.vertaccount.com/blog/best-accounts-receivable-dashboard-examples-templates-for-2026/),
and [B2B collections / DSO](https://www.resolutai.com/blog/b-2-b-collections-best-practices).
