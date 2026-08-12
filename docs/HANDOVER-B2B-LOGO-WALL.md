# HANDOVER BRIEF — B2B landing page review & real-client logo wall

**Date:** 12 Aug 2026 · **Session:** Claude Code (repo `abdoulmagd911/Direct-Business`, branch `claude/landing-page-review-9kuqf9`)
**For:** the next Claude session continuing this work. Read `CLAUDE.md` in the repo first — the standing rules there apply (Abdulrahman is not a developer; no jargon; do the work; one clear next step).

---

## 1 · The task, in one paragraph

Direct is about to launch a new corporate business-travel platform. Its landing page is at
**https://b2b.devdksa.com/ar** (Arabic) and **/en** (English) — a separate product built by
the product/dev team, NOT in this repo. The page has a floating logo strip of AI-picked
Saudi giants (Aramco, SABIC, stc, NEOM, Saudia, Almarai, Riyad Bank, Tamimi + Ma'aden).
Abdulrahman asked: check which of those are real, and build a replacement list of companies
that **actually work with Direct**, ordered by **weight in the Saudi market/culture** (not by
spend), with **working website + HD logo links**, simple enough to hand straight to the
product team. Deliverable = an artifact in Direct's brand identity.

## 2 · The finished deliverable (keep updating THIS, don't create new ones)

**Artifact:** https://claude.ai/code/artifact/d77adddd-053e-4235-8318-6084dfd8d673
Title "Direct B2B Logo Wall", favicon 🧡. Current version = "simple-verified-list":
one table, 33 companies, columns: # / Company / الشركة / Website / Logo (direct link).
Direct identity (orange #F06820 family, brand voice "Global supplier power. Saudi service.
One partner."). Source file lives in this session's scratchpad as `logo-wall.html`; from a
NEW session, update it by passing `url:` with the artifact URL above to the Artifact tool.

**Evolution (why it looks the way it does):** v1 was a spreadsheet + long analysis page;
Abdulrahman explicitly rejected the complexity — he wants ONLY the simple list. Do not
re-add invoices, amounts, advice sections, or consent templates to the artifact. Keep it
one table. The single caveat kept on the page: `*` on the two government security bodies
(logo needs written approval) and a footnote that some Saudi sites geo-block foreign
visitors.

## 3 · The final ranking (33 companies, by Saudi market/culture weight)

Corporate: 1 Riyadh Air طيران الرياض · 2 Ma'aden · 3 Directorate of Public Security* ·
4 Special Forces for Security & Protection* · 5 Takamol for Business Services ·
6 Riyadh Chamber · 7 First Mills · 8 Abdel Hadi Al-Qahtani & Sons · 9 Maaal ·
10 Amadeus (Saudi Arabia) · 11 CJ Logistics (SILZ) · 12 Kaplan International ·
13 MDD Smart IT · 14 National Electronic Systems · 15 Al-Nahla Educational Consultancy ·
16 Benchmark for Conferences · 17 Al-Rajhi Alawla Exhibitions · 18 Kayan ·
19 Aljandal FC · 20 Pro Display · 21 The Ultimates (Al-Jarboa) · 22 Preventive Means Safety.
Travel partners: 23 Booking & Tickets Agency حجز وتذكرة · 24 Sidra Travel · 25 Mirage Tours.
Education partners: 26 EC English · 27 Kings · 28 Bayswater · 29 CES · 30 ETC International
College · 31 Malvern International · 32 New College Group · 33 Sheffield Academy (Malaysia).

Proof per company (paid SAR, invoice numbers, contacts) is NOT on the artifact by request,
but it's all in section 5's sources and in `docs/B2B_LANDING_PAGE_REVIEW.md` in this repo.
Key facts if asked: Takamol ≈13.2M SAR lifetime (biggest); MDD 857K paid H1; Al-Nahla
599K invoiced Jul; Ma'aden 126K paid + active monthly account; Riyadh Chamber 137K;
NES 119K; Al-Qahtani ≈114K; Amadeus 69K (2025 invoice); Riyadh Air & CJ Logistics are
onboarded registry clients (Jul/Aug 2026) with no audited spend yet.

## 4 · Verified logo links (all opened & checked 12 Aug 2026)

Direct SVG/PNG files that work:
- Riyadh Air EN: `https://commons.wikimedia.org/wiki/Special:FilePath/Riyadh_Air_Logo.svg`
- Riyadh Air AR: `.../Special:FilePath/Riyadh_Air_Logo_(AR).svg`
- Ma'aden: `.../Special:FilePath/Ma%27aden.svg`
- MOI (ref only, approval-gated): `.../Special:FilePath/Ministry_of_Interior_Logo.svg`
- Amadeus: `.../Special:FilePath/Amadeus_(CRS)_Logo.svg`
- CJ group: `.../Special:FilePath/CJ_logo.svg`
- Riyadh Chamber JPG: `.../Special:FilePath/غرفة_الرياض.jpg` (URL-encoded on the page)
- Takamol official: `https://api.takamolholding.com/uploads/takamol_logo_047255c86f.svg`
- Kaplan official: `https://www.kaplaninternational.com/themes/custom/kaplan_theme/logo.svg`
- Kings official: `https://www.kingseducation.com/assets/images/KingsLogo_WhitePink.svg`
- Bayswater official: `https://d2zqc3k48kil1s.cloudfront.net/_nuxt/logo-white.CKvap-Ue.png`
- Benchmark 2500px: wixstatic URL (on the artifact)
- Pro Display: `https://prodisplay.sa/Contant/Website/images/logo.png`
- Everything else: `https://unavatar.io/<domain>` (verified 200/image for: mdd.sa,
  nes.com.sa, aqsse.com, chamber.sa, saaraj.sa, kayan.org.sa, sidratravel.com,
  miragetourseg.com, ecenglish.com, etc-inter.net, ces-schools.com,
  malverninternational.com, newcollegegroup.com, cjlogistics.com, maaal.com [favicon only])
  and `https://unavatar.io/twitter/FirstMills_sa` + `/twitter/riyadhair`.
  unavatar rate-limits (429) — retry after ~6s.
- No public logo found (rows say "artwork from client"): Al-Nahla, Aljandal FC,
  The Ultimates, Preventive Means Safety, Booking & Tickets, Sheffield Academy.

Landing-page assets (for the cleanup step): logos at `/partners/*.svg` on b2b.devdksa.com;
watermarked persona photos at `/company/*.webp`.

## 5 · Data sources on Google Drive (file IDs — use `read_file_content` / `download_file_content`)

- **Q1Q2_2026_B2B_Audit.xlsx** `1M1dLHUwQbRiY5LOrhzNnNp91aBTOi9sV` — THE verified paid
  ledger, Jan–Jun 2026, 13,039,328 SAR total, summary + 178-row detail + methodology.
- **Q1_2026_B2B_Audit_v2.xlsx** `1YKh4k79x9I4LYUbuancQAlWq70xZVlI1` — Q1 only; its
  Methodology notes are where **Amadeus** (69,462 SAR, 2025) appears.
- **Corporate client registry** (new platform, incl. test rows to ignore):
  `1W6B_9x-ra16NRE3Ruo7Ha3cJXVtChev0` (9 Aug) and `1M7Il919WM35rudOBoPRH5qR4VKcyhfcS`
  (12 Aug) — compared row-by-row, identical real clients. This is where Riyadh Air
  (as "Khadamat AlTayaran", trading name طيران الرياض) and CJ Logistics live.
- **corporate-dashboard-invoices** `1UmYUfxknuilMIMsNmPjmWTo4LoIJLBMr` (12 Aug) — clean
  per-client invoice ledger of the new platform Jul–Aug (3.28M SAR issued 1 Jul–12 Aug).
- **Per-customer exports 5466–5507** in folder `1F24YUsinyAAz9ntvNaSgJbTfd-8W3P20` — all
  18 read; individuals (5467, 5468, 5486, 5490) are NOT companies.
- **Traps to not repeat:** the two 1.5MB "invoices" exports (`14vSyCA…`, `19kXG9…`) are
  credit notes only; the two 47.9MB full invoice exports (`1LiERys…`, `1CLLMvY…`) and
  04-invoice-export.xlsx (11MB) exceed the Drive tool's 10MB download limit — if their
  content is ever needed, ask Abdulrahman to upload them in chat instead; the "B2B"
  Google Sheet (`1gjwjhSwh2…`) is a per-traveller group-trips log, no companies.

## 6 · Environment gotchas discovered this session

- **Headless browser + proxy:** plain Playwright gets ERR_CONNECTION_RESET. Working recipe
  in scratchpad `shot2.mjs`: route every request through Node undici `ProxyAgent`
  (`process.env.HTTPS_PROXY`) and fulfill via `route.fulfill` — NODE_EXTRA_CA_CERTS is
  already set. Chrome error pages title themselves with the domain — don't trust title
  checks, look at the screenshot.
- **Geo-blocks:** chamber.sa, firstmills.com, nes.com.sa, maaal.com, riyadhair.com,
  aqsse.com, miragetourseg.com refuse this sandbox's traffic but are fine from KSA.
  logo.clearbit.com is blocked by the sandbox proxy entirely (502).
- **Oversized tool results** get saved to `…/tool-results/*.txt` as JSON
  `{fileContent|content: string}` — parse locally with python, don't re-read into context.

## 7 · State of the repo / PR

Branch `claude/landing-page-review-9kuqf9`, draft **PR #16** (docs only):
`docs/B2B_LANDING_PAGE_REVIEW.md` (full findings incl. amounts) + BACKLOG.md entry 13.
NOTE: that doc predates the July–Aug corrections in section 3 — if touching it, update
Al-Nahla (~599K, not "skip"), NES (119K), Al-Qahtani (114K), Benchmark (85K), Aljandal
(36K), and add Amadeus. Vercel auto-deploys pushes to the PRODUCTION branch only
(`claude/new-session-9fhlp1`) — this branch is safe.

## 8 · What is genuinely open (in order)

1. **Consent emails** — every logo needs the client's written OK before it goes public.
   Contacts are in the registry exports; EN/AR one-liner template is in the chat history
   and in `docs/B2B_LANDING_PAGE_REVIEW.md`. Government bodies (Public Security, Special
   Forces) need formal approval, not an email — until then text-only in private decks.
2. **Product team executes**: delete the 8 fake SVGs in `/partners/` (keep maaden.svg),
   drop in the new artwork, keep the muted single-tone strip treatment.
3. **Missing artwork** for the 6 "artwork from client" rows — request via account owners.
4. **Al-Nahla mystery** — quiet name, 599K SAR invoiced in July, placeholder email in the
   registry. Confirm the entity + public brand with the account owner (Saif) before its
   logo ships.
5. **Landing page side-issues** (product team already told, don't re-litigate): watermarked
   ArabsStock persona photos, invented testimonials, "500+ enterprise clients" claim,
   missing OG tags, English <title> on the Arabic page.
6. If Abdulrahman uploads the 47.9MB invoice export in chat: reconcile July–Aug payment
   status (currently "invoiced", not "paid") and check for any pre-2026 companies beyond
   Amadeus.

## 9 · How to talk to Abdulrahman (learned this session, on top of CLAUDE.md)

Simple beats complete: he rejected a rich analysis page for a plain ranked table. Cultural
weight beats revenue in ordering. "Even one invoice counts." Links must be tested, not
plausible — he checks them. If a tool limit blocks something (file too big, site blocked),
say so out loud immediately; silence reads as "Drive was down and you didn't tell me."
