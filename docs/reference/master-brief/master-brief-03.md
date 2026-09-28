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

