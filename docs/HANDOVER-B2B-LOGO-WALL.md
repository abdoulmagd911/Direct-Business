# HANDOVER BRIEF — B2B landing page review & real-client logo wall

**Date:** 12 Aug 2026 (updated 13 Aug) · **Session:** Claude Code (repo `abdoulmagd911/Direct-Business`, branch `claude/landing-page-review-9kuqf9`)
**For:** the next Claude session continuing this work. Read `CLAUDE.md` in the repo first — the standing rules there apply (Abdulrahman is not a developer; no jargon; do the work; one clear next step).

> **Scrubbed 2026-09-02 (rule 7).** The earlier version of this file carried the ranked list of
> real client companies, their paid amounts, invoice facts, account-owner names and per-company
> logo sources. Real company/client data never goes into this public repo, so that content was
> removed here and lives only in the artifact and the Drive files named below. What remains is
> the task, where the deliverable is, and the reusable lessons.

---

## 1 · The task, in one paragraph

Direct is about to launch a new corporate business-travel platform. Its landing page is at
**https://b2b.devdksa.com/ar** (Arabic) and **/en** (English) — a separate product built by
the product/dev team, NOT in this repo. The page has a floating logo strip of AI-picked
Saudi giants. Abdulrahman asked: check which of those are real, and build a replacement list of
companies that **actually work with Direct**, ordered by **weight in the Saudi market/culture**
(not by spend), with **working website + HD logo links**, simple enough to hand straight to the
product team. Deliverable = an artifact in Direct's brand identity.

## 2 · The finished deliverable (keep updating THIS, don't create new ones)

**Artifact:** https://claude.ai/code/artifact/d77adddd-053e-4235-8318-6084dfd8d673
Title "Direct B2B Logo Wall", favicon 🧡. Current version = "simple-verified-list":
one table, 33 companies, columns: # / Company / الشركة / Website / Logo (direct link).
Direct identity (orange #F06820 family, brand voice "Global supplier power. Saudi service.
One partner."). From a NEW session, update it by passing `url:` with the artifact URL above
to the Artifact tool.

**Evolution (why it looks the way it does):** v1 was a spreadsheet + long analysis page;
Abdulrahman explicitly rejected the complexity — he wants ONLY the simple list. Do not
re-add invoices, amounts, advice sections, or consent templates to the artifact. Keep it
one table. The single caveat kept on the page: `*` on the two government security bodies
(logo needs written approval) and a footnote that some Saudi sites geo-block foreign
visitors.

## 3 · The ranking and the proof

The ranked list (33 companies by Saudi market/culture weight, corporate → travel partners →
education partners) is on the artifact. The proof per company (paid SAR, invoice numbers,
contacts) is in the Drive sources below — deliberately not in this repo.

## 4 · Data sources on Google Drive (file IDs — use `read_file_content` / `download_file_content`)

- **Q1Q2_2026_B2B_Audit.xlsx** `1M1dLHUwQbRiY5LOrhzNnNp91aBTOi9sV` — THE verified paid
  ledger, Jan–Jun 2026, summary + 178-row detail + methodology.
- **Q1_2026_B2B_Audit_v2.xlsx** `1YKh4k79x9I4LYUbuancQAlWq70xZVlI1` — Q1 only.
- **Corporate client registry** (new platform, incl. test rows to ignore):
  `1W6B_9x-ra16NRE3Ruo7Ha3cJXVtChev0` (9 Aug) and `1M7Il919WM35rudOBoPRH5qR4VKcyhfcS`
  (12 Aug) — compared row-by-row, identical real clients.
- **corporate-dashboard-invoices** `1UmYUfxknuilMIMsNmPjmWTo4LoIJLBMr` (12 Aug) — clean
  per-client invoice ledger of the new platform Jul–Aug.
- **Per-customer exports 5466–5507** in folder `1F24YUsinyAAz9ntvNaSgJbTfd-8W3P20` — all
  18 read; four of them are individuals, NOT companies.
- **Traps to not repeat:** the two 1.5MB "invoices" exports (`14vSyCA…`, `19kXG9…`) are
  credit notes only; the two 47.9MB full invoice exports (`1LiERys…`, `1CLLMvY…`) and
  04-invoice-export.xlsx (11MB) exceed the Drive tool's 10MB download limit — if their
  content is ever needed, ask Abdulrahman to upload them in chat instead; the "B2B"
  Google Sheet (`1gjwjhSwh2…`) is a per-traveller group-trips log, no companies.

## 5 · Environment gotchas discovered this session

- **Headless browser + proxy:** plain Playwright gets ERR_CONNECTION_RESET. Working recipe:
  route every request through Node undici `ProxyAgent` (`process.env.HTTPS_PROXY`) and
  fulfill via `route.fulfill` — NODE_EXTRA_CA_CERTS is already set. Chrome error pages title
  themselves with the domain — don't trust title checks, look at the screenshot.
- **Geo-blocks:** several Saudi corporate sites refuse this sandbox's traffic but are fine
  from KSA. logo.clearbit.com is blocked by the sandbox proxy entirely (502).
- **Oversized tool results** get saved to `…/tool-results/*.txt` as JSON
  `{fileContent|content: string}` — parse locally with python, don't re-read into context.

## 6 · Logo verification lessons (13 Aug pass — every link downloaded, hashed, rendered)

1. **unavatar.io serves a blank placeholder** (1,506 bytes, 400x400, md5 `3db1ae56a2…`) for
   domains it cannot resolve — links looked "200 OK" but delivered a blank avatar. **Always
   hash-compare against that placeholder before trusting an unavatar link.**
2. **Blind site scraping picks up the wrong brand** — a site's only logo file can be its
   hosting provider's, a homepage can serve its *clients'* logos. Always render and look
   before shipping.
3. **Wikimedia `Special:FilePath` rate-limits hard (429).** Use the direct CDN path instead —
   `https://upload.wikimedia.org/wikipedia/commons/<m[0]>/<m[:2]>/<filename>` where
   `m = md5(filename_with_underscores)`. Computed locally, no API call, far more reliable.
4. The corporate client page reports exactly **43 registered clients** (all on one page,
   matching the xlsx export — nothing was missed). The company list is complete; only
   artwork for the companies with no public logo is outstanding (request via account owners).
5. One registry entry is an orphan-care association, not a commercial company; one agency is
   marked **Suspended** in the registry and was removed from the wall.

## 7 · State of the repo / PR

Branch `claude/landing-page-review-9kuqf9`, draft **PR #16** (docs only):
`docs/B2B_LANDING_PAGE_REVIEW.md` (findings; amounts scrubbed 2026-09-02) + BACKLOG.md entry 13.
Vercel auto-deploys pushes to the PRODUCTION branch only (`claude/new-session-9fhlp1`) —
this branch is safe.

## 8 · What is genuinely open (in order)

1. **Consent emails** — every logo needs the client's written OK before it goes public.
   Contacts are in the registry exports on Drive. Government bodies need formal approval,
   not an email — until then text-only in private decks.
2. **Product team executes**: delete the fake SVGs in `/partners/` (keep the one real
   client's), drop in the new artwork, keep the muted single-tone strip treatment.
3. **Missing artwork** for the rows marked "artwork from client" — request via account owners.
4. **One quiet client with a large July invoice and a placeholder e-mail in the registry** —
   confirm the entity + public brand with its account owner before its logo ships.
5. **Landing page side-issues** (product team already told, don't re-litigate): watermarked
   stock persona photos, invented testimonials, "500+ enterprise clients" claim, missing OG
   tags, English <title> on the Arabic page.
6. If Abdulrahman uploads the 47.9MB invoice export in chat: reconcile July–Aug payment
   status (currently "invoiced", not "paid") and check for any pre-2026 companies.

## 9 · How to talk to Abdulrahman (learned this session, on top of CLAUDE.md)

Simple beats complete: he rejected a rich analysis page for a plain ranked table. Cultural
weight beats revenue in ordering. "Even one invoice counts." Links must be tested, not
plausible — he checks them. If a tool limit blocks something (file too big, site blocked),
say so out loud immediately; silence reads as "Drive was down and you didn't tell me."

## 10 · Adversarial test pass (13 Aug, pre-launch)

Deliverables were attacked rather than re-read; the defects found were fixed on the artifact
(details were per-company and are not kept here).
