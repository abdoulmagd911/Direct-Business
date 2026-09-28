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
