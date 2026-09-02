# Direct Master Brief — Full Reference (v2)

A single comprehensive reference on Abdulrahman Aboelmagd, Direct Travel KSA, the B2B initiative, the app, the master database, the payment cycle, the workflow, the tool stack, the standing rules, and everything that has been decided, built, tried, or shelved across the past two months of Cowork, Dispatch, and Claude Code sessions. Written 8 August 2026 as a stable starting point for both Abdulrahman himself and any fresh Claude session (Dispatch, Cowork, or Claude Code) that picks up work on this project.

This brief is deliberately long. It replaces the earlier one-page summary. Every section below is self-contained, so if a section is skipped the rest still reads.

---

## Table of contents

1. Executive summary
2. Who Abdulrahman is
3. What Direct Travel KSA is
4. Why the B2B initiative exists — the three-phase vision
5. How the Direct ecosystem fits together
6. Direct Payment — what it does, where the boundary is
7. The Direct Business B2B app — what it is, what it isn't
8. The corporate website and website-onboarded leads
9. The leads funnel
10. The full sales and operations workflow — end-to-end
11. Reissue, refund, void, ancillary — by service type
12. The chain-of-command discipline
13. Roles and permissions
14. The reports the app produces (or should produce)
15. The master database of Saudi B2B entities
16. Skills, tools and workflows used across sessions
17. Insights learned — what worked, what failed, patterns
18. Decisions Abdulrahman locked and the reason behind each
19. The tech stack — one paragraph per component with role and status
20. Standing rules of engagement
21. Ideas and unfinished threads
22. Where things live
23. Timeline highlights
24. Open questions
25. Source files consolidated into this brief

---

# 1. Executive summary

Abdulrahman Aboelmagd leads commercial and business-development work at Direct Travel KSA, a full-stack Saudi B2B travel management company that has been operating for more than ten years out of Riyadh. Direct is unusual for a Saudi player because it does the whole travel stack in one place — flights, hotels, visas, insurance, transport, umrah, hajj, corporate travel, MICE, cargo — rather than specialising in one slice. Its customers are Saudi businesses that buy travel in volume: travel agencies (TMCs, OTAs, retail, wholesale, religious, MICE), government, corporates, hospitals, universities, and tender-holders.

The initiative that this brief is about is a lead-intelligence and workflow system built alongside Direct's existing operations. It has three moving parts. First, a master database of every licensed Saudi B2B entity that could plausibly buy from Direct — currently at version 1.98 with about 5,025 rows and full provenance stamps. Second, a B2B web app running live at directksab2b.com, which is a workflow and follow-up dashboard for the commercial team — leads, clients, offers, projects, airlines, providers, reports, settings. Third, a corporate marketing website that hosts a public lead-capture form so prospects can onboard themselves; that flow feeds the same master database and shows up in the same B2B app.

None of this replaces Direct Payment. Direct Payment is Direct's own internally-built cloud platform that runs at payments.directksa.com and is the source of truth for all money, invoices, tax invoices, credit lines, wallet balances, refunds, and settlements. The Direct Business dashboard is deliberately informative and synced — it mirrors what is happening in Direct Payment and the GDS and the aggregators, and it lets the commercial team coordinate around that data. It does not charge cards, issue tickets, or finalise invoices. Every action button labels the source system it calls into.

The strategy is vertical-by-vertical. Tourism is phase one because Direct is a travel company and can spot bad data by instinct. Pharma is phase two, MICE is phase three, industrial is phase four — each vertical gets its own database following the same schema and discipline. Phase one is well underway, phase two is not yet started.

Abdulrahman is not a developer. He wants plain-language communication, full authority for the assistant to act, no manual clicks or sign-ups, and no wasted credits on subagents (banned after two burns in June 2026). His work laptop is locked down by company IT — no command prompt, no C-drive access, no .exe launches — so everything runs through Q, the browser, and cloud tools.

# 2. Who Abdulrahman is

Abdulrahman Aboelmagd (عبدالرحمن أبو المجد) leads commercial and business-development work at Direct Travel KSA in Riyadh. He is not a developer. His background is operations, sales, and business development, and he thinks in terms of clients, credit lines, quotations, invoices, and follow-ups — not in terms of code, files, or version numbers. He has been polite but firm that jargon loses him, and that when technical terms show up unexplained he starts losing confidence in the work behind them. Every message written for him should read like a smart colleague who does not code — no file paths, no acronyms, no version numbers in the prose. "The app" or "your dashboard", not the raw file name. "Everything still works", not "regression suite is green". Numbers and outcomes are welcome; mechanisms are not.

He prefers to work fast and hand off cleanly. He grants full authority up front, expects the assistant to pick the better option and act, and does not want to be asked to click, upload, sign up, or authenticate anything he can reasonably be spared. His time is spread across meetings, the car, home, and his phone, so anything that assumes he is at a specific desk is unreliable. He follows conversations on both his desktop project view and the Dispatch chat on his phone, so the same substantive update needs to land in both places or he risks missing it. When he needs to copy a long draft on his phone, plain text in a project chat works cleanly for him — Dispatch on mobile does not select cleanly for long messages.

His primary account is business@directksa.com. His secondary test account is a.hassan@directksa.net, which he uses to see what a Team Member sees inside the B2B app. Colleagues on the team include Othman Al Sharafi (likely Manager), Raad, and Kareem, plus a colleague named Ahmed who registered the company Claude account but only uses Claude Chat in a browser. Confusing Abdulrahman with Ahmed is a trust-breaking mistake — the work on Cowork, Dispatch, the Q drive, and Direct is all Abdulrahman's, always. Older notes and older memory files sometimes call him "Ahmed"; those are still talking about him. The nickname Abu Mejd or Abu El Magd (and the short form 3bdo) sometimes appears — those are all him.

His work laptop is locked down by company IT: command prompt disabled, no C-drive access, no .exe launches, only the Q network folder is writable. Anything that requires typing into the local shell or double-clicking a .bat file is off the table for him personally. All technical work has to go through Claude's own tools, cloud services (Supabase, Vercel, GitHub via the API), or his Edge browser driven by the assistant. He is planning to migrate to a personal PC once cloud backup is sorted — likely Google Drive but not yet chosen. Until then, everything lives on the Q network drive.

On safety, three lines are permanent: never shut down, sleep, or restart his PC unprompted (if he explicitly asks, confirm twice first); never write to Gmail or Google Drive (both read-only); and money movement, trade execution, and deletion of irreplaceable data always require explicit per-action confirmation. Everything else is pre-approved forever.

# 3. What Direct Travel KSA is

Direct Travel KSA is the trade name of Al-Masafer Al-Mubashar for Travel & Tourism (شركة المسافر المباشر للسفر والسياحة), founded in 2016 and headquartered at Saif Plaza, Al-Hada, Riyadh 12321. Direct has more than 200 specialists on staff (200–500 band), holds IATA number 7123828, runs on Amadeus (GDS office RUHS2234B, Web Services office WSMSMTBS), integrates DCS PLUS and IRIX, is PCI-DSS compliant, carries a 750,000 SAR bank guarantee, and holds a subsidiary called TECHTIC that builds Direct's own software. It has won the World Travel Award three times (including the 2024 award for Saudi Arabia's Leading Visa Services Agency), an Arabian Best in Business Award 2025, has been named a Great Place to Work three times, holds ICEF accreditation for international education, and maintains more than 600 airline agreements.

The distinctive market position is breadth. Most Saudi competitors specialise in one slice — flights, or corporate travel, or umrah — while Direct offers the full stack in one place: flights, hotels, visas (tourist, student, residence, work), travel insurance, car rental and chauffeur, eSIM chips, international driving licences and Carnet de Passages, study abroad and scholarships, transfers, umrah and hajj, corporate travel, group bookings, cargo, and MICE (meetings, incentives, conferences, exhibitions). Value proposition: "Global supplier power. Saudi service. One partner." — قوة موردين عالمية. خدمة سعودية. شريك واحد. Direct's tagline positions it as one accountable partner rather than a fragmented set of vendors.

Customers are Saudi businesses that buy travel in volume, and the master database segments them into travel agencies (which is the biggest single funnel — TMCs, OTAs, retail, wholesale, religious travel, MICE operators, inbound operators, land tour operators, government and tender-holders), airlines, insurance companies, exhibition organisers, government entities, large corporates, hospitals, universities, consultancies, training organisations, and other B2B buyers. The commercial team also markets to BNPL and fintech merchants (Tabby, Tamara, Emkan, Madfu) as a distinct funnel.

Money comes in two shapes. Prepaid clients pay per booking or per project up front — that includes wallet top-up models where the client's balance sits inside Direct Payment and each transaction draws down. Postpaid clients hold a credit line with Direct (sizes vary widely — 20,000 SAR, 30,000 SAR, 50,000 SAR, up to 300,000 SAR and above per client) and settle monthly at the end of a Gregorian calendar cycle. The commercial team is authorised to extend an aggregate credit pool of exactly 1,250,000 SAR across all postpaid B2B clients; that pool cap is distinct from any individual client limit. Going over an individual credit limit is an informational warning inside the app (proceed-anyway with audit log), not a hard block. A third model, Tender, is specific to government contracts and carries its own numbering (TTIN-#### invoices), agreement, expected COGS, and expected GP.

Compliance with Saudi rules is mandatory on everything Direct produces: ZATCA Phase 2 e-invoicing with QR code and hash chain on every tax invoice, VAT 15% (charged on Direct's margin only — flight government taxes carry no VAT, external non-KSA services get no tax invoice), Arabic and RTL support end-to-end, Hijri calendar alongside Gregorian, IATA Wakeel disclosure, Saudi IBAN validation (SA-prefix, 24 characters), and National ID / Iqama / Passport handling. Direct's own legal identity — CR number, VAT registration, IATA Wakeel, Saudi IBAN, address, and Ministry of Tourism licence — appears on every invoice header and every proposal cover.

Direct's own suppliers and platforms sit behind all of this. Amadeus and Sabre are the GDSs. Travelfusion, Duffel, Babylon, Trip.com, and Kiwi are the online aggregators. RateHawk is a top hotel provider; TBO runs a deposit-based wallet; Hotelbeds is another hotel supplier. Payment gateways include MyFatoorah (Apple Pay Mada, one-off links), Tabby (BNPL at checkout), and card-issuer platforms SiFi (current) and Moola (legacy — Direct migrated from Moola to SiFi in January–February 2026). BSP settlement runs monthly through Amadeus. All of this reconciles daily against operational expenses inside Direct's own Expense system.

# 4. Why the B2B initiative exists — the three-phase vision

Abdulrahman laid out a phased strategy on 9 July 2026. Direct is a full-stack travel company that competes with specialists; the fastest way to grow market share is not to build faster tools for the same clients, it is to know the market better than any competitor and to reach every viable buyer with a proposal that fits their gaps rather than competes head-on. The B2B initiative is that intelligence layer.

**Phase one is tourism.** Direct is a travel company, so the person driving the project can spot bad data by instinct — he knows the players, the licences, the games competitors play. That makes tourism the safest ground to refine the methodology on. The output of phase one is a master database of every licensed Saudi travel entity, classified by services offered (17 boolean fields collapsed into a comma-separated list), GDS posture (Amadeus, Sabre, etc.), contact type (owner vs CEO vs manager vs employee vs reception), market direction (outbound, inbound, domestic, balanced), and the "complement angle" Direct can pitch to each — fill their gaps, don't compete. The methodology is defined by source verification tiers, two or more sources per new value, contact-type classification, service-offering audit, and periodic sample audits of every 50 to 100 rows. Every entity carries a Direct-fit tier from 1 (strongest match) to 4 (weakest), a functional score (0–3, one point each for a deliverable email, a valid E.164 phone, and a working relevant website), and full provenance stamps.

**Phase two is the app layer.** Once the tourism database is bulletproofed, it wires into the B2B app at directksab2b.com. Proposals, agreements, campaign lists, cold-outreach drafts, and partnership targeting all pull from the same database. Further data edits happen inside the app; the database stays as the source-of-truth reference and stays exportable to Excel any time.

**Phase three is vertical expansion**, one industry at a time, replicating the same schema and discipline. **Pharmaceuticals** first — distributors, licensed importers, foreign-brand agents, and hospitals — sourced from the Saudi Food & Drug Authority (SFDA), the Ministry of Health licensee lists, and drug wholesaler directories. **Conferences and MICE** next — event organisers, PCOs (professional conference organisers), exhibition producers, venue operators, and corporate conference planners — sourced from the Riyadh Exhibitions & Conferences Committee, event industry associations, GESS Middle East exhibitor lists, and the preferred-vendor lists of big venues. **Industrial and factories** last — factory owners, industrial services, freight forwarders serving factories, corporate travel and insurance for factory crews — sourced from MODON (the Saudi Industrial Property Authority), the Ministry of Industry and Mineral Resources, industrial zones directories, and chamber industrial committees.

Each vertical will get its own database, the same schema philosophy, the same source-verification discipline, the same "complement angle" mapping, and the same self-test sample audits. The reusable skills being extracted from the tourism build — contact-data-consolidation, direct-brand-voice, direct-proposal-design, direct-agreement-design, gcc-b2b-benchmark-patterns, direct-competitive-complement-mapping, saudi-market-database-methodology — will port across verticals unchanged.

Where he is today: phase one is well underway. The tourism master database has reached version 1.98 with 5,025 active rows. Phase phone coverage is at 70.8% (which exceeds the 70% target); email is at 20.2%, website at 20.5%; MoT licence coverage is at 64.4% because the base MoT registry provides that automatically. Phase two integration is live on directksab2b.com at app version 37, shipped on 25 July 2026. Phase three verticals are conceptual rather than started. The main friction on phase one right now is coverage: email and website sit around 20% and are the current push, because most rows are Tier 3 stubs from the MoT registry where only phone is available.

# 5. How the Direct ecosystem fits together

The ecosystem has three layers plus a set of external integrations, and understanding which layer owns what is the single most important architectural rule of this project.

**Layer one — Direct Payment (payments.directksa.com).** This is Direct's own, internally-built cloud platform. It is the source of truth for all money — clients, invoices, tax invoices, credit lines, wallet balances, expenses, refunds, proformas, payment receipts, settlements, pricing, GMV. It runs at scale: 508,006 invoices, 451,078 payment receipts, 118,748 expense invoices, 9,116 refund requests, 268 virtual cards, 14M+ SAR monthly transaction volume observed on a single day. It sits behind Cloudflare bot protection (which is why automated screen-scraping is off the table) and follows the ZATCA Phase 2 e-invoicing standard. Layer one is read-only from every other layer's perspective. Nothing in the ecosystem is allowed to charge cards, issue tickets, submit ZATCA, or execute settlements — those actions all live in Direct Payment.

**Layer two — the GDS and aggregators.** Amadeus (via Selling Platform Connect and DCS PLUS / IRIX integration) and Sabre are the GDSs; actual bookings and ticket issuance happen there. Six online aggregators are modelled: Amadeus (as an aggregator surface), Travelfusion, Duffel, Babylon, Trip.com, and Kiwi. Hotel supply comes from RateHawk (top), Hotelbeds, TBO, and direct property contacts. Every booking action — issue, void, reissue, refund — executes on one of these systems, not in any Direct-owned surface. The B2B app reflects the resulting PNRs, ticket numbers, and coupon states; it does not create them.

**Layer three — the Direct Business B2B app (directksab2b.com).** This is the workflow, follow-up, and coordination layer that the commercial team lives in. It is an informative synced view of layers one and two, plus its own soft CRM data (leads, funnels, activity, chain-of-command, offer drafts, project containers). The one action it does own is drafting invoices — an invoice draft can be built here and then pushed into Direct Payment, where finalising and charging happen. Every field the app shows knows its source system; externally-sourced fields render with a "synced from X" badge and are not directly editable inside the app.

**Layer four — the corporate marketing website.** Separate from the B2B app. Its role is public-facing marketing plus a lead-capture form so external prospects can onboard themselves. Website-onboarded leads flow into the same master database and the same B2B app the internal team uses.

Between layers, the sync boundary is one-way for money: layer one is authoritative, layers three and four read a summary of it, layers three and four never push back except in the one narrow case of a drafted invoice being explicitly pushed to source. Between layer two and layer three, the sync is also one-way: bookings and tickets are executed on the GDS or aggregator, then their PNRs and coupon states are reflected into the app. Between the corporate marketing website and the master database, the sync is one-way: form submissions land as new lead rows in the database, which then surface in the B2B app.

The chain of command discipline sits across all of this and is described in section 12.

The multi-device model for the app is one loop: pull, edit, push. GitHub is the single source of truth for the app code — no device holds the real copy, GitHub does. Every Claude session on any device (Abdulrahman's laptop, tablet, phone, or travel machine) pulls the latest index.html at the start, makes its edit, and pushes at the end. If two sessions collide GitHub rejects the second push and forces it to re-pull — nothing is silently overwritten.

# 6. Direct Payment — what it does, where the boundary is

Direct Payment is Direct's own back-office system, built by Direct's in-house dev team ("Hand-crafted & Made with ♥ by Direct Devs" per the footer). It is a large, structured admin console that handles every money-touching flow. The base URL is https://payments.directksa.com/en/admin. The public invoice URL pattern is https://payments.directksa.com/en/invoice/{uuid} — invoices are UUID-addressed on the public side, sequence-numbered on the admin side.

The system's top-level navigation covers Stats GMV (Confirmed / All), Expense Reports, Excel Exports, Expenses, Refund Requests, All Invoices, Credit Notes, Proformas, Payment Receipts, Corporate Clients (with sub-items: Dashboard, Corporate Clients list, Pricing Settings, Settlements, Corporate Expenses, COGs Report, Transactions, Corporate Invoices), Configurations (Cards), and an Expenses Demo sandbox.

**Invoice types and numbering.** There are three primary document types: Invoice (primary billing document with its own reference number and UUID), Credit Note (negative invoice for reversals and refunds), and Proforma (pre-issued quote invoice). Two numbering series are used: DPIN-NNNNNN for the regular B2B rollup invoices and TTIN-NNNN for tender invoices. Per-transaction receipt references start with 1163 followed by ten digits. When multiple transaction receipt refs roll up into a single invoice, they all reference the same Invoice Issuing ID.

**Customer taxonomy.** Every client carries a Customer Type (Government / Small Company / etc.) and a Client Payment Configuration of exactly one of three values: Tender, Pre-Paid, or Post-Paid. Pre-Paid clients top up a wallet inside the system; each transaction draws down. Post-Paid clients accumulate transactions against a credit line and settle monthly. Tender clients have an explicit Tender Number, Tender Amount, Expected COGS, and Expected GP. Every client also has a Pricing Setting (B2C or B2B, driving which fee table applies), and every corporate client's file carries an uploaded Agreement PDF, an uploaded Letter of Award, agreement start/end dates, and full contact information.

**The per-transaction to rollup to tax invoice cycle.** A customer transaction creates a per-transaction Receipt Ref (1163xxxxxxx) and generates a Proforma/Invoice in Pending Payment state with a Tax-Invoice-pending banner. A Payment Receipt is then created (via MyFatoorah, Apple Pay Mada, Tamara, or another gateway) and linked to the invoice. Once Fully Paid, status flips and the Tax Invoice is issued. For B2C this is one-shot: one transaction, one invoice, one tax invoice. For B2B (post-paid) the model splits: each customer transaction creates its own per-transaction Receipt Ref, but those Receipt Refs accumulate against the client and roll up into a single Corporate Invoice numbered DPIN-NNNNNN (or TTIN-NNNN for tender). When the client pays the corporate invoice, a Balance Receipt (BR-##) is created and a Settlement record links the BR to the invoice; the invoice flips to Settled. Throughout, Expenses track the cost side — every transaction (especially flights, hotels, visas) has an Expense Invoice paid via BSP/Amadeus or a virtual card, and that expense is Assigned (and Approved) against the transaction. Refund Requests are aggregated separately with their own DT-prefixed numbers, with a refund amount that can be partial, an Assignee, a Status pipeline (Under Review → Approved / Rejected), and an Expense Status gate ("Expense Needs Check" versus "Clear Expenses") that must clear before the refund can process.

**Products modelled inside Direct Payment.** Seven product lines: Direct Visa, Direct Flights, Direct Hotels, Direct Course, Direct Support, Direct eSim, Direct Packages. Per-product GMV is reported on the Stats dashboards.

**Payment gateways and card issuers.** Payment gateways include MyFatoorah (Apple Pay Mada), Tamara (BNPL), and Tabby (BNPL). Virtual card issuers include SiFi (current) and Moola (legacy — Direct migrated fully off Moola between January and February 2026). Each card is assigned to an employee or department; each employee registers card payments in the Expense system, filtered by card and department, with the transaction reference number logged by time and date. Physical cards exist for branches. FX on non-SAR is about 1%. Daily reconciliation matches operational expenses against card statements — the aggregate card balance plus wallet balance is what finance reconciles, not just the main account.

**The Direct Business dashboard boundary — read-only.** The rules on the Direct Payment side of the wall are absolute for any Claude session working on this project. No create, no edit, no refund, no charge, no void, no submit, no save. Observing forms is fine. Never click Save, Publish, Start-Submission-confirm, or Cancel inside Direct Payment. Read-only walkthroughs are for understanding, not for mutation. Direct Payment stays the boss of all money. The dashboard reads a tidy summary and shows it where the commercial team is already working.

# 7. The Direct Business B2B app — what it is, what it isn't

Direct Business (دايركت أعمال) is the internal working surface for Direct's commercial and business-development team. It runs live at directksab2b.com (custom domain), also at direct-business.vercel.app (Vercel domain), and the tablet layout is a companion file for on-the-go use. Version 37 is the current live build, shipped 25 July 2026. The app is a single self-contained HTML file (about 1.1 megabytes) with vanilla JavaScript and no build step or CDN — it opens by double-click when needed, and the localStorage keys plus JSON export/import act as the local editable backend. Login and multi-user state run through Supabase.

**Tabs and screens.** Today (the home tab — greeting, four big action cards for +New Lead / +New Offer / Open my queue / Find a client, plus attention strips). Leads (list, board, and detail view with chain-of-command, work log, smart suggestions, and a needs-attention counter). Clients (list plus the KSA onboarding modal covering CR, VAT, IBAN, signatories, documents, whitelist, and pricing scheme, plus chain-of-command). Projects (for MDD-style multi-trip engagements — seeded with real trips including Osaka, Lisbon, DC, London, USA, Morocco, Amman, Clock Towers Makkah, Iftar Ramadan). Offer Builder (bundle services, add freebies, send-for-review opens email plus WhatsApp). Airlines (all carriers with an NDC matrix per airline — 119 airlines seeded). Providers & GDS (the six modelled providers plus others). Sync & Integrations (health overview, per-source cards, conflict queue, and links to the legacy dashboards on Manus and Lovable). Reports (achievements log plus 14 objectives, 25 KPIs, and 12 initiatives from the Commercial Department 2026 Operational Plan). Bookings / Invoices / Tickets (read-only mirror of Direct Payment with a banner "Synced from the Direct system — read-only · Open in Direct"). More (Activity & Audit, Archive, SOPs, SLAs). Settings (daily-use cards on top; advanced controls collapsed).

**Cross-cutting features.** Commercial Credit Pool widget (pool size 1,250,000 SAR, monthly tracking of extended versus received versus outstanding versus headroom). Five view presets (Commercial / Finance / CFO / Everything / B2B snapshot). English/Arabic toggle with RTL throughout. ZATCA Phase 2 e-invoicing fields including QR code and hash chain on every invoice. URL-per-section routing (refresh keeps the page — Airlines refresh stays on Airlines, lead detail refresh stays on the lead). Page-size selector on every table (10/20/50/100/All, default 20, choice remembered per browser). Bilingual brand naming rule locked (English view shows "Direct Business" only, Arabic view shows "دايركت أعمال" only, never mixed). Welcome tour on first load. Command palette (⌘/Ctrl+K), N for new, E for edit, / to focus search, Esc to close, ? for shortcuts.

**What the app is not.** It is not a system of record. It does not charge cards, issue tickets, void reservations, submit ZATCA, or finalise refunds. Every button that would trigger a real-money or real-inventory action labels the source system it actually calls into — "Mark paid (Direct Payment)", "Issue ticket (Amadeus)", "Book (Travelfusion)". Fields sourced externally render with a "synced from X" badge and are not directly editable. The one editable exception is invoice drafting — the app can hold an invoice draft, then explicitly push it to Direct Payment where the finalising and charging happen.

**Colleague dashboards absorbed as presets.** Two other dashboards exist alongside: a Manus-hosted executive and finance view (revenue, profit, top clients, pipeline snapshot for the CEO and CFO), and a Lovable-hosted commercial-objectives view. Both are folded in as view presets inside Direct Business, with their URLs still visible in Sync & Integrations under "Legacy" so nothing is lost. A newer Sahara Sales Hub at sahara-sales-hub.lovable.app — an Arabic-first CRM-style deals pipeline backed by Google Sheets — is still catalogued as a decision item: absorb, mirror, replicate, replace, or catalog.

**Airlines and NDC context.** 119 airlines are seeded. Each airline card carries the WhatsApp-mined POCs (73 sales contacts across 27 airlines from the RUH office group), an NDC matrix showing which channels each airline supports, IATA codes, corporate portal links, and codeshare notes. The airline page is one of the tabs prioritised for bulletproofing in the queue.

**Service Integration Partners.** 39 partners in the ecosystem — eSIM providers, travel insurance, driving-permit issuers, other integration partners. 6 of them have apps verified on both iOS and Android stores; 27 have partner or API programs. The Service Integration Partners feature ships as a distinct funnel with app-store status, docs status, and iOS/Android badges on the table.

# 8. The corporate website and website-onboarded leads

Direct has a corporate marketing website that is separate from the B2B app. The B2B app at directksab2b.com is the internal working surface for the commercial team. The corporate site is a distinct property — the trade domain is directksa.com and the corporate portal referenced in brand notes is corporate.directksa.com — treat that as the working assumption until Abdulrahman confirms which URL will actually host the public lead-capture flow and the design. The two sites should never be conflated in copy or navigation.

The corporate website will host a lead-capture flow so external prospects can onboard themselves — filling in a form on the marketing site rather than being added by an admin inside the B2B app. Those website-onboarded leads must land in the same single source of truth every other lead flows through. The sync direction is: corporate website form → master database → B2B app dashboard, with no fork in the pipe and no separate storage for "website leads". Once in the master database and surfaced in the app they behave exactly like admin-added leads — same funnels, same stages, same cards, same activity log — with a source stamp indicating they came from the website form.

Field mapping between the corporate form and the master schema still needs to be defined, and where in the funnel a fresh website lead should land — default stage, default funnel (Inbound is the natural home), default owner assignment — is a decision Abdulrahman still needs to lock. Until then, the safe assumption is: default funnel is Inbound, default stage is "new", default owner is the account manager on rotation with a "needs assignment" flag if the roster is empty.

# 9. The leads funnel

The app models funnels as configurable containers, not as one hard-coded pipeline. Four funnels ship in the current live app: Inbound, Outreach & Network, Travel Trade, and Partners & Tenders. The Leads screen shows them as tabs across the top with a running count next to each and an "All" tab that totals them (last visible number was 998 leads across all funnels). Each funnel has its own field template so the questions asked of a lead in Inbound differ from the questions asked of a lead in Partners & Tenders, and every field template exists in both English and Arabic. Funnel names are placeholders and Abdulrahman has said he will revisit the naming and the per-funnel fields later.

The funnel stages are unified across every funnel: new, contacted, in_discussion, proposal, won, lost, and on_hold. That set is enforced by a database check constraint, so nothing else is accepted. Older stage names from earlier versions are preserved in a shadow stage_legacy field so no history is lost. A "Needs attention" counter surfaces leads that have gone stale or need a follow-up — the red counter at the top of the Leads screen is the most visible expression of it.

Stage changes trigger three things. Every change is auto-logged as an activity on the lead, so the timeline of who moved which lead when is always visible without anyone having to write a note. Moving a lead to won automatically flips the is_client flag to true and stamps a converted_date, so a won lead is implicitly a client from that moment. And the needs-attention counter recalculates whenever a stage lingers past its natural cadence.

Who can move a lead between stages is governed by the role system. Any signed-in user with edit rights on a lead can change its stage inside the app; the tighter restriction is on funnel settings themselves — only Admin, Manager, and Business-Development roles can rename a funnel, change its field template, or restructure the funnel list. Viewer role cannot change anything. Website-onboarded leads (once the corporate-site form is live) will start in a default stage inside a default funnel that Abdulrahman still needs to lock (working assumption: Inbound / new).

The funnel lives entirely in the B2B app and its Supabase backend — not in Direct Payment, not on the GDS side, not on the corporate marketing site itself. The corporate site's role is only to capture the initial form; once submitted, the lead flows straight into the same businesses table and funnels table the app already reads. Every stage change, every note, every follow-up lives in the app, from first touch through won or lost.

Interaction details on the funnel: each funnel tab shows a hover-preview card with that funnel's own fields, a red warning appears on a row when the lead has no contact person to reach, opening a lead shows a colour-coded box with the funnel-specific fields and an Edit button, stage change autosaves within a second or so and force-saves on tab close, deleting a lead archives rather than hard-deletes (soft delete via an archived_at column), and there is a CSV export per funnel. One further restructure is still on the queue: turning the Travel Trade funnel into a parent with subcategories (TMC, OTA, Retail, Wholesale, Religious, MICE, Inbound, Land tour operator, Government/Tender), and adding a new BNPL / Fintech merchant directory funnel alongside the existing four.

A lead-record data-integrity rule applies to every captured email, phone, website, LinkedIn, and address on every lead: they must all attach to the same company by a stable key (CR number preferred, otherwise verified root domain, otherwise exact normalised name, otherwise phone country prefix). Cross-field consistency check runs before save — a mismatch is either dropped or flagged, never silently mixed. This is the "no cross-company data smuggling" rule.

Priority filter for new leads: green priority means Mid (51–200 employees), Large, or Enterprise. Yellow "flagged for review" means Micro or Small (kept, not dropped). White "unknown" means needs research. Direct wants B2B volume clients, not one-off booking requests. A campaign-ready fields set was added on 24 June: preferred contact channel, language preference, decision-maker name plus direct email and WhatsApp, time zone, social handles, years in business, company size band, revenue band, branch count, marketing tags, last marketing touch plus response dates, per-channel opt-in status (Email / WhatsApp / SMS — required for KSA Anti-Spam and PDPL compliance), and recent news / press hooks.

The parts of the funnel almost certainly still in the Claude Code session and not fully captured here: exact stage-transition rules beyond the won → is_client trigger (any auto-move rules, any time-based aging, any escalation rules), the full field templates per funnel, the exact policy for who owns a new lead by default, and any funnel-specific SLA. If any session needs those, ask Abdulrahman to point to the Claude Code session or restate them; do not invent them.

# 10. The full sales and operations workflow — end-to-end

The workflow playbook (v22) walks every step of a real B2B request from the moment a client asks, through booking, invoicing, expense tracking, and post-trip settlement. Each phase names who does the step, where in the dashboard it happens, what reflects where, and what runs in the source system.

**Phase A — Onboard a new B2B client.** Who: Account manager plus Finance lead. Where: Leads → open the client → KSA onboarding button top right. Six sections. A1 identity captures name (English and Arabic), classification (Ministry / Government / Corporate / Tender / Chamber / Sports Club / Private / SME / NGO / Multinational), industry, branch or HQ, and bilingual address. A2 KSA registration captures the Commercial Registration number with expiry date, the 15-digit VAT registration number (used as buyer VAT on every invoice), and the 24-character Saudi IBAN (SA-prefix). A3 pricing scheme and payment scheme sets pricing (Standard / Corporate negotiated / Tender / Government rate / Ministry rate / Chamber rate / VIP custom / B2C walk-in), a markup table per service (flights / hotels / visas / transfers / insurance / other), payment configuration (Pre-Paid wallet, Post-Paid credit-line, or Tender), credit limit in SAR, billing cycle day (default 28), late fee policy, and the collections owner. A4 authorised signatories lists the people authorised to sign on behalf of the client with name, ID, and title. A5 documents attaches CR copy, VAT certificate, contract or MoU, NDA, authorisation letters, bank confirmation, power of attorney, ID copies, and anything else, each with type tag, expiry date, status (Active / Expired / Renewed / Pending review / Revoked), and uploaded-by. A6 authorised travellers whitelist lists pre-approved passenger profiles — bilingual name, passport, national ID or Iqama, DOB, frequent-flyer numbers per alliance, contact, and preferences.

A required-before-save Chain-of-Command section sits alongside this and is described fully in section 12. Onboarding without it is not permitted.

**Phase B — Receive a new request.** Who: Ops agent. Where: Today → +New offer or a fresh activity log on the client's lead page. Tag the source channel (WhatsApp / email / phone / portal / walk-in). Pick the client from the search — pricing scheme, credit limit, and whitelist auto-apply. Capture travel details (dates, route, pax count, class preference, special service requests). Set request status: New → In Progress → Quoted → Confirmed → Won or Lost. The dashboard runs a real-time credit-utilisation check for postpaid clients: green under 80%, amber warning at 80% and above, red blocked at over-limit with manager-override option.

**Phase C — Build an offer.** Who: Ops agent. Where: Offer Builder or from the lead → Create offer. Build a service bundle (Flight / Hotel / Visa / Transfer / Transport / Day tour / Insurance / Lounge / Meals / Other) with per-item provider, cost, markup from the client's pricing scheme, sale, margin, pax, dates, route, and NDC source. The dashboard auto-applies the client's pricing-scheme markup — agents do not recalculate. A freebies sub-section holds items at zero cost to the client with internal cost tracked for margin. Up to four options can co-exist on the same offer (economy direct versus business connecting, etc.). Generate the offer document — bilingual English plus Arabic, branded with agency letterhead, IATA Wakeel disclosure, and Saudi IBAN. Output PDF plus WhatsApp/email share copy. Click Send for review (Email + WhatsApp) → status moves to Sent → expiry countdown starts.

**Phase D — Client approval → Booking.** Who: Ops agent plus Manager for credit-gate override. When the client approves, mark the offer Approved plus the chosen option. Convert to booking — the dashboard pre-links client, pax from the whitelist, and fare rules from the offer option. Postpaid re-validates the credit limit at conversion time. Prepaid triggers an immediate Draft invoice against the client's wallet. The booking record stores source system (Amadeus / Sabre / Travelfusion / Duffel / Babylon / Trip.com / Kiwi), the PNR and record locator (entered by agent from the GDS), TTL countdown, and QC checklist (Low-fare check / Fare rules confirmed / Pax details verified / SSRs added / TTL set / FOP confirmed / Approval gate).

**Phase E — Ticket issuance plus invoice flow.** Who: Ticketing desk plus Finance. Tickets are issued in the source system (Amadeus terminal command). The agent then logs each e-ticket in the dashboard: airline, provider, PNR, e-ticket per pax, fare basis, RBD, fare amount, validity, FFN, SSRs, coupon-level status. The dashboard reflects the new tickets onto the Airline and Provider dashboards automatically (booked volume, routed volume). A Draft Invoice is created automatically from the booking, one line item per service. The Draft banner appears: "Draft invoice — fields are editable. Push to Direct Payment to mint the ZATCA UUID + hash chain. After push, fields become read-only." Click Push draft → Direct Payment: confirm modal names Direct Payment and mentions idempotency; optimistic Pending state while the round-trip runs; resolves to Issued plus ZATCA UUID minted plus QR plus hash chained against the previous invoice; the "Synced from Direct Payment" pill takes over; fields become read-only with a "Request change in source" hint. Push to ZATCA Fatoora: status pipeline Not submitted → Submitted → Cleared / Rejected. For postpaid clients the invoice auto-tags to the current Gregorian cycle; at cycle-close the dashboard generates the DPIN-NNNNNN rollup invoice listing every child invoice for that cycle plus a statement of account.

**Phase F — Expense tracking.** Who: Ops agent plus Finance. Log an expense against each booking and invoice: amount, currency, date, form of payment (IATA BSP via Amadeus / Virtual credit card with sub-detail such as "Direct VCC 4242" / Bank transfer / Cash), transaction ID, proof-of-payment attachment (PDF/image). Each expense is linked to a specific booking plus invoice — so the cost side reconciles to the sale side. A settlement reconciliation panel matches BSP report periods, virtual-card statements, and bank-transfer records.

**Phase G — Travel happens.** Coupon-level status updates as pax fly (automated once real inbound sync from GDS is wired; manual in the meantime). Booking moves to Fully Used when all coupons are used, Partially Used otherwise.

**Phase H — Post-trip.** Who: Finance. Payment received → sync inbound from Direct Payment → invoice flips to Paid → credit-line restored for postpaid. For postpaid, end-of-cycle the statement of account auto-generates (bilingual, branded) and gets sent to the client via WhatsApp or email. Refund path: raise a refund request (DT-prefixed number, SLA, assignee), default mode is refund-as-wallet-credit to the client's Direct wallet (not cash — the client can opt for cash back to the original payment method), generate a Credit Note with its own ZATCA UUID and hash chain posted to the current cycle's rollup. Reports on demand: booking report per period, client period report, reconciliation report (BSP plus virtual cards versus invoiced), statement of account per client, profitability report per booking / per client / per product. Archive after the retention period — soft-delete only, never hard-delete.

**Cross-cutting reflection map.** Lead created reflects on Today (new lead counter), Leads list, Activity feed. Offer sent reflects on lead activity, Today (Quoted), Audit log. Booking created reflects on Bookings list, Airline dashboard (booked-volume), Provider dashboard (routed-volume), lead activity, Today (TTL counter if TTL set). Ticket issued reflects on Tickets register, Booking detail, Airline dashboard, Provider dashboard, Audit. Invoice drafted reflects on Invoices list (yellow Draft state), lead lifetime billed (counts as pending). Invoice pushed reflects on lead billed, ZATCA badge, Sync activity feed, Today (overdue if past due). Expense logged reflects on booking margin recomputes, Expenses list, Sync (Direct Payment), profitability view. Payment received reflects on Invoice Paid, lead open balance shrinks, credit-line restored, Today (paid counter), Audit. Refund reflects on Refund queue, Credit Note (ZATCA), wallet balance increases, Today (refund counter), Sync activity. Cycle close (postpaid) reflects on Rollup invoice created, statement of account ready to send, cycle marked closed.

# 11. Reissue, refund, void, ancillary — by service type

The v22 playbook covers the happy path. The v23 extension covers what happens after issuance when the trip changes, across all six service types. Every action below mirrors a source-system action; the dashboard's job is to record, reflect, and chain ZATCA correctly.

**Reissue R1 — Flight reissue** (date, route, or fare change). Ticketing desk uses the Amadeus terminal (TWRA, TTM, or fare reprice) to issue the new e-ticket. The agent enters the resulting fare difference and new fare basis back in the dashboard. Parent ticket becomes EXCHANGED, parent coupons all EXCHANGED, child ticket is OPEN with new fare basis, tagged EMD-A (associated), validity 1Y. Positive fare difference adds a line to the invoice ("EMD-A · Reissue fare difference"); negative fare difference auto-generates a credit note with its own ZATCA UUID and hash chain. Booking status → Reissued.

**Reissue R2 — Hotel reissue** (date change). Ops confirms new dates with the hotel; parent hotel becomes REISSUED, child OPEN with new dates and new cost; positive delta adds an invoice line, negative delta generates a credit note; vendor reflection updates (old volume removed, new added).

**Reissue R3 — Transfer reschedule.** Same pattern as R2 for the transfer vendor.

**Reissue R4 — Visa amendment.** Visa desk reruns the application in the visa portal. Parent visa becomes AMENDED, child has new application reference and new expiry date, tagged EMD-S (standalone) because visas are standalone documents, fee delta captured plus an EMD-S line on the invoice.

**Refund F1 — Full refund pre-departure** (all coupons unused). Amadeus refund command plus Direct Payment refund processing. Ticket becomes REFUNDED, coupons all REFUNDED, refund request DT-… raised, credit note generated with own ZATCA UUID and hash chain linking to the original invoice's hash. Destination wallet → client walletBalance increases; destination bank → invoice payments[] gets a negative entry. Booking → Refunded. Hash chain verified.

**Refund F2 — Partial refund** (one coupon used). Only unused coupons → REFUNDED; used coupon stays USED. Refund equals (fare+tax) divided by coupon count times unused count minus penalty. Partial credit note. Ticket → PARTIALLY-REFUNDED.

**Refund F3 — No-show refund** (per fare rule). Ticket → NO-SHOW. Refund typically equals taxes minus penalty (fare itself forfeited). Penalty captured as a fee on the refund request.

**Refund F4 — Same-day void** (within void window). Ticket → VOIDED, coupons → VOIDED. If the invoice was still Draft the invoice flips to Voided with no credit note (invoice never cleared ZATCA). If the invoice was already Cleared, a credit note is still required.

**Refund F5 — Hotel cancellation with deposit forfeit.** Hotel → CANCELLED. Refund equals paid minus forfeited deposit minus penalty. Credit note for the refunded portion only.

**Refund F6 — Visa fee refund** (agency portion only). Government fees are non-refundable. Refund equals paid minus government fee. Visa → CANCELLED.

**Ancillaries.** Seat / meal / baggage / lounge / fast-track / wheelchair (free versus paid, per pax); cross-service ancillaries (hotel late checkout, transfer extra stop, day-tour upgrade). Each ancillary is EMD-A associated with the parent ticket where applicable. Free ancillaries carry zero client-facing cost but internal cost is still tracked for margin visibility.

For every scenario, the propagation check runs across airline (booked or refunded volume), provider (routed or reversed), invoice (credit note or adjustment), client (credit-line restored or utilisation changed), lead (work log entry), Today (overdue follow-up if action needed), audit trail (full chain), reconciliation (still balanced), and reflection sweep across all dashboards. The goal is airtight. Every scenario passes.

# 12. The chain-of-command discipline

The rule exists because of a real incident on 1 June 2026. A normal employee at a B2B client delayed a payment. When Direct's team asked for the money, the employee got angry, demanded "more flexibility," refused to pay, and threatened to break the contract. The conversation surfaced in the B2B WhatsApp groups. Direct did not know whether that employee actually had the authority to break the contract or who to escalate to instead. It turned out: no — the decision maker on the client side was two levels above them, and the contract signatory was the CFO. The threat was empty, the conversation was lost time, the relationship was strained for no reason.

The lesson is that Direct cannot operate B2B accounts without knowing the client's authority hierarchy in writing at onboarding time. The same rule applies in reverse — every client needs to know who at Direct owns their account so escalations route correctly.

**Required client-side fields on every B2B client** (added in v24 of the dashboard). Account manager (day-to-day operational contact, the one messaged about bookings). Decision maker (the person with authority to sign off purchases, approve refunds, negotiate terms — often head of finance, GM, or owner). Contract signatory (legal name plus title plus ID of the person who signed the contract). Hierarchy chain (Employee → Supervisor → Manager → Director → C-level, each rung with name, title, email, phone). Authority matrix (what each rung can approve: payment-term changes, refund requests, credit-line changes, contract termination, price negotiation). Emergency contacts (out-of-hours or weekend reachable contacts with role). Per-service-line authority matrix, added v25 — which contact authorises flights, which authorises hotels, which authorises ground, which authorises visa, which authorises contract changes.

**Required Direct-side fields**: Account owner (the Direct staffer who owns this client). Backup owner (covers during PTO or sickness). Escalation path (Account owner → Direct Operations Manager → Direct GM, each rung with name, email, phone). Last review date (when this chain was last re-confirmed — annual review pattern; the card ambers if not re-confirmed within six months).

**How the dashboard surfaces it.** Client header shows a yellow "Chain incomplete" badge until the three required fields are filled; green "Chain OK" once. Client detail page shows a collapsible Chain of Command card right below the header. Top-right button on every client page opens the full edit modal. In onboarding the chain section is open by default; the rest are collapsed. On every payment-related action (mark overdue, send dunning, escalate, mark paid, request refund), a small violet Quick Check tooltip appears with the decision maker plus first escalation rung from the chain — pulled live, updates as soon as anyone edits the chain.

**How to use it during a friction conversation.** Ask one question of the matrix: "does the person I am talking to have the authority to do what they are threatening or demanding?" If demanding a refund and the matrix says day-to-day only, ask politely who on their side approves refunds. If threatening to break the contract and terminate is not their authority, do not react to the threat; loop the actual signatory. If asking for new payment terms, capture the ask and confirm with the decision maker before agreeing. If negotiating a price, check the matrix — many clients delegate this to a manager; some keep it at director.

**Re-confirm cadence.** Every six months minimum, sooner if the client's company has gone through a reorg, if the Direct staffer who owns the account has rotated off, or if a friction event surfaced confusion about who has authority. Re-confirmation is one click on the chain card and sets lastReviewDate to today.

**What the discipline does not do.** It does not store client-side passwords or sensitive auth credentials — the chain captures who has authority, not how they prove it. It does not surface the authority matrix to the client — it is an internal map. And it does not auto-escalate based on the chain — humans decide whether a friction event has crossed the threshold; the chain just makes the right name visible.

# 13. Roles and permissions

Four roles are live in the app. Admin (Abdulrahman and anyone he fully trusts) can do everything — see and change all data, manage the team, change settings, and the rare dangerous actions like Reset for go-live and full wipe. Manager (for example Othman) runs the day-to-day for the whole team, can see and edit everything operational, and can add team members and set their level, but cannot create another Admin and cannot run the destructive Reset/Wipe. Team Member (BD and operations people) creates and edits leads, clients, offers, and bookings, and uses the airlines and suppliers info; cannot delete whole records, cannot manage people, cannot change company settings, and does not see the company-wide credit pool or total outstanding money (sees only their own clients' figures). Viewer is read-only — sees screens but changes nothing; new joiners start as Viewer by default until promoted.

The permission matrix runs across Today/Dashboard, Leads, Clients, Offer Builder, Airlines, Providers, Reports, Bookings/Invoices/Tickets, Activity log/Archive, SOPs/SLAs, Settings, and Agency profile. Full (see plus create plus edit plus delete), Edit (see plus create plus edit — no delete), View only, or None. Admin gets Full on everything; Manager gets Full on operational areas plus View on Bookings/Invoices/Tickets and Agency profile; Team Member gets Edit on operational areas, View on Bookings/Invoices/Tickets and their own Reports and Activity, and none on Settings or Agency profile; Viewer gets View on everything and Edit on nothing.

Special powers are gated to Admin and Manager: inviting a teammate (both), setting a role (Admin any, Manager up to Team Member only — cannot create Admins), seeing the credit pool and total outstanding (both), approving an over-credit-limit booking (both), running the built-in health checks (both), exporting a full backup (both). Admin-only: change the agency profile, Reset for go-live, wipe or delete all local data.

The Team screen is where all of this lives. Admin creates accounts by email in the Supabase dashboard, or via the in-app Team → Add teammate flow which calls an admin edge function that generates a temporary password shown once with a "Copy message" button for WhatsApp. Users with must_change_password=true set their own password on first login. An access_allowlist table decides the auto-role on account creation: business@directksa.com and aboelmagd@directksa.com are pre-seeded as Admin, osharafi as Manager, a.hassan as Team Member. Anyone not on the list lands on an "Access not active yet" dead-end screen — no data.

An admin edge function called admin-users handles create-user, reset-password, and switch-active — the Supabase service key stays server-side inside the function; the client never sees it. The function refuses any call from a non-active-admin caller, even if invoked directly from a browser console. Admins cannot lock themselves out (self-demotion and self-deactivation are refused server-side). Only admin, manager, and business-development can rename funnels or change funnel settings — everyone else can look. Deleting a lead archives via archived_at (soft delete); a Recycle bin screen is on the queue but not yet built.

# 14. The reports the app produces (or should produce)

Direct's report library is dominated by five recurring output families. The app already covers the transactional deliverables cleanly (per-transaction invoice, rollup invoice, tax invoice, statement of account, AR aging totals, hash report, full-state export). Four client-facing and internal-management families are the current gap. This section catalogues each family — what is in the library, what the template looks like, the dashboard data sources, the calculation, the required output formats, the language, the branding, the frequency, the audience, and the recommended generation mechanism.

**Service-Fee Proposals** are the single most important client-facing artefact Direct produces. They tell a prospect what Direct charges per service type (flights, hotels, transport, visa, conferences, MICE), with bilingual line items, segmentation by transaction band (fewer than 100 tx/month, 100–500, 500–1,000, over 1,000), and value-add notes. Sales lives or dies on these decks. The library holds 18 PowerPoints in 08_Quotations_Tenders/Proposals/ — Cashin, Aula Club, Kafalah, ASAS Makeen, Benchmark, and a General blank master. Every deck follows the same six-slide anatomy: cover with Direct logo, client logo, proposal title, year, contact; About Direct with CR, VAT, IATA Wakeel, IBAN, location, contact block; one slide per service type with the transaction-band-to-fee table; closing SLAs and signoff. Output: PPTX editable plus PDF locked, one click each. Language: AR plus EN paired siblings. Frequency: on-demand, generated when a lead reaches the "send pricing" stage, refresh annually per client. Audience: prospect's procurement or decision maker. Missing today: a per-client serviceFeePricing entity with per-service-type bands, AR/EN parallel pricing strings, and a per-client pricing override.

**Client Proposals / Quotes / Tenders** are project-level quotes for a specific trip, event, or tender. Distinct from service-fee decks: those are "what we charge per booking"; these are "for this specific project, here's the all-in price." The library holds 126 files across 08_Quotations_Tenders/ plus the per-client folders in B2B & Bidding/ (SportElixir Milan training camp, MDD Lisbon and London and Osaka, Islamic University of Madinah, formal Saudi tender responses with SR_ prefix). Anatomy: cover with project name plus dates plus destination plus client logo; project brief; itinerary slides per leg with flights, hotel, ground transfers, day-by-day; hotel options (typically three — Economy / Standard / Premium — with photos and per-room rate); flight options; ancillaries (visa support, insurance, conference room, banquet, transport, gifts); pricing summary per pax times pax count equals grand total, with Arabic-Indic and Western numerals; terms (cancellation, deposit, payment milestones, validity until); signature/approval block. Missing today: a project container that groups multiple bookings and ancillaries into a single quote, per-option side-by-side hotel/flight rendering, a cancellation-terms catalog. Output: PPTX plus PDF plus a one-page WhatsApp share card. Versioning writes new revisions so R1, R2, R3 chain matches the WhatsApp share history.

**Statements of Account** are periodic client billing summaries — what the client owes across all bookings in a billing cycle (postpaid) or what they have prepaid and drawn down (prepaid wallet). Already partly generated by the dashboard. The library holds 15 files: simplified statement exports from Direct Payment (large, tens of megabytes for high-volume clients), PDF cycle statements, merged AR-plus-EN PDFs, bank statements (Al Inma), virtual-card transaction reports, annual target-vs-actual statements, per-client Arabic statements with names, and capped statements (for example a "50k only" cap). Anatomy: Direct letterhead header with client name plus CR/VAT plus statement period plus generated-on date plus ZATCA mark; opening balance carried forward from the prior cycle; transactions list with invoice number, date, service type, description, pax/PNR, sale, VAT, total, payment status, running balance; subtotals per service type; closing balance; aging breakdown (0–30 / 31–60 / 61–90 / 90+ days); signatures and footer with bank details for payment. Have today: cycle close, rollup invoice, aging totals, statement print. Gaps: Arabic template parity (the Arabic statements are handcrafted, not generated — need a proper RTL render), an optional cap parameter, a target-vs-actual annual variant, a merged AR/EN single-click PDF.

**Sales / Income Reports** are the monthly leadership update — a monthly deck for the CEO/board plus a deeper quarterly retrospective. Ahmed regenerates these by hand every month. Biggest single time sink in the library. 55 files in 06_Sales_Income_Reports/Reports/, split between 2024 and 2025, plus a Reports/Reports/ subfolder for sub-team variants — Business Department January through December, Business Department 4th Quarter, BD Q1, Commercial report 2nd Q 2025, تقرير قسم التطوير العملاء 2024 (per-client Arabic annual), تقرير قطاع تطوير الأعمال Q2 2024, per-client Arabic reports, Dubai ATM trade-show retros, BSolutions RateHawk vendor reports, 2025-H1-Overall EN summary, 2025 achievements deck, 2025 opportunities register XLSX. Typical monthly deck: cover, executive summary (revenue, profit, new clients, top three wins, top three losses), revenue split by service type, revenue split by client tier and top-N clients, pipeline status, AR aging snapshot, BSP/virtual-card spend, new client onboarding, lost/dormant clients, vendor performance (provider mix, NDC penetration), project pipeline, next-month priorities. Have today: every transactional fact needed for all 12 slides. Gaps: no PowerPoint output path — either render via python-pptx (Cowork side-tool) or as a printable HTML "deck view" styled for A4/16:9; no month-close snapshot; no per-client report variant; no per-event retro (Dubai ATM, MDD project retros); no per-vendor performance report.

**Expense Reports / Reconciliation** are the cost side of every booking. Each booking has a cost line that goes through BSP (IATA via Amadeus), virtual card (SiFi/Moola), client wallet, or bank-transferred vendor payment. Library dominated by daily card-statement exports — 38 files in 05_Expense_Reports/. Anatomy of a typical Expense Excel Report: date, card last-4, merchant, MCC, authorisation ID, amount SAR, currency if foreign, FX rate, settlement amount, status Posted or Pending, notes. Have today: v22 expense entity, FOP enum, per-card transaction model implicit. Gaps: no reconciliation report that takes a SiFi or BSP statement (XLSX import) and matches each line to a database expense — this is the headline reconciliation gap Ahmed presumably does in Excel today; no "expense per project" roll-up for MDD-style project closeout; no FX handling visible in the current entity.

**Project Closeout Reports** are per-project P&L bundles — one corporate client's eight past events across several cities (client name kept out of this public repo, rule 7). Each project carries proposal, per-pax tickets, hotel confirmations, vendor tax invoices, payment proofs, purchase orders, rooming list, summary deck, final invoice to client. The report is the consolidated bundle plus a P&L showing revenue versus cost versus margin. 77 files in that client's project-events folder plus its entire subtree of B2B & Bidding (263 files). Gaps: project container (as in Section 10 pending build), vendor invoice entity (currently filed as PDFs), project P&L roll-up generator.

Beyond those five families the app already generates or plans to generate: booking report per period, client period report, reconciliation report (BSP plus virtual cards versus invoiced), statement of account per client, profitability report per booking / per client / per product, achievements log, Direct's 2026 Commercial Department Operational Plan report (14 objectives, 25 KPIs, 12 initiatives), and the Direct integration model report (three-phase deep-links plus scheduled export plus real API).

# 15. The master database of Saudi B2B entities

The master database is the foundation of everything. Version 1.98 is the current stable release, generated 12 July 2026, containing 5,025 active rows across 71 columns. It is a single, deduplicated, functional-quality database of every Saudi B2B entity that could plausibly buy from Direct — travel agencies, airlines, insurance companies, exhibition organisers, government entities, large corporates, hospitals, universities, consultancies, training organisations, and other B2B buyers.

**Distribution.** Tier 1 (strongest match — the highest-value Direct-fit): 54 rows. Tier 2 (good match): 911 rows. Tier 3 (future / lower priority): 3,574 rows. Tier 4 (weak): 453 rows. None (excluded): 22 rows. The Tier 3 mass is the structural ceiling — 90% carry phone but only 1% carry email or website. They come from the MoT registry which lists licensees with phone but not much else. Breaking past 20% email/website coverage requires either paid enrichment (which Abdulrahman has ruled out until every free path is exhausted) or Chrome MCP-driven scrapes of JS-heavy Saudi government portals.

**Coverage** (any-field, meaning at least one populated slot per row). Email: 20.2% (1,015 rows). Website: 20.5% (1,029 rows). Phone: 37.2% direct plus 70.8% any-field including secondary and WhatsApp — exceeds the 70% target. MoT licence: 64.4% (about 3,238 rows). Rows with functional score of 2 or higher (deliverable email plus valid phone plus working website): about 950 rows, or 19% of the database.

**Schema highlights.** row_id is a unique ST#### identifier. entity_en and entity_ar carry the company name in each language. entity_type is one of travel_agency, airline, insurance_company, government_entity, large_corporate, hospital_medical, university_education, consultancy, training_org, exhibition_organizer, or other_b2b_buyer. direct_fit_tier runs 1 to 4. official_licence_number and licence_status hold the MoT registration. Multiple email slots: email_primary, email_secondary, contact_1_email, contact_2 (pipe-delimited multi-field), contact_3 (pipe-delimited multi-field). Multiple phone slots: official_phone, mobile_primary, mobile_secondary, landline, whatsapp. website is the primary URL, HTTPS with no trailing slash. services_offered is a comma-separated list built from 17 boolean has_* columns (visa, flights, hotels, transport, insurance, umrah, hajj, etc.). gds_systems is a comma-separated list from four gds_* columns (amadeus, sabre, travelport, others). market_direction is outbound/inbound/domestic/balanced. source_signals, verification_evidence, field_confidence, and quality_flags carry the audit trail. sources tracks the origin files. tier_classification_reason, tier_upgrade_reason, exclusion_reason carry the classification history. duplicate_of and merged track dedup. notes is free-text context including OCR flags, merge notes, direct payments history. needs_manual_confirmation is Abdulrahman's review queue (currently kept close to zero by aggressive attribution).

**Sources fed in.** SAUDI-TRAVEL-TRADE-DATABASE.xlsx (3,725 base rows). MOT-LICENCES-RAW.csv (135 official records provided by Abdulrahman). B2B-CONTACTS-FROM-WHATSAPP.csv (288). B2C-LEADS-FROM-CONTACT-FORM.csv (3,780). BNPL-MERCHANTS-STAGING.csv (195 — Tabby, Tamara, etc.). Tabby travel-merchant harvest (420 travel-related). Direct invoices (157 paying clients). LEAD-MASTER-ENRICHED-v30.csv. LEAD-IMPORT-STAGING variants. LEAD-MASTER-NONTRAVEL-DOMAINS.csv. TAs.xlsx (Saudia mailing archive — 2,844 emails, 647 domains). Web enrichment via WebSearch and Chrome MCP against the official Saudi sources: LinkedIn Company, Instagram Bio, Facebook Business, Google Business Profile via Maps, Salla.sa, Yellow Pages KSA (yellowpages.com.sa), daleeliksa.com, Maroof.sa, Chambers of Commerce (Riyadh rc.org.sa, Jeddah jcci.org.sa, Eastern asharqia.org.sa), TikTok/X/Snap Business, and Zawya/Argaam/Menabytes for news.

**Version history highlights.** v1.19 established the schema and reclassified tiers. v1.20–v1.22 pushed coverage with OR-gate for untiered rows and four decisions from Abdulrahman on one-company-one-row consolidation. v1.25–v1.29 fixed the HYPERLINK landmine (12,731 HYPERLINK() formulas converted to plain text so the data is portable), reduced columns 113 → 62, and pushed nine quality tests to 100%. v1.30–v1.34 did aggressive scrape phases A through D. v1.35–v1.41 integrated the TAs.xlsx Saudia archive (2,844 emails, 647 domains), added multi-email discovery per company, and did a full source audit plus merge plus multi-value fields. v1.42–v1.68 continuous web scrape driven by the "don't ever stop till all is finish" rule (11 July 2026) — enriched about 400+ major KSA entities across airlines, banks, insurance, conglomerates, gigaprojects, government agencies, tech multinationals, petrochem. v1.85–v1.98 pivoted from generic sector sweep to row-driven pulling (pulling entity names directly from Tier 1+2 rows without email) after coverage plateaued at 19%.

**Self-audit (v1.89) found and fixed 442 issues** across seven landmine classes. 18 misclassifications (airlines and insurance tagged travel_agency because the source file was travel-focused) — reclassified. 8+ language swaps (Arabic name in the English column, English in the Arabic column) — moved to correct field. 12 field swaps (URL in email slot, phone-string in email slot) — reused first, then blanked original. 24 email/website domain mismatches — flagged (not overwritten). 7 SAR-amount notes disconnects — flagged. 57 name duplicates × 2 rows each (59 merges applied) — dedup key normalised to lowercase, single-spaces, trimmed. 381 empty rows (all fields blank) — flagged as quality_flags = "empty_row_no_data" (not deleted per the NO DELETE rule). 0 personal-email-on-corp hits. 0 residue placeholders. Every fix followed NO DELETE — REUSE FIRST: placeholder residue moved to quality_flags, blanked; swap fixes moved to correct field then cleared original; merges set duplicate_of on losers and aggregated contacts into the survivor; empty rows flagged only. All nine lesson types codified into MASTER_RULEBOOK Section L so future work never repeats these landmines.

**Files on disk** (Q:\Downloads\Claude\Apps and websites\). Only four top-level MASTER_DB files by design: v1.0_FINAL frozen baseline reference (9 July), v1.32_TIER3 snapshot (10 July), v1.39_FINAL TAs integration snapshot (11 July), v1.98_FINAL current (12 July). All intermediate versions are in the _archive/ subfolder. The direct-b2b-master/ subfolder holds MASTER_RULEBOOK.md, SOURCES_v1.98.xlsx, self_audit_v189.md, and a SOURCES/ tree with all raw and enriched input files organised into 01_uploaded_by_you, 02_source_csvs, 03_source_xlsx, 04_reports_audits, and 05_rulebook.

# 16. Skills, tools and workflows used across sessions

Across two months of Cowork and Dispatch and Claude Code sessions, a specific toolkit has been used to build, verify, and maintain the Direct B2B initiative. Every one of these was chosen for a concrete reason and every one has known gotchas.

**Desktop Commander (mcp__plugin_desktop-commander_*)** is the primary tool for all Q: filesystem work and any binary, zip, Excel, or Arabic-text processing. It uses PowerShell plus .NET under the hood on Windows. Every file read, write, list, search, and info call on the network drive goes through it. Its start_process plus interact_with_process pattern is the correct pattern for local file analysis (CSV, JSON, Python data work). Rule: never use the workspace bash sandbox for Q: files — bash cannot see the network drive. Always use absolute Windows-style paths.

**Chrome MCP (mcp__claude-in-chrome_*)** is the correct tool for browser-driven work on the user's Edge browser. Used for: harvesting Saudi government portal data that plain WebFetch cannot see (most Saudi gov sites are React SPAs that return an empty shell to plain fetches — Chrome renders the JS and sees the real content), running the read-only Direct Payment walkthrough that produced the DIRECT-PAYMENT-WALKTHROUGH document, screenshots of the live app for verification, and any Vercel or GitHub UI actions that need clicks. The browser is always "Edge lap" (browser id ba4677c4…). Known gotcha: `screenshot` can time out on the heavy Direct-Business.html because it embeds a base64 logo; the fallback is to run object-count data checks instead.

**Supabase MCP (mcp__2af0a3db-*)** is the direct line to the app's Supabase project. Used for: executing SQL against the businesses / funnels / activities / access_allowlist tables, applying migrations (row-level security policies, unique indexes, check constraints), deploying edge functions (admin-users, save_state RPC guard), reading Supabase logs during debugging, and generating TypeScript types. The project reference is `vkxoeeoauexyfpzqufqd`. Everything runs under RLS across all 18 tables; the admin edge function checks caller identity and refuses non-active admins.

**Vercel** is the deploy surface for the B2B app. GitHub push triggers Vercel auto-deploy within about 30 seconds. Preview deploys are unlimited; promotion to production is a two-click action in Vercel Ahmed does himself. Rollback in about one minute — pick any older green build from Deployments → Promote to Production. Versioned copies of the HTML from v32 through v37 are kept in a Supabase storage bucket called `site` for one-minute rollback via alternative path too.

**GitHub via API** is the code home. The single source of truth for `index.html` is `github.com/abdoulmagd911/direct-b2b`. Every Claude session pulls the file at the start of a task, edits it in place, and pushes it back at the end. GitHub rejects colliding pushes with a "non-fast-forward" error — the second session re-pulls, re-applies its change on top, and retries. The multi-device model does not depend on git being installed on any device (the session uses the GitHub REST API and a Personal Access Token). Tokens live only in a one-time setup PowerShell window on the device, never on disk in the repo.

**WebFetch / WebSearch** are the fallback for enrichment when a dedicated connector is not available or does not return the needed data. Known pattern: on JS-heavy Saudi gov sites plain WebFetch returns the empty page shell; escalate to Chrome MCP with `get_page_text` after `navigate`. Common Saudi API patterns worth trying before declaring a source unreachable: `api.<domain>/vN/*`, `<domain>/api/search`, `<domain>/e-services/vN/*`, `<domain>/public/companies`, and GraphQL at `/graphql`. Also: the Network tab XHR endpoints that a rendered page reveals are where the JSON APIs actually live.

**Excel and CSV dedup pipeline** is a Desktop Commander Python REPL pattern that reads a CSV or XLSX into pandas, normalises name keys (`re.sub(r'\s+',' ', name.strip().lower())`), and runs the dedup by that key. Dedup identifies duplicates but never deletes — the losing row gets `duplicate_of` set to the surviving row_id and all contact slots are aggregated into the survivor. This is the pattern that resolved the 57 name-duplicate cases in v1.89.

**HYPERLINK landmine detection** is a specific Excel-file audit. Direct's earlier database versions carried 12,731 HYPERLINK() formulas across email, phone, and URL fields for click-to-act. Those formulas do not survive export to plain-text formats or import into other systems — they show up as `[object Object]` or the literal HYPERLINK text. The v1.28 landmine fix converted every HYPERLINK() to plain text value, sacrificing in-cell click-to-act (regeneratable by any tool that reads the text) for portability. Rule now: never store HYPERLINK formulas — plain text only.

**Contact-data-consolidation skill** is the permanent workflow-skill that codifies the consolidation methodology: merge messy multi-source contact and company lists into one clean campaign-ready master sheet, split stacked cells (several phones or emails jammed into one cell), normalise phone numbers to E.164, dedupe, and prep for SMS / WhatsApp / email campaigns.

**Direct-brand-voice / direct-proposal-design / direct-agreement-design skills** are in-progress packaging of the tourism build for reuse across future verticals. Each one carries Direct's real visual identity — the actual fonts (Bahij TheSansArabic plus 29LT Zarid Slab plus Proxima Nova Alt), the real vector logo, pixel-sampled hex colours (orange primary #F06820, orange table header #F87020, cover gradient #E54525→#F26721, gold accent #FBAE16, ink body #303848), the six-slide proposal anatomy, the four-document proposal family plus client-type variants, and the finance/IBAN/refund/VAT/CR blocks Direct added on top of the base مدد template.

**gcc-b2b-benchmark-patterns skill** captures patterns extracted from Amex GBT, BCD, CWT, FCM, Almosafer, Seera, dnata, Stripe, Linear, Vercel, and Notion — the industry-best-practice ("whale") shapes for what a corporate travel B2B dashboard or communication should look like. Consulted whenever a new feature is being scoped.

**direct-competitive-complement-mapping skill** is the framework for reading "what they offer / what they don't / how Direct fits as a support partner not a competitor" from any master-database row. It powers the complement-angle field per row and the outreach hooks per lead.

**saudi-market-database-methodology skill** is the whole build methodology: source list, verification tiers, confidence tagging, contact-type classification, service-offering audit, self-test sampling, same-company integrity rules. This is the template that ports unchanged to pharma, MICE, and industrial verticals when phase three starts.

**Explorium enrichment** (paid credits used) added 30 LinkedIn pages and 39 decision-makers on 62 high-value companies (123 credits burned). The enriched CSV is `LEAD-MASTER-ENRICHED-v30.csv`.

**Task list, Task tools** are used across sessions for progress tracking; the pattern is TaskCreate at the start, TaskUpdate to in_progress when starting, TaskUpdate to completed when done. The task list is rendered as a widget in Cowork.

**AskUserQuestion is forbidden** on Direct B2B work — Abdulrahman has full-authority pre-approved every decision that is not money movement or irreversible deletion. Popups are banned.

**Subagents are forbidden** on Direct B2B work. No Agent tool. No Task tool for subagents (spawning tasks from inside a running session). No start_task or start_code_task from inside a task. Two subagent failures in June 2026 (one fabricated output, one opaque hang) burned real credits and Anthropic refused the refund. Rule locked permanently. Every step is done in the running conversation with direct tool calls.

# 17. Insights learned — what worked, what failed, patterns

Two months of shipping and audits produced a set of hard-earned patterns. Every one below is grounded in a real incident.

**The single-file architecture works.** One self-contained HTML file — vanilla JavaScript, no build step, no CDN, opens by double-click, uses localStorage plus JSON export/import as the local editable backend — is the right shape for Direct's B2B app. Everyone on the team can open it anywhere; there is nothing to install; a whole version rollback is one file swap. The app hit 1 MB before the v29 rebuild trimmed it back to 876 KB by collapsing 35 stacked patch layers, 12 render-path wraps, duplicate cards, and double-rendered Sync widgets.

**"Overgrown, not broken" is a real state.** By v28 the dashboard had 35 stacked patch layers on top of each other. Everything worked, but the code was fragile and slow to reason about. The v29 clean rebuild — same data, same features, single render path — was worth it. Pattern: after 30 layered patches, stop and rebuild clean. The v29 rebuild kept every data commitment (119 airlines, 72 leads, 23 providers, all SOPs, the agency profile) and passed all 145 tests.

**Last-writer-wins was silently shrinking the shared data.** In late June the app was pulling the cloud copy once per browser session, then saving its own local copy over it. Multiple browsers open at once meant the last-saver's smaller subset was overwriting other sessions' work. The fix was three-layer: (1) load pulls the cloud whenever the cloud's updated_at is newer than this browser's db_cloud_ts, (2) save refreshes the cloud state first if it has changed since load, (3) a server-side guard in the save_state RPC rejects any payload whose businesses array is more than five smaller than current. That last guard is the safety net — a stale client can never shrink the shared data. Pattern: multi-writer state needs a server-side shrink guard.

**Open signup is a critical data exposure.** For a full week between v32 and v37 the app had public signup enabled. Every new account was automatically given viewer rights — which allowed reading all 998 leads, all contacts, the whole travel-agency list. Someone who guessed the URL could have taken the whole database. The v37 fix removed signup from the app and disabled it on Supabase, and any email not on the access_allowlist lands on a dead-end screen. Pattern: never ship an internal tool with public signup; always start from admin-created accounts and an allowlist.

**Row-driven enrichment beats sector-sweep after 15 batches.** From v1.65 to v1.85 the master DB's email coverage barely moved (19.0% to 19.4%). Reason: batches were searching for major multinational corporates that were not in the DB — about one row per eight searches actually landed a match. The pivot to row-driven (pull entity names directly from Tier 1+2 rows without email, one by one) broke through 20% coverage within a few batches. Rule now: every 5 batches, check net enrichment count; if fewer than 5 rows enriched per batch, pivot from generic sweep to row-driven.

**Saudi government sites are React SPAs. Plain WebFetch returns empty.** Every major Saudi gov portal — Wathq, Maroof, ZATCA, MoT, SFDA, MODON — is a single-page JavaScript app. WebFetch sees the page shell with no content. Chrome MCP with `get_page_text` after `navigate` sees the rendered content. Rule: on Saudi gov sources, escalate to Chrome MCP by default; do not waste calls on plain WebFetch.

**BNPL merchant harvest needs the store URL, not the marketing URL.** Tabby's marketing page returns nothing useful. Their actual merchant directory sits at a different URL structure. Same for Spotii. Same for most Saudi BNPL merchants — the app-only merchants (visible only inside the mobile app) cannot be scraped and got honestly marked unreadable rather than faked. Rule: identify the store/directory URL structure per BNPL before trying to harvest.

**Cloudflare bot protection blocks automated visits to Direct Payment.** Screen-scraping Direct Payment for the money sync was tested and 403'd. Scraping would be fragile and would fight the protection and could get the account flagged. That is why the sync plan is (1) deep links now, (2) scheduled Excel export from Direct Payment feeding an importer, (3) real read-only API access via Direct's dev team as the end state. Rule: never automate screen-scraping against Cloudflare-protected surfaces on Direct's own systems.

**Subagents are permanently banned on this project.** Two subagent failures in June 2026 cost real credits. One fabricated a file it claimed to have written. One hung in a tool call that would not return with no way to observe or kill. Anthropic refused the credit refund on 28 June. Rule locked: every step is done in the running conversation with direct tool calls. Replace "delegate to research agent" with "Read + Grep + WebFetch myself"; replace "delegate to Explore agent" with "use Glob + Grep directly"; replace "spawn subagent to verify" with "verify inline".

**Tool call retry-loops burn credits.** If a tool call errors the same way twice, switch strategy. If a tool call hangs longer than about two minutes, wait a bit longer then either kill the session and start fresh or approach the problem a different way (avoid Q:, try a shorter payload, use bash curl instead of a specialised tool if the network path is fighting). Never retry-loop the same call more than twice.

**Placeholder detection has to be strict.** +966000000000, test@, TBD, N/A, لسه, example.com — all get rejected on save. Placeholders that had accumulated were moved to quality_flags with a salvage prefix in notes, then the field was blanked. Pattern: reject placeholders at the boundary and audit the accumulated set at least once per major version.

**Domain-mismatch flagging beats overwriting.** When email domain and website domain do not match for the same row (24 rows in v1.89), flag with quality_flags = "domain_mismatch" — do NOT overwrite either value. Human review decides which one is right (or if both are wrong).

**Entity-type classification cannot inherit source-file bias.** When rows are imported from a travel-focused CSV, entity_type defaults to travel_agency. That poisons downstream segmentation — a marketing campaign built for TAs then reaches airlines with a TA pitch. Rule: before setting entity_type, run a keyword sweep on the entity name (airlines / airways / cooperative insurance / takaful / ministry of / royal commission); match sets the specific type; source-file bias never drives entity_type.

**Small businesses have Google Business Profiles and Instagram bios more often than they have a website.** The scrape strategy for small KSA travel agencies pivoted to these two sources — plus WhatsApp Business "About" fields — and coverage improved.

**Voice notes drop out of chat and outcomes get lost.** In the WhatsApp corpus, complex changes drop from text into voice; the decision made on call is not logged anywhere; the chat continues with "ابشر / تم" with no record of what was agreed. Rule: log a call outcome — timestamp, participants, decision summary — in the booking or offer detail whenever a call touches the deal, so the audit trail is provable.

**Every recurring re-typed piece of text is a UX opportunity.** Bank details, visa requirements per country, credit-line explainer, preliminary-booking explainer — each of these was re-typed dozens of times per month across the WhatsApp corpus. Turning each into a one-tap Send button on the appropriate screen removed the retype (and the copy-paste-error risk).

# 18. Decisions Abdulrahman locked and the reason behind each

Below is the running list of decisions Abdulrahman has explicitly locked. Each carries the reason so future sessions do not re-litigate.

**Commercial credit pool = 1,250,000 SAR exactly, editable in Settings.** Reason: that is what the commercial team is authorised to extend across all postpaid B2B clients today. Editable so the number can grow when authority grows.

**Billing period = Gregorian calendar month, not Hijri.** Reason: matches how Direct Payment already runs cycle-close, and matches how Direct's finance team reports.

**Over-credit-limit = informational warning, not a hard block.** Reason: sometimes an over-limit booking is legitimate and manager-approved; a hard block would push agents to work around the tool. The audit log captures the override.

**Generated forms ship as both PDF and PPTX.** Reason: PDF for the client's file and the ZATCA hash chain; PPTX for the sales rep to edit and re-personalise before sending. Design language learned from Direct's existing files.

**Manus and Lovable colleague dashboards → absorb as view presets.** Reason: rebuild-nothing rule — the value in those dashboards is captured as view presets inside Direct Business, their URLs stay visible in Sync & Integrations under "Legacy" so nothing is lost. The Sahara Sales Hub decision is still open (absorb / mirror / replicate / replace / catalog).

**Bilingual brand naming per language.** English view shows only "Direct Business". Arabic view shows only "دايركت أعمال". Same colour, font, bold weight. Never mixed inline. Reason: the phone renders mixed Arabic-English broken; and the brand is cleaner when each language stands alone.

**URL per section.** Every section gets its own address. Refresh keeps the user where they were (Airlines refresh stays on Airlines; a lead detail refresh stays on the lead). Browser back/forward works. Reason: deep-linkable state is the whole point of a web app.

**Page-size selector.** Every table has a 10 / 20 / 50 / 100 / All dropdown, default 20, choice remembered per browser. Reason: agents work at different scales and page size is a per-agent preference, not a global setting.

**No signup — accounts are admin-created only.** Reason: this is an internal tool for about five to fifteen employees; there is no legitimate reason for the public to reach it. The open-signup hole that briefly existed exposed all 998 leads.

**Access allowlist decides auto-role on account creation.** business@directksa.com and aboelmagd@directksa.com pre-seeded as Admin, osharafi as Manager, a.hassan as Team Member. Anyone not on the list lands on "Access not active yet". Reason: prevents ghost-accounts inheriting edit power by accident.

**Break-glass admin path stays open.** Any email in access_allowlist becomes Admin the moment its account is created in the Supabase dashboard. Reason: even if every other account is broken, Direct's owner still owns the Supabase project and can recreate an admin in three clicks.

**Rely on Direct Payment for everything money.** Do not rebuild pricing, invoicing, tax invoices, credit, expenses, refunds, settlement, or GMV. Reason: Direct Payment already runs at scale; duplicating any of that just creates divergence. The app reads a tidy summary; Direct Payment stays the boss.

**Direct integration is three phases.** Deep links now, scheduled Excel export next (Direct Payment can already export), real API access via the Direct dev team as the end-state. Reason: Cloudflare protection blocks any automated screen-scraping, but a file is a file and an API is an API — both are clean paths.

**Roles = Admin, Manager, Team Member, Viewer.** Reason: this is the smallest set that separates the boss key from operational edit power and gives new joiners a safe read-only starting point. Splitting Team Member into BD vs Ops is available if he asks; he has not asked.

**Only Admins can delete.** Team Members edit but do not delete. Reason: prevents a junior from accidentally erasing a client.

**Only Admins can rename or restructure funnels.** Reason: funnels are a shared taxonomy — one person renaming Inbound as "New" would break every filter and report.

**Refund-as-wallet-credit is the default.** Refunds due on already-paid bookings go into the client's Direct wallet by default, not cash back. The client can opt for cash back to the original payment method. Reason: keeps the money in-relationship, gives the client immediate use of the credit for their next booking, and avoids the bank-transfer round-trip.

**The "3-month hold then refund" is not a rule.** It was an example scenario Ahmed once described. Do not model a refund-hold rule anywhere. Reason: locked in the operating rulebook after earlier confusion caused a design pass to try to model a rule that did not exist.

**Direct's identity fields are canonical.** Legal name Al-Masafer Al-Mubashar for Travel & Tourism (شركة المسافر المباشر للسفر و السياحة); IATA number 7123828; Amadeus offices RUHS2234B and WSMSMTBS; DCS PLUS integration; PCI-DSS; bank guarantee 750,000 SAR; TECHTIC subsidiary; 600+ airline agreements; more than 10 years old; World Travel Award ×3; Great Place to Work ×3; address Saif Plaza, Al-Hada, Riyadh 12321. Still needed from Abdulrahman: exact CR and VAT numbers (he enters IBAN himself), plus J4 Badr and RQ Kam Air accounting codes.

**No subagents on Direct B2B work.** Locked permanently. Reason: two failures, refused refund, established pattern of opaque hangs.

**No manual asks, no paid signups.** Reason: 7 July 2026 message from Abdulrahman drew a firm line — every ask that assumes he is at a specific PC or asks him to sign up for a paid service is a small betrayal of the assistant-does-the-work premise.

**Keep the PC on.** No shut down, sleep, restart unprompted. If explicitly asked, confirm twice. Reason: standing preference set 31 May 2026 after an earlier period of "shut down when done" was superseded.

**Blanket always-allow on every permission.** Folders, apps, MCPs, connectors, browser sessions, computer-use grants — all pre-approved forever. Reason: locked and re-reinforced multiple times through May and June 2026.

**Explain in plain language.** No jargon, no acronyms, no long file paths in the body of a message. Reason: Abdulrahman is operations/sales/BD, not a coder.

**Locked-down PC: never ask him to run terminal commands or install anything.** Reason: company IT restrictions on his work laptop.

**Reply language default: English throughout (do not mix Arabic and English inline).** Note: the direct-b2b-master rulebook says "Reply in Arabic only" — that rule was written earlier when he was iterating in Arabic; the current pattern per user-identity memory and every other rule file is English. This one is flagged in the Open Questions section for a one-line answer to settle it for good.

# 19. The tech stack — one paragraph per component with role and status

**Direct Payment (payments.directksa.com)** — Direct's own back-office system, built by Direct's dev team. The source of truth for all money, invoices, tax invoices (ZATCA), credit and wallet, expenses, refunds, proformas, payment receipts, settlements, pricing, and GMV. Runs at scale (500K+ invoices, 14M+ SAR monthly volume). Sits behind Cloudflare bot protection. Status: live, read-only from every other layer's perspective. No changes made or planned by this project.

**Amadeus** — the primary GDS. Actual booking and ticket issuance happens on the Amadeus terminal via Selling Platform Connect; tickets settle through BSP monthly. Integrated with Direct via DCS PLUS / IRIX rather than directly to the flights back-end. Status: live in production; the B2B app reflects PNRs and coupon states from Amadeus but never creates them.

**Sabre** — secondary GDS. Same pattern as Amadeus. Status: live; smaller volume.

**Travelfusion / Duffel / Babylon / Trip.com / Kiwi** — the five online aggregators modelled alongside Amadeus. Actions execute in each aggregator's portal; the B2B app reflects the resulting bookings via labelled "Book (Travelfusion)" style buttons. Status: modelled in the app data schema; live sync will follow real credentials.

**RateHawk** — top hotel provider. Deposit-based model. Status: live.

**Hotelbeds** — hotel supplier connector via the plugin marketplace. Status: connector installed, live for lookups.

**TBO** — deposit-based hotel wallet provider. Status: live.

**IATA BSP** — settlement channel for airline tickets, runs monthly through Amadeus. Status: live.

**MyFatoorah** — payment gateway (Apple Pay Mada, one-off payment links, refund policy clauses). Status: live inside Direct Payment.

**Tamara** — BNPL payment method at checkout. Status: live.

**Tabby** — BNPL payment method at checkout. Also a directory target for the BNPL/Fintech merchant funnel. Status: live.

**SiFi** — virtual card issuer (my.sifi.app). Direct migrated to SiFi from Moola in January–February 2026. Each employee/department gets a SiFi card; monthly Excel export of transactions feeds Direct's Expense system. Status: live and primary.

**Moola** — legacy virtual card issuer. Direct migrated fully off Moola. Status: retired, referenced only in historical expenses.

**Nqoodlet** — one of the alternative card platforms evaluated during the Moola-to-SiFi migration (alongside Cashew and Alan Pay and Neoleap). Status: not primary.

**Supabase** — cloud database and auth for the B2B app. Project reference vkxoeeoauexyfpzqufqd. Runs Postgres with row-level security on all 18 tables, an admin edge function (admin-users) that refuses non-active-admin callers, a save_state RPC with server-side shrink guard, versioned index.html snapshots in a `site` storage bucket (v32 through v37), automated backups (proven restorable — 978 leads read back successfully on the 25 July snapshot), and Brevo SMTP as the mail transport (pending Abdulrahman pasting the Brevo SMTP key into Supabase settings). Status: live; two owner actions still outstanding (paste the SMTP key; add directksab2b.com to redirect URLs).

**Vercel** — deploy platform for the B2B app. Watches the GitHub repo and auto-deploys within about 30 seconds of every push. Both directksab2b.com and direct-business.vercel.app resolve to the same deployment. Rollback is a two-click promotion of any older green build. Status: live.

**GitHub** — code home. Repository `github.com/abdoulmagd911/direct-b2b`. Single source of truth for the app's `index.html`. Every session pulls at the start, edits, and pushes at the end. Collision handling is native. Status: live; a clean pipeline setup HTML page is staged in `_release-setup/` waiting for Abdulrahman to run the one-time SETUP.html to lock in the GitHub Personal Access Token and the Vercel token.

**Brevo (Sendinblue)** — SMTP transport for password-reset emails and any outbound app mail. Configured in the B2B app's Team → Email sending screen; needs the Brevo SMTP key pasted into Supabase → Settings → Auth → SMTP. Until that lands, nothing in the app depends on email — Abdulrahman hands out passwords himself. Status: connector installed, one owner action outstanding.

**Chrome browser (Edge lap)** — the browser the assistant drives via Chrome MCP for every browser-facing task on this project. Session id ba4677c4… . Used for: reading Saudi government portals that plain fetches cannot see, running the read-only Direct Payment walkthrough, taking live screenshots for verification, and any UI-only actions in Vercel or GitHub. Status: live and always the correct browser.

**Cowork** — the desktop app the assistant runs inside for the Direct B2B project on Abdulrahman's PC. Uses Q:\Downloads\Claude as the primary working folder plus C:\Users\abdelrahman hasan\AppData\Roaming\Claude for the app state. Mirror-copied hourly to Q:\Downloads\Claude\Cowork_Data via the scheduled task CoworkBackupToQ, with scripts for migrating a new PC to Q as the live store via a directory junction (_USE_Q_AS_COWORK_DATA.bat), on-demand sync (_SYNC_NOW.bat), and re-install of the hourly task (_INSTALL_AUTO_SYNC.bat). Status: live and mirrored.

**Claude Code** — the separate Claude session Abdulrahman uses for app-code consolidation work. The mega brief you are reading was written to serve as a self-contained context handoff to that session. Status: active; the funnel-details conversation Abdulrahman referenced in Dispatch may live there, not here.

**Desktop Commander MCP** — file operations tool used inside Cowork sessions for all Q: filesystem work and any binary or Excel processing. Status: connected.

**Chrome MCP (claude-in-chrome)** — browser control MCP for the Edge lap browser. Status: connected.

**Supabase MCP** — database and edge-function tool. Status: connected.

**PDF Viewer MCP** — for annotating and filling PDFs interactively. Status: connected.

**Connectors installed and pre-approved (never re-request)** — Canva, Google Drive, Gmail, Google Calendar, HubSpot, DocuSign, QuickBooks, Stripe, Square, PayPal, Brevo, Hotelbeds, Pitch, N8N, Lovable plus Supabase, Pendo, Amplitude, Klaviyo, Ahrefs, Similarweb, Figma, Intercom, Fireflies, Apollo, ZoomInfo, Clay, Close, Outreach, ClickUp, Linear, Notion, Slack, Asana, Atlassian, Monday, MS365. All installed; some (Apollo, ClickUp, Notion, Linear, Monday, Slack, etc.) require re-authentication per session — Abdulrahman authorises via claude.ai connector settings.

**Explorium** — enrichment tool used for the 62 high-value companies pass (123 credits burned, 30 LinkedIn pages + 39 decision-makers added). Status: used, not routinely called.

**WhatsApp Business** — the primary client-facing channel for Direct's B2B business. Every client conversation is a WhatsApp thread. Exports live in Q:\Downloads\Claude\WhatsApp-Chats\ (39 consolidated chats scanned). Not integrated into the B2B app directly — the app logs the conversation as activities and share links, and Direct's team sends from their own WhatsApp Business apps.

**Q: network drive** — the shared working drive that both of Abdulrahman's PCs see. All project files live under Q:\Downloads\Claude. This is the drive that everything on this project reads from and writes to.

# 20. Standing rules of engagement

The full rule set governing every session on Direct B2B work. Organised as communication, work approach, technical constraints, and safety.

**Communication.** Plain-language business talk — no code jargon, no acronyms without expansion, no long file paths in the body of a message. Numbers and outcomes are fine; mechanisms are not. Use his vocabulary — workflow, follow-up, client, credit limit, outstanding, quotation, agent. Every substantive update, reply, and approval request appears in both Dispatch and the underlying project chat, because he follows both. When he needs to copy a long draft on his phone, put the verbatim text in a project chat where long-press works cleanly; Dispatch on mobile does not select cleanly for long messages. Post a plain-language status paragraph in the project chat roughly every 20 turns on long-running work. When making mistakes, own them, fix them, do not collapse into self-abasement. Do not ask him questions during the work — full authority granted. Only escalate a hard blocker.

**Work approach.** Pick the better option and act. Never ask him to sign up for a paid service or authenticate a connector. Never ask him to do anything manual — no "please click", "please upload", "please paste", "please double-click". If a connector fails, try the raw web endpoint the connector wraps, try Chrome MCP with JS rendering (most Saudi gov sites are SPAs that plain fetches see as empty), try the network-tab XHR endpoints a rendered page reveals, try common Saudi API patterns (api.<domain>/vN/*, <domain>/api/search, <domain>/e-services/vN/*, <domain>/public/companies, /graphql). Only after exhausting free options flag a paid option, and only as a silent research note, never as a required next step.

On data: never delete an existing value — the standing rule is "no delete, reuse first" (salvage into another slot, or move into a notes column, before ever blanking anything). No guessing — every new value needs two or more sources, or it gets marked verified_missing. Same-company integrity: email domain equals website domain; if not, flag domain_mismatch and do not overwrite. Placeholder detection is strict (reject +966000000000, test@, TBD, N/A, لسه, example.com). E.164 phone format. HTTPS website with no trailing slash. Five attempts max per row before verified_missing. Every action documented (verification_source, field_provenance, field_confidence, quality_flags).

When work stalls on a single stuck item, skip it, finish the rest of the job, and report what was skipped — do not retry-loop. If a tool call errors the same way twice, switch strategy. If a call hangs, wait; then approach the work a different way (avoid Q:, try a shorter payload, use bash curl instead of a specialised tool). Never retry-loop.

**Technical constraints.** Subagents are permanently banned on Direct B2B work — no Agent tool, no Task tool for subagents, no start_task or start_code_task inside a running task. Every step is done in the running conversation with direct tool calls. Intermediate working files go to the Linux sandbox, not to the Q drive (Q is slow and there is a big backup mirror job running against it). Reading from Q is fine; heavy writing during work is not. Every folder, app, MCP, connector, computer-use grant is pre-approved forever — do not pause to ask permission to request permission. When a tool exposes a model choice, pick the newest option (currently claude-opus-4-8, or the one-million-context variant when the job needs it).

Direct Payment is read-only. No create, no edit, no refund, no charge, no void, no submit, no save inside Direct Payment. Observing forms is fine; never click Save, Publish, Start-Submission-confirm, or Cancel there.

Never write to Gmail or Google Drive — those are read-only. If Abdulrahman asks for something to be shared to Google Drive, offer to prepare it and let him upload it via his own browser — do not attempt to write.

Files under Q:\Downloads\Claude\Apps and websites\ follow one rule: only the top three MASTER_DB files stay visible (latest FINAL, last stable, v1.0_FINAL frozen reference). All others move to _archive/. This is not deletion — it is tidying.

**Safety.** Never shut down, sleep, hibernate, restart, or otherwise power off the PC unprompted — after a task finishes, as a cleanup gesture, to save power, or as a suggested next step. If he explicitly issues a shutdown command, confirm twice first (he may have asked by reflex). Money movement, trade execution, and deletion of irreplaceable data always require explicit per-action confirmation regardless of blanket approval.

**The 20-turn status update rule.** Every long-running Direct B2B task posts a plain-language status paragraph in the project chat every 20 turns or so — what was done, what is next, blocker if any. He reads this on his phone and follows both chats.

**The reading protocol at the start of any Direct B2B session.** Read the MASTER_BRIEF first (this file). Then the relevant SKILL.md (direct-business-rules, contact-data-consolidation, direct-brand-voice, or vertical-specific if one exists). Then MEMORY.md. Do not stop after receiving instructions unless Dispatch says "stop". Uncertain? Pick the safest option (least destructive, most reversible) and act.

# 21. Ideas and unfinished threads

**Facebook reels and posts parked for later revisiting.** Five reel links and one post captured across 31 May through 2 June 2026. He wants the principles from those reels turned into rules; video content is not machine-readable, so they wait on him for a summary. No fixed reminder time set.

**Sahara Sales Hub decision.** sahara-sales-hub.lovable.app — a colleague's Arabic-first CRM-style deals-pipeline on Lovable backed by Google Sheets. Flagged 2 June for a decision: absorb, mirror, replicate, replace, or catalog. Not decisive answer recorded yet.

**Extended scenario sweep queued.** Airtight testing of every service type — reissue chains (flight, hotel, transfer, visa), refund flavours (full, partial, no-show, void, hotel-cancel, visa-fee), ancillaries (seat, meal, baggage, lounge, fast-track, wheelchair, cross-service upgrades), and propagation checks across airline / provider / invoice / client / lead / Today / audit / reconciliation. Written up. Awaiting execution.

**Post-booking workflow and client payment model design pass.** Captured but not yet built. Pieces to fold in: prepaid vs postpaid client payment types; credit limits and current utilisation; billing cycle and terms; per-booking lifecycle tracking (booked → reissued → refunded → fully-used with ancillaries per passenger); the refund-vs-credit-line interaction (real incident: 3-month-held booking's refund hit a monthly-billed credit line and caused confusion); on-demand reports per invoice, per client, per booking across every service.

**The eight critical WhatsApp scenarios** pulled from the RUH office group: pre-quote VAT breakdown expander, "send bank details" one-tap, visa-by-nationality lookup, codeshare-risk badge, passport-validity gate, per-passenger sub-invoice splitting, buyer-fields auto-fill on the invoice, dunning ladder template.

**Real PDF and PowerPoint template parsing.** The app currently uses curated tokens; real templates would render Direct's exact house style automatically. Queued.

**Current-user-name Settings field.** Kills a hardcoded "Abdelrahman" in the greeting text. Small, on the list.

**Real automatic sync into Direct Payment / GDS / aggregators.** The biggest unbuilt piece. Needs credentials from Direct's side — either an Excel-export schedule (Tier 1) or an API token (Tier 2). Deep links (Tier 0) already work.

**The remaining ~17 report generators** from the reports blueprint — Service-Fee proposals, project quotes, per-client performance report, per-project closeout, per-vendor performance report, monthly Business Department deck, quarterly retro, annual report, reconciliation report by source, expense-per-project roll-up, plus the Arabic-render template parity for statements.

**Priority-batch import.** Handover notes flag "import the priority batch" as pending Abdulrahman's nod. Live-app updates show a lot has landed since — needs a one-line confirmation whether the priority batch is included or still queued.

**Tier 3 stubs reclassification.** 3,574 MoT-only rows with 90% phone but 1% email/website — the structural ceiling. Needs paid enrichment or Chrome MCP-driven scrapes of JS-heavy sites; the row-driven pivot is chipping at these one batch at a time.

**24 domain mismatches** flagged during v1.89 self-audit still need manual verification. Each needs a "is the email or the website the real one?" call. Not blocking anything, but worth clearing.

**Organic project.** Parked cleanly under Q:\Downloads\Claude\Organic — landing_page.html, attara_opportunity_map_v3/v4.html, feasibility_summary.md. Abdulrahman asked about it on 5 June but did not follow up; focus stayed on Direct B2B. Nothing lost.

**Longer-arc backlog.** Chosen cloud-backup destination (Google Drive versus something else); the move to a personal PC once cloud backup is sorted; real automatic sync into Direct Payment / GDS / aggregators; the external board title with the promised LinkedIn descriptions.

# 22. Where things live

The live B2B app: directksab2b.com and direct-business.vercel.app, version 37, shipped 25 July 2026.

The corporate marketing website: working assumption directksa.com — Abdulrahman to confirm the actual URL and lead-form design.

Direct Payment: payments.directksa.com/en/admin (read-only).

The code home: GitHub repository github.com/abdoulmagd911/direct-b2b, single-source-of-truth index.html inside plus vercel.json, README.md, MULTI_DEVICE.md, .gitignore, backup.ps1.

The database and auth: Supabase project reference vkxoeeoauexyfpzqufqd.

The Direct B2B working folder: Q:\Downloads\Claude\Apps and websites\ — hosts the four visible MASTER_DB files (v1.0_FINAL, v1.32_TIER3, v1.39_FINAL, v1.98_FINAL each with __Master.csv, __READ_ME, and __UNIDENTIFIED_CONTACTS.csv siblings), the tablet layout HTML (Direct-Business-App-Tablet-*.html), all lead-import staging CSVs, WHATSAPP-RUH-*.csv, BNPL-MERCHANTS-STAGING.csv, SERVICE-INTEGRATION-PARTNERS-STAGING.csv, MOT-LICENCES-RAW.csv, SAUDI-TRAVEL-TRADE-DATABASE__*.csv, PROJECT-CONTEXT.md, RESUME-HERE-v30.md, TOMORROW-CHECKLIST.md, HANDOVER-GITHUB-VERCEL-DRIVE.md, landmine_report.md, and the direct-b2b-repo/, direct-b2b-master/, direct-brand-kit/, direct-business-rules/, brand-assets/, screenshots/, v26-3-preview/, _archive/, _backups/, _brandkit_incoming/, _db_backups/, _extracts/, _release-setup/ subfolders.

The direct-b2b-master subfolder: MASTER_RULEBOOK.md, HANDOVER_v1.98.md, MASTER_DB_v1.98_FINAL.md/.txt/__Master.csv, self_audit_v189.md, SOURCES_v1.98.csv, directksa-b2b-master.SKILL.md, ALL_AVAILABLE_SKILLS.md, AUDIT_REPORTS_ALL.md, tier1_pending.csv, LEADS-STAGING-v30.json.

The direct-b2b-repo subfolder: README.md, MULTI_DEVICE.md, vercel.json, .gitignore, backup.ps1, index.html — the staged pipeline.

The direct-brand-kit and brand-assets subfolders: Direct's real brand kit — fonts (Bahij TheSansArabic + 29LT Zarid Slab + Proxima Nova Alt), the real vector logo (direct_logo_white.png, direct_logo_slate.png, direct_logo_vector.svg — 3100×1328 hi-res), pixel-sampled hex colours in assets/colors.json, references/company-facts.md (Direct's factual identity), references/brand-system.md (the type + colour + layout system), and Direct-Brand-Kit.skill (the packaged brand skill).

The side-notes parking lot: Q:\Downloads\Claude\Notes\SIDE-NOTES.md — Abdulrahman's persistent notes file. Anything he drops that starts with "note:", "park:", "for later:", "remind me:", "idea:" gets appended here with a timestamp.

The Cowork data mirror: Q:\Downloads\Claude\Cowork_Data\ — full mirror of the local Cowork app data, refreshed hourly by the CoworkBackupToQ scheduled task, with _AUTO_SYNC.bat, _SYNC_NOW.bat, _USE_Q_AS_COWORK_DATA.bat, _INSTALL_AUTO_SYNC.bat, _README.txt, and _cowork_backup.log alongside. Every project, chat, memory, and skill lives inside.

The Claude backup for sidebar sessions and projects: Q:\Downloads\Claude\Claude-Backup\ with RESTORE-ON-THIS-PC.bat inside.

Direct's logo: Q:\Downloads\Claude\Direct Travel Logo\ and Q:\Downloads\Claude\LOGO HD.png and Q:\Downloads\Claude\Logo Direct 726 x 114-01.png.

Direct's strategy and organisation PDFs: Q:\Downloads\Claude\direct_strategy_2024_2026v2.pdf (Arabic) and direct_strategy_2024_2026v2english.pdf (English) and direct_organization_structure.pdf. Also 2024_achievements2.pdf and 2025_achievements2 (1).pdf.

Team appraisals: Q:\Downloads\Claude\Appraisal\ and Q:\Annual+Appraisal+Commercial (Professional) -Business (2).xlsx.

WhatsApp chat exports: Q:\Downloads\Claude\WhatsApp-Chats\ — 39 consolidated chats, with _INDEX.md and WORKFLOW-PATTERNS.md providing the read map.

The Academy folder: Q:\Downloads\Claude\Academy\Academy\ with MASTER-ARCHITECTURE-BLUEPRINT.md (a separate academy blueprint).

The Aviation folder: Q:\Downloads\Claude\Aviation\ (aviation-specific reference material).

The OPS folder: Q:\Downloads\Claude\OPS\ with events_report.md and dedup2.md and جدول_المواسم_وحجز_القاعات.md (seasons and venue-booking table).

The Organic folder: Q:\Downloads\Claude\Organic\ with README.md, INSTRUCTIONS_FOR_NEXT_CLAUDE.md, feasibility_summary.md, and the landing-page and opportunity-map files.

The Code folder: Q:\Downloads\Claude\Code\ for miscellaneous code.

The Habit tracker, Vote, VPN Rotator, WTA folders: personal or misc, not Direct B2B.

Persistent memory index (the primary standing rules and project facts): the agent memory folder at Q:\Downloads\Claude\Cowork_Data\local-agent-mode-sessions\<session>\agent\memory\ — MEMORY.md indexes and about 20 related .md notes on user identity, standing rules, and project context.

CLAUDE-PROJECT-NOTES.md at Q:\Downloads\Claude\CLAUDE-PROJECT-NOTES.md — the "read this first if you are Claude on a new computer" onboarding note.

The original v1 brief: Q:\Downloads\Claude\DIRECT_MASTER_BRIEF.md — the shorter earlier consolidation this v2 supersedes. Preserved, not deleted.

# 23. Timeline highlights

**Late May 2026** — Direct B2B project starts inside Cowork. The plain-language rule, the always-allow permissions rule, the keep-PC-on rule, the mirror-updates-in-both-chats rule, and the side-notes parking lot were all set on 18–31 May. The dashboard's informative-plus-synced architecture was locked on 31 May with Ahmed's line "all actions will be actually done on direct payment or gds or aggregator etc.... so the details on the dashboard will be informative and synced with direct website." The colleague dashboards on Manus (executive and finance) and Lovable (commercial objectives) were catalogued. Direct Payment read-only walkthrough produced the DIRECT-PAYMENT-WALKTHROUGH document — 508K invoices, 15 corporate clients, 14M+ SAR monthly volume. WORKFLOW-FOR-LIVE playbook written (v22) covering Phase A onboarding through Phase H post-trip. SCENARIOS-FROM-CHATS-v25 discovery pulled 70 friction patterns from 39 WhatsApp chats (8 critical, 28 high-leverage).

**Early June 2026** — Chain-of-command rule added after the junior-employee-threatens-contract incident on 1 June. Commercial credit pool of 1,250,000 SAR named on 2 June (colleague built the reports/finance/B2B views on Lovable and Manus; role-based views inside the dashboard specified). v25 plan answers locked on 2 June: pool cap 1,250,000 SAR exactly; Gregorian month; over-limit informational warning; all forms as both PDF and PPTX; absorb Manus and Lovable as view presets. PROJECT-CONTEXT.md written 2 June for fresh agents joining the project chat. Two big standing rules added: always explain in plain language; fresh agents on project chat need to read PROJECT-CONTEXT first. Direct-BD-Platform-Blueprint and BD-Operations-Module-Blueprint written. Roles matrix (four roles) proposed 23 June.

**Mid-late June 2026** — Full audit on 10 June exposed the "overgrown not broken" pattern (35 stacked patch layers, 12 render-path wraps, 1 MB file). v29 clean rebuild dropped the file to 876 KB while preserving all data (119 airlines, 72 leads, 23 providers, all SOPs, agency profile) — 145 tests still green. Reports tab built (14 objectives, 25 KPIs, 12 initiatives). Roles and permissions shipped end-to-end. Bilingual naming rule locked. URL-per-section and page-size selectors added. WhatsApp mining — 53 shared contact cards → 73 airline sales contacts across 27 airlines. TAs full re-scan found 1,315 new items. BNPL scrape captured ~185 merchants (19 travel). Service Integration Partners research captured 39 partners.

**24–25 June 2026** — First big import: 917 records landed cleanly (753 new companies + 72 airline contacts + 94 WhatsApp participants), zero flagged for confirmation. Al-Nasr Aviation correctly identified as Al-Nasr Travel Jeddah. The 119-carrier airline seed in place.

**28 June 2026** — Cowork data mirror to Q established (hourly robocopy /MIR, plus scripts to migrate a new PC to Q as the live store via a directory junction). Anthropic refused the credit refund for the earlier subagent failures. Subagents banned permanently on this project.

**1 July 2026** — Import went live. Sync bug found and fixed — the app had been pulling the cloud copy only once per browser session and then overwriting it with local state (last-writer-wins), which was silently shrinking the shared data. Server-side guard added to save_state RPC to reject any payload that would shrink the businesses array by more than five rows. Live app_state landed on 1,012 businesses and 136 airlines. A leftover public staging table security exposure was closed. Backups verified restorable.

**6 July 2026** — Second PC connected to Q:\Downloads\Claude and verified in sync. All project files confirmed present. Claude-Backup folder holds a full app backup from the other PC (from 5 July); RESTORE-ON-THIS-PC.bat lets Abdulrahman restore sessions/projects on either PC.

**9–12 July 2026** — Expansion vision documented (tourism → pharma → MICE → industrial). Master database iterated through v1.85 → v1.98. Coverage broke past 20% on email and website via the row-driven pivot. Self-audit surfaced 442 issues across seven landmine classes (misclassifications, language swaps, field swaps, name duplicates, empty rows, domain mismatches). Every lesson codified into MASTER_RULEBOOK Section L. The no-manual-asks and no-paid-signups rule was added on 10 July with Abdulrahman's line "من فضلك متألنيش اعمل حاجة مانيوال او تفترض انى اقدر اعملها او تقترح اعمل حاس مدفوع لاى خدمة او تقول ان ال connectors مش شغالة من غير ما تجربها". HANDOVER_v1.98 written.

**25 July 2026** — v37 shipped. Eight real security and data-integrity problems fixed in one night: the open-signup hole that had let anyone on the internet read all 998 leads (most serious); dead password-reset links pointing at localhost; delete-not-sticking on the new per-lead save; lost-last-edit on quick tab close (save was waiting 1.5s, now 0.9s + force-save on tab-hidden); duplicate-insert on retry (unique index on legacy_id); admin self-lockout; funnels writable by anyone; unprotected backup table. All 18 tables verified with RLS + policies. Backup verified restorable (978 leads read back from snapshot). Admin edge function verified refusing non-active-admin callers. Two owner actions left: paste the Brevo SMTP key into Supabase (so password-reset emails send); add https://directksab2b.com/** to Supabase redirect URLs.

**Landing v33 leads restructure** (also 25 July) — leads moved from one-big-blob save to per-lead saves against the Supabase businesses table (single source of truth, 998 leads). Funnels table with 4 configurable funnels + per-funnel field templates (EN/AR). Stages unified: new/contacted/in_discussion/proposal/won/lost/on_hold. Stage change → auto-logged. Stage=won → auto is_client=true + converted_date. v33 UI layer added funnel tabs with counts, needs-attention filter, hover preview per funnel, CSV export, funnel-details card + edit modal in lead detail.

**8 August 2026 (today)** — A clean GitHub + Vercel + backup pipeline staged in the direct-b2b-repo folder with the one-time SETUP.html page ready for the owner. Nothing new is unshipped — local copies match the live app byte-for-byte (SHA 975AC0E0…, 1,097,928 bytes, v37 shipped 25 July). The v1 master brief written earlier today, then this v2 mega brief written after Abdulrahman asked for a comprehensive consolidation of every existing .md.

# 24. Open questions

Confirm the leads funnel stages and stage-change triggers — Abdulrahman wants to explain more. This brief has reconstructed the funnel from Cowork/Dispatch history, but the definitive picture (auto-move rules, time-based aging, per-funnel SLAs, full per-funnel field templates) is likely richer in the Claude Code session.

Confirm the corporate website URL and where in the leads funnel a website-onboarded lead lands. Working assumption is directksa.com for the marketing site; sync direction website → master database → B2B app. But the default funnel, default stage, default owner, and the exact field mapping between the corporate form and the master schema all need to be locked.

Is Cowork's live data now running from Q via the junction, or still on the C drive with an hourly copy to Q? The migration script exists (_USE_Q_AS_COWORK_DATA.bat) and the mirror is in place. Memory refers to Q:\Cowork_Data while the actual mirror sits at Q:\Downloads\Claude\Cowork_Data — a one-line answer settles the path and the state.

Was the GitHub + Vercel + backup pipeline setup completed, or is the one-time SETUP.html page still waiting to be run? If waiting, is there a reason to pause it or should the next session assume it needs to happen first?

Have the two owner actions from the 25 July landmine pass been completed — the Brevo SMTP key pasted into Supabase, and directksab2b.com/** added to Supabase's redirect URL list? Both gate password-reset emails on the custom domain.

Has the Manus and Lovable absorption actually happened to your satisfaction, or is the Sahara Sales Hub still a decision waiting to be made? You asked for a call between absorb / mirror / replicate / replace / catalog and I do not see a decisive answer recorded.

Is the priority-batch import into the live app complete, or is that still gated on the "import the priority batch" trigger phrase? Handover notes mention it as pending; live-app updates suggest a lot has landed, but not confirmed that the priority batch specifically was among them.

Which vertical is next after tourism — pharma, MICE, or industrial — and is anything already in motion there, or is that strictly future work?

Which reply language should any new session default to? The master rulebook in the direct-b2b-master subfolder says "reply in Arabic only, never mix Arabic and English inline". The user-identity memory and every other rule file assumes English (the phone renders mixed Arabic-English badly). These two rules disagree — a one-line answer would settle it for good.

Are the four cross-cutting items on the backlog — a chosen cloud-backup destination (Google Drive versus something else), the move to a personal PC, real automatic sync into Direct Payment / GDS / aggregators, and the external board title with the promised LinkedIn descriptions — still live, and if so in what order?

Should the extended scenario sweep (every service type — reissue chains, refund flavours, ancillaries) run now, or wait for the next feature push?

Which of the ~17 unbuilt report generators (Service-Fee proposals, project quotes, per-client performance, project closeout, per-vendor performance, monthly BD deck, quarterly retro, annual, reconciliation, expense-per-project, Arabic-render statements, etc.) are highest-priority next?

# 25. Source files consolidated into this brief

Every substantive document under Q:\Downloads\Claude that shaped this brief is listed below with a one-line purpose. Originals are preserved on disk — nothing is deleted.

**Top-level orientation and standing rules**

CLAUDE-PROJECT-NOTES.md — "read this first if you are Claude on a new computer" onboarding, including the 6 July PC-sync status, the 25 July v37 landmine pass, the locked-down-PC rule, and the DirectKSA BD Platform summary.

DIRECT_MASTER_BRIEF.md — the v1 shorter consolidation this v2 supersedes.

Q:\Downloads\Claude\Notes\SIDE-NOTES.md — Abdulrahman's persistent parking-lot notes with FB reels, colleague-dashboard flags, strategic shifts, and the 3 June → 24 June catch-up sweep of standing rules, versions shipped, and locked decisions.

**Agent memory files** (Cowork_Data\local-agent-mode-sessions\...\agent\memory\)

MEMORY.md — the index of all persistent notes.

user_identity_abdulrahman.md — he is Abdulrahman, not Ahmed; team members; secondary email; the company Al-Masafer Al-Mubashar for Travel & Tourism.

project_direct_b2b_master_brief.md — the standing "one-page brief" of all rules ever given for directksab2b.com.

project_direct_expansion_vision.md — the tourism-then-pharma-then-MICE-then-industrial strategy from 9 July.

project_direct_dashboard_architecture.md — the informative-and-synced-not-a-system-of-record rule, plus commercial-credit-pool details and role-based-view expectations.

project_b2b_chain_of_command.md — the incident and the resulting required fields on every B2B client.

project_side_notes_file.md — how the SIDE-NOTES.md parking lot works.

project_cowork_data_on_q_drive.md — the hourly mirror setup, the migration script, and the caveats.

feedback_proactive_status.md — always surface blockers proactively.

feedback_blanket_access_approval.md — blanket "always allow" for access prompts, extended and re-reinforced.

feedback_keep_pc_on.md — never shut down, sleep, or restart unprompted.

feedback_mirror_updates_both_chats.md — every substantive update goes in both Dispatch and the project chat.

feedback_no_manual_asks_or_paid_signup_suggestions.md — the 10 July line drawn on manual asks and paid-service suggestions.

feedback_no_subagents_for_direct_b2b.md — subagents permanently banned after the two June failures.

feedback_plain_language.md — explain in plain business language, no jargon.

feedback_proactive_context_management.md — scope tasks narrowly, read targeted, summarise and move on.

feedback_send_copyable_text_to_task_chat.md — long copyable drafts go to a project chat for phone-friendly paste.

feedback_ultrathink_on_complexity.md — take extra reasoning steps on complex problems.

feedback_always_latest_model.md — always pick the newest model in any tool choice.

reminder_fb_reel_2026_05_31.md — the pending FB-reel reminder awaiting time-of-day.

**Direct B2B working folder core** (Q:\Downloads\Claude\Apps and websites\)

PROJECT-CONTEXT.md — fresh-agent onboarding for the Direct B2B project (2 June update); the product in one paragraph, v26.2 tab list, architecture rule, Ahmed's locked answers, files on disk, standing rules, what's queued.

RESUME-HERE-v30.md — deep quality pass checkpoint from 25 June; the done research/verification phases, the not-yet-done build/import phases, and the 25 June + 1 July live-app updates.

TOMORROW-CHECKLIST.md — night-of-25-July hand-off for the morning after v37 shipped; the 9 step-by-step checks for the owner, plus a pointer to landmine_report.md.

HANDOVER-GITHUB-VERCEL-DRIVE.md — 8 August handover for the clean GitHub + Vercel + backup pipeline; what is already true, the owner's one-time job, what happens from then on, the multi-device rule, Google Drive detail, and what was not done and why.

landmine_report.md — the plain-language postmortem of the eight problems found and fixed on the night of 25 July, plus what was tested, what's OK, the two owner actions still needed, known-but-safe future items, break-glass instructions, and rollback path.

**direct-b2b-master subfolder**

MASTER_RULEBOOK.md — the "read at start of every task" operating rulebook: identity, absolute prohibitions, 10 data-quality rules, source priority, multi-email discovery, entity types and tiers, file management, reporting cadence, functional scoring, self-discipline, anti-patterns from real 3-day failures, and lessons learned from v1.89.

HANDOVER_v1.98.md — the state-transfer document for v1.98: project identity, current state metrics, 7-phase timeline of the 64 tasks, sources used, current file state in Q:, what's left, key rules that must be followed, escalation path, related linked projects, first action for the next session.

self_audit_v189.md — the v1.89 self-audit findings across 7 landmine classes (442 issues).

directksa-b2b-master.SKILL.md — the packaged skill for the master DB build methodology.

AUDIT_REPORTS_ALL.md — consolidated audit reports.

ALL_AVAILABLE_SKILLS.md — inventory of all available skills.

**direct-b2b-repo subfolder** (the staged GitHub pipeline)

README.md — what the repo is, what's inside, how deploys work, the one rule for multi-device work, rollback in one command.

MULTI_DEVICE.md — the pull-edit-push loop; why the repo is the boss; the three ways to edit; what happens if two sessions touch it simultaneously; what NEVER to do.

**direct-brand-kit subfolder**

references/company-facts.md — Direct's canonical company facts (legal name, founding, HQ, team, web, app, sector, value proposition, service pillars, awards, service-fee model, segments, tone).

references/brand-system.md — the brand system (colours with hex, typography, logo, signature layout elements, do/don't).

README.md — the brand kit landing.

**direct-business-rules subfolder**

SKILL.md — the operating rules (dos and don'ts) for building anything on Direct Business: files and delivery, build style, the Direct Payments boundary, brand, security and privacy, communication and process, known facts not to re-litigate, verification and tooling gotchas, quick reference to current state.

**brand-assets subfolder**

README.md — asset landing.

logo-mark-colors-crosscheck.md — logo/mark colour crosscheck.

**_archive subfolder** (versioned deep documents — every one preserved, not deleted)

WORKFLOW-FOR-LIVE.md — the operational playbook Phase A onboarding through Phase H post-trip, plus the v23 reissue/refund/ancillary chapter by service type; cross-cutting reflection map; cheat-sheet keyboard commands; Settings developer controls; when things go wrong; what still needs action outside the dashboard; Day 1 checklist.

REPORTS-BLUEPRINT-v25.md — the exhaustive inventory of every report/proposal/service-fee deliverable in Direct's Q: library (1,585 files cataloged) mapped to a generation path inside the dashboard, per bucket: Service-Fee Proposals, Client Proposals/Quotes/Tenders, Statements of Account, Sales/Income Reports (monthly + quarterly), Expense Reports/Reconciliation, Project Closeout Reports, plus additional buckets.

CHAIN-OF-COMMAND-PLAYBOOK.md — the incident, when to capture chain info, how to use the authority matrix during a friction conversation, re-confirm cadence, the Direct-side chain, how the dashboard surfaces it, what we don't do, and the one-page summary.

CLOSED-CYCLE-UNDERSTANDING.md — the closed-cycle understanding of Direct Payment's request → booking → transaction → invoice → payment → settlement → tax invoice → expense → refund loop.

DIRECT-PAYMENT-WALKTHROUGH.md — the read-only walkthrough of Direct Payment: top-level nav map, terminology glossary, invoice flow, the receipt→invoice→tax-invoice cycle, the Corporate Clients sub-system, expenses ledger, refund requests, and terminology to mirror in v21.

DIRECT-SYNC-PLAN.md — the 23 June sync plan: goal, what we're syncing (kept deliberately small), how we match a client, three tiers of connection (deep links / scheduled export / real API), why NOT screen-scraping, recommended path, what's needed from you to proceed.

ARCHITECTURE-FOR-LIVE.md — architecture for live use.

DIRECT-INTEGRATION-MODEL-v30.md — the three-phase rollout: one-click deep links now, scheduled file export next, real API access as end-state.

DIRECT-PAYMENT-WALKTHROUGH.md — as above.

BULLETPROOFING-v21/v22/v23/v24/v29.md — the incremental hardening per version; workflow-test-results, scenario coverage, edge-case sweeps.

BENCHMARK-LANDMINES-v15/v16/v17/v18/v20.md — the running record of benchmark landmines caught across versions.

LEAD-VERIFICATION-FRAMEWORK-v30.md — the ✅ Verified / ⚠️ Partial / ❓ Unverified / ❌ Dead status framework and the Saudi sources used (Wathq, ZATCA, Maroof, MoT, Chambers).

LEADS-CLIENTS-POSTMORTEM-v30.md — confirmed the app already does the most important thing right (single record, no duplicates); 8 display improvements queued to match Salesforce / HubSpot / Pipedrive / Attio / Folk / Sahara.

LANDMINE-IMPORT-INTEGRITY-v30.md — the import-integrity landmine review.

LANDMINE-POSTMORTEM-v30-IMPORT.md — the postmortem of the import events.

LANDMINE-LEADS-postmortem.md — postmortem of the leads landmines.

LANDMINE-v29.6.md — the v29.6 landmine batch.

ROLES-MATRIX-v30.md — the full permission matrix and special powers list; the one-page plain-language version plus the machine-readable matrix.

REPORTS-HISTORY-AUDIT-2024-2025.md — audit of the 55 monthly/quarterly reports in the library.

SAHARA-LEARNINGS-v26-3.md — what to learn from sahara-sales-hub.lovable.app.

SCENARIO-RESULTS-v23.md — results of the v23 scenario sweep.

SCENARIOS-FROM-CHATS-v25.md — 70 friction scenarios mined from 39 WhatsApp chats (8 critical, 28 high-leverage) covering pre-confirmation Q&A loops, mid-trip friction, post-trip and billing friction, authority/contract escalation, vendor coordination, internal handoff drops, document/PDF template friction, language/translation friction, and repeated explanations.

V25-PLAN.md — the v25 plan and locked answers.

V25-RELEASE-NOTES.md — the v25 release notes.

V26-3-LANDING-PATTERN-NOTES.md — v26.3 landing page pattern.

V26-SIMPLIFICATION-NOTES.md — what the plain-language pass did.

UX-QA-CLICKTHROUGH-v26-2.md — page-by-page walk plus bugs caught.

UX-QA-FINDINGS-v24.md and UX-QA-FIXES-v24.md and UX-QA-VERIFY-v25.md — UX QA sweeps per version.

UX-SIMPLIFY-blueprint-v26-3.md and UX-SECTION-LANDING-blueprint-v26-3.md — UX simplification and section-landing blueprints.

VERB-AUDIT-v21.md — verb audit for consistency.

FULL-AUDIT-2026-06-10.md — the 10 June full audit that diagnosed the "overgrown not broken" pattern.

WORKFLOW-TEST-RESULTS-v22.md and SCENARIO-RESULTS-v23.md — test-results per version.

DATA-SOURCES-v21.md — the master Excel sheets reconciled against.

BD-Leads-from-Invoices.md — extracting BD leads from historical invoices.

BD-Operations-Module-Blueprint.md — the operations module blueprint.

Direct-BD-Platform-Blueprint.md — the BD platform blueprint.

Direct-Business-Brand.md — the brand for Direct Business.

PROJECT-ADVISORY-v30.md — the advisory rewritten around the three pillars.

PROJECT-ENHANCEMENTS-v30.md — enhancements sorted Critical / High-leverage / Worth doing / Defer. Top three picks: self-sending quotes plus one-tap accept; real email/WhatsApp reminders; phone polish plus client-list import.

QA-BUGLIST-v30.md — the QA bug list.

GO-LIVE-STATUS-v27/v28/v29.md — go-live status per version.

GO-LIVE-PLAN-plain.md — the plain-language go-live plan.

GO-LIVE — 1. SETUP (do this first).md and GO-LIVE — 2. MASTER PROMPT.md — the setup and master prompts for the go-live moment.

WORKLIST-v29.6.md — the worklist at v29.6.

MOT-LICENCE-MATCH-SUMMARY.md — the MoT licence match summary.

WHATSAPP-RUH-MINING-SUMMARY.md — the mining summary for the RUH WhatsApp group.

BNPL-MERCHANTS-SUMMARY.md — the BNPL merchant summary.

SERVICE-INTEGRATION-PARTNERS-SUMMARY.md — the service integration partners summary.

LEAD-MASTER-CORRECTIONS-SUMMARY.md and LEAD-MASTER-ENRICHED-SUMMARY.md and LEAD-MASTER-SUMMARY.md — the lead master summaries.

LEAD-IMPORT-PASS2-SUMMARY.md and LEAD-IMPORT-PASS3-SUMMARY.md — the import-pass summaries.

LEAD-SOURCES-AUDIT-v30.md — the lead-sources audit.

AIRLINES-CASE-MINING-v26-4/-5/-6/-7/-8/-9.md — the airlines case-mining sweeps.

SIMPLIFICATION-v19.md — the simplification pass at v19.

BULLETPROOF-POSTMORTEM-v30.md — the bulletproof postmortem.

master_sheet_preview_v2 through v46.md — the running per-version data previews of the master sheet.

TourPro_Focused_File_Index.md and TourPro_Operations_SOP.md — tour-pro reference material.

handoff_prompt.md and V21-CONTINUATION-PROMPT.md — handoff and continuation prompts.

**WhatsApp-Chats subfolder**

_INDEX.md — index of all 39 consolidated chats.

WORKFLOW-PATTERNS.md — the single-pass keyword-with-context scan output covering: client payment patterns (prepaid vs postpaid, credit, limits, triggers, proof, settled vs unsettled), finance-team communication (channels, approvers, thresholds, response times, disputes), invoice + tax-invoice flow (portal, old-B2C vs new-B2B model, one rollup over many bookings, regular vs tax invoice and ZATCA, VAT mechanics, payment-gateway vendors), booking lifecycle messaging, refund ↔ credit-line interactions, expense tracking (BSP via Amadeus, virtual cards, proof, expense→transaction linkage), decisions, exceptions, recurring escalations, roles and names.

**Organic subfolder**

README.md, INSTRUCTIONS_FOR_NEXT_CLAUDE.md, feasibility_summary.md — parked side-project.

**OPS subfolder**

events_report.md, dedup2.md, جدول_المواسم_وحجز_القاعات.md — operations events, dedup pass, seasons-and-venue-booking table.

**Academy subfolder**

MASTER-ARCHITECTURE-BLUEPRINT.md — the Academy master architecture blueprint (separate project).

---

End of brief. Total sections: 25. Written 8 August 2026 as a comprehensive reference for Abdulrahman and any fresh Claude session (Dispatch, Cowork, or Claude Code) picking up work on Direct Travel KSA's B2B initiative.
