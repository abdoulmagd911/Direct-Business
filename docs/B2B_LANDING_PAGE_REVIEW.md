# B2B landing page review + real-client logo plan

**Date:** 2026-08-12 · **Page reviewed:** https://b2b.devdksa.com (AR + EN) — the landing
page for the new corporate/business-travel platform (separate from this repo's app).
**Deliverable for the product team:** `Direct_B2B_Landing_Client_Logos_Priority.xlsx` in the
Drive business-reports folder (`1CM_-xzFSNEQKokX6K016nMJoTGNmwpzz`), also sent in chat.

## The one-line verdict

The page itself is strong — clean, properly bilingual, well structured. The problem is that
most of its "proof" (client logos, people photos, testimonials) is invented, and two of those
things are visibly fake to anyone who looks closely.

## Findings, in priority order

1. **Floating logo strip — 8 of 9 logos are companies Direct has never invoiced.**
   The strip shows Aramco, SABIC, stc, NEOM, Saudia, Almarai, Riyad Bank, Tamimi Markets,
   and Ma'aden (files live at `/partners/*.svg`). Checked against the verified H1-2026 B2B
   audit: only **Ma'aden is a real client** (126,589 SAR paid). The rest are exactly the
   media/legal risk Abdulrahman suspected — implied endorsements by companies with no
   relationship. Replacement list: 21 real names in the spreadsheet, led by Takamol
   (10.86M SAR, government-owned), Riyadh Chamber, Ma'aden, First Mills, MDD, Maaal,
   Al-Qahtani & Sons, Kaplan + 8 more education partners.

2. **Persona photos still carry the stock-agency watermark.** The "Built for everyone"
   section images (`/company/*.webp` — decision-maker, HR, finance…) are unlicensed comp
   images with the "ArabsStock"-style watermark baked in, visible on the live page in both
   languages. This is more embarrassing than the logos because anyone can see it without
   research. Buy the licences or swap the photos before launch.

3. **Testimonials look invented.** Named people ("Mohammed Al-Mansour", "Fatima Al-Haddad",
   etc.) with stock faces and job titles. If a journalist checks one name, the whole page
   loses credibility. Real quotes from Takamol / Riyadh Chamber / MDD contacts would be
   easy to get and far stronger — or drop the faces and keep anonymous role-based quotes.

4. **Trust numbers may not survive a fact-check.** "500+ enterprise clients, 1M+ trips,
   93% satisfaction". The verified H1 audit shows ~13 paying B2B customers and 13.0M SAR.
   If these numbers describe the whole Direct group (B2C included), label them that way;
   otherwise align them with defensible figures before media see them.

5. **Small technical wins.** No Open Graph / social-preview tags at all (links shared on
   WhatsApp/X will show bare text); the Arabic page reuses the English `<title>` and meta
   description. Both are quick fixes for the product team.

**What is genuinely good:** real RTL Arabic (better than our internal app), consistent
orange brand, sensible section flow (problem → platform → services → personas → numbers →
FAQ → CTA), working language toggle, clean responsive layout.

## The logo replacement plan (summary — full detail in the spreadsheet)

| Priority | Name | Proof (H1 2026, paid) |
|---|---|---|
| 1 | Ma'aden معادن | 126,589 SAR — keep, it's already on the page |
| 2 | Takamol for Business Services تكامل | 10,861,135 SAR — biggest client, gov-owned |
| 3 | Riyadh Chamber الغرفة التجارية بالرياض | 136,996 SAR |
| 4* | Directorate of Public Security | 78,000 SAR — needs written approval first |
| 5* | Special Forces for Security & Protection | 27,600 SAR — same |
| 6 | First Mills المطاحن الأولى | 978 SAR — listed company, one invoice counts |
| 7 | MDD Smart IT مدد | 857,810 SAR |
| 8 | Maaal صحيفة مال | 67,600 SAR |
| 9 | Al-Qahtani & Sons (Sinopec JV) | 30,518 SAR + 30.8K unfinished draft |
| 10–18 | Kaplan, EC, Kings, Bayswater, CES, ETC, Malvern, NCG, Sheffield | 342,281 SAR commissions |

Rule applied throughout: **every logo needs the client's written consent** before it goes on
a public page — one email per client, and the government bodies (4–5) are text-only in
private sales material until approved.

## Sources

- `Q1Q2_2026_B2B_Audit.xlsx` (Drive business-reports folder) — verified fully-paid B2B
  invoices, Jan–Jun 2026, net of wallet top-ups; total 13,039,328 SAR.
- Per-customer Direct Payments exports `5466`–`5507` (Drive `Q2_raw` folder).
- Live page assets fetched 2026-08-12 (`/partners/*.svg`, `/company/*.webp`).
