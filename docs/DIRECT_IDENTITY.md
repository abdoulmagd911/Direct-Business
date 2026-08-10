# Direct — Identity & Design System (single source of truth)

> Built 2026-08-10 from a full Google Drive sweep (official 2026 company profile, the real
> logo kit, real proposals/offers) reconciled against the live app and the `direct-brand`
> skill. This is the durable place to store Direct's identity so every design and every app
> module is built on the same foundation. Read this before designing anything Direct-branded.

---

## 1 · What Direct is (in one paragraph)

**Direct for Travel & Tourism — دايركت للسفر والسياحة.** A Saudi company (founded **2016**, HQ
**Riyadh**) offering **integrated travel solutions** — flights, hotels, visas, study abroad,
ground services and **corporate travel management** — through **one unified digital platform**
with **a dedicated travel advisor for every client**. It serves government, corporate, agency
and tender clients. A licensed **technology subsidiary (Technic Business Telecommunications
Co., "BTS")** extends Direct beyond travel into SaaS, technical solutions and business
consulting (org structures, HR, training). The promise: **one accountable partner** — global
supplier power, Saudi service.

---

## 2 · Brand tokens (apply to every output)

### Colors — reconciled and confirmed
The app (`index.html`, 97×), the `direct-brand` skill, and the profile all agree on the same
primary orange. The older `#F47A1F` mismatch is **fixed** (gone from the app). `#fc8004` is the
**Direct Payments** admin theme (a different system's UI), **not** the company brand — don't use
it for Direct-branded design.

| Token | Hex | Use |
|---|---|---|
| **Primary — Direct orange** | `#F06820` | brand, buttons, active nav, key accents |
| Service-table header | `#F87020` | orange header row of the fee table |
| Cover/closing gradient | `#E54525 → #F26721` | profile/proposal cover + closing |
| Gold | `#FBAE16` | awards, highlights |
| Logo-mark orange | `#FF6C00` | small icons / favicons only |
| Ink | `#303848` | headings, dark text |
| Muted | `#6B7480` | secondary text |
| Hairline | `#E6E8EC` | borders, dividers |
| Wash | `#F6F7F9` | surfaces / page bg |
| Wash-orange | `#FFF3EC` | soft orange panels |
| Slate | `#323E49` | logo on light backgrounds |

### Fonts
- **English:** Proxima Nova Alt (400/600/700).
- **Arabic:** 29LT Zarid Slab (400–900); Bahij TheSansArabic for price-table emphasis.
- **Arabic is always RTL.** Base font stack must carry an Arabic fallback so no Arabic renders
  in a generic font. Embed licensed fonts with `@font-face` when rendering PDFs.

### Logo
Real kit confirmed on Drive (folder `1FzeAd3v14y11SckdAsAsrfVkcCHOXXnW`):
- `direct_logo_white.png` — white version, for orange/dark backgrounds.
- `direct_logo_slate.png` — slate version, for light backgrounds.
- `direct_logo_vector.svg` — vector master.
- Official lockups: `LOGO HD.png`, `Logo Direct 726 x 114-01/02.png`, `Logo Direct-01/02.png`.
- Rules: never recolor or stretch; clear space ≥ the height of the "D".

### Voice & value proposition
> **"Global supplier power. Saudi service. One partner."**
> «قوة موردين عالمية. خدمة سعودية. شريك واحد.»

Premium but plain. Recurring promise = **one accountable partner**. Arabic-first care, global
reach, transparent & digital. Bilingual AR + EN throughout.

### Signature element — the service-fee table
Orange header (`#F87020`, white bold), columns `# | Service | الخدمة | Fee`, zebra rows, fees in
orange bold, RTL Arabic column, T&C note beneath. Appears in every proposal/offer.

---

## 3 · Company facts (source of truth — from the official *Direct Profile NEW 2026*)

- **Founded 2016** · **8+ years** · HQ **Riyadh** · **5 branches** across the Kingdom.
- **~530 staff capacity**; **300+ travel & tourism specialists**; **50+ full-time developers**
  (38-person technical program: engineers, QA/automation, product owners, DevOps, IT).
- **700,000+ visas issued** · **17,000+ study-abroad students** · **2M+ app downloads** ·
  **9,000+ customer-service calls/day** · **1,500+ accommodation options** · **450+ airline
  agreements** · **16+ support services**.
- Serves **government and private entities** through a **unified digital platform** + a
  **dedicated advisor per client**.
- **Subsidiary:** **Technic Business Telecommunications Co. ("BTS")** — licensed by CST; SaaS,
  technical products, support services, and business consulting.

### The four values
1. **Continuous Innovation** — technical solutions that exceed expectations.
2. **Exceptional Journey** — every detail of the client's trip, fully integrated.
3. **Empowered Team** — invest in people, collaborative culture.
4. **Client-Centric** — listen, protect client data, keep improving.

### Services (official list)
Domestic & international flights · hotels & furnished apartments (in/out of Kingdom) · all visa
types (visit/work/study/delegations) + **document translation** · **international driving
permits** · **study abroad** (admissions, visas, follow-up; ICEF) · car rental (with/without
driver) · airport transfers · **eSIM** · **VIP arrival/departure** · conferences & exhibitions ·
meeting/event halls · domestic & international **postal shipping**.

### Real clients (named in the profile)
Ma'aden · Al Riyadh Club · Al Hilal Saudi Club · Takamol · Human Rights Commission · Saudi Food
& Drug Authority.

### Awards
Great Place To Work (2023–2024, 2024–2025) · International Travel Awards — Best Visa Agency in
KSA 2024 · World Travel Award — Best Travel & Tourism Company in KSA 2023 (+ Visa Sector 2023) ·
Arabian Best of Best — Winner 2025.

### Fee model
Transparent handling/service fee **on top of** supplier cost; ex-VAT; per person / ticket /
document / visa. Embassy/supplier/hotel/airline charges excluded unless a row says "Total".
Each account gets a **tailored fee schedule**. Segments (government · tender · agency ·
corporate) change only the framing — the design stays identical.

---

## 4 · The proposal system (what Direct actually sends)

Confirmed from the real proposals/offers folder (`1pG4Sgp8Jo7zUqNz5DuMFDkW6X18XBcqR`). Direct's
proposals are **not** just flight quotes — they span a real range. This is exactly what the
app's **proposal store** (the enhanced Offer Builder) now models:

| Proposal type | Real example on Drive |
|---|---|
| **Technical proposal** | `TECHNICAL PROPOSAL- SGC` (18 MB flagship tender deck) |
| **Financial bid** | Org-structures & job-descriptions financial bid; KSU training financial offer |
| **Business solution** | `Business Solutions Team Proposal` (BTS/consulting) |
| **Training** | جامعة الملك سعود team-training offer |
| **Tender** | ministry/authority price offers (وزارة الصناعة, الهيئة السعودية للمهندسين) |
| **Price offer** | عرض سعر … (flights, limousine, per-service) |
| **Company profile** | `Direct Profile NEW 2026 EN/AR`, `Direct Profile En.pptx` |

**Structure of a real Direct proposal** (from the business-solutions proposal): objective →
the challenges it solves → scope of work / team tasks → expected measurable impact (KPIs,
% targets) → success metrics → timeline/pilot → conclusion tying back to Direct's values.
**Design/identity of the proposal document itself is the next pass** — this doc + the brand
tokens are the foundation it will be built on.

---

## 5 · How the app serves Direct's higher purpose (not "just pages")

Direct's own *Business Solutions Team* proposal states the mandate of Business Development:
**manage suppliers/providers, run on operational excellence, decide from accurate data, and grow
new corporate & government clients (+20% target).** The app is the tool for that mandate. Each
module maps to it:

| App module | Serves… |
|---|---|
| **Leads** (funnels, stages, service-fit, next-step) | grow new corporate/government clients — the +20% mandate |
| **Lead → Client conversion** (Direct client ID handover) | clean handoff into Direct Payments (the money system) |
| **Clients (Customer-360)** | one accountable view: invoices + requests + proposals per client |
| **Proposal store** (Offer Builder) | store & link every proposal richly, promote to project |
| **Operations / Requests** | supplier/provider execution and quality |
| **Finance** (rolled up by linked client, by service) | data-driven decisions; margin = the service-fee model |
| **Reports** | the KPIs and accurate-information "anchor" the BD team is meant to be |

**Boundary that keeps it honest:** this app is **not** the system of record. **Direct Payments
owns all real money, invoices, ZATCA, refunds, settlement.** The app mirrors and coordinates and
may push a draft — nothing more. Every real-money action names the system it calls into.

---

## 6 · Where the identity assets live (Drive)

- **Official profiles:** folder `1jA5z3IurwGw6D0_TthD_9RIWwPnUA4kx` — *Direct Profile NEW 2026 EN*
  (`1m8QyxXt2Rl3eckJHugpzlbyYXW3ZVNT-`), *Direct Profile 2026*, AR profile.
- **Logo kit:** folder `1FzeAd3v14y11SckdAsAsrfVkcCHOXXnW` (white / slate / vector + lockups).
- **Real proposals & offers:** folder `1pG4Sgp8Jo7zUqNz5DuMFDkW6X18XBcqR`.
- **Brand engine (skill):** `direct-brand` skill — colors, fonts, the three output tracks
  (Document / Design / Build) and the build scripts (`build_profile.py`, `build_pptx.py`).

---

## 7 · Open loops & postmortem (be honest)

- **Two client IDs, one truth:** the corporate portal export was **test data**; the real client
  master is still only in **Direct Payments**. Linking the app's Direct client ID to the real
  Payments ID is still the open reconciliation. (Noted in HANDOFF_2026-08-09.)
- **Proposal document design** is deliberately a **later** pass — foundation (this doc + tokens)
  is now in place; the branded proposal template is the next build.
- **Public sites can't be read from here** (`directksa.com`, `corporate.*`, `payments.*` are
  blocked from the sandbox). Their content is captured via the profile + this doc; refresh from a
  screenshot or Drive export when they change.
- **Data in the app is assumption/test data** by the owner's direction — real data lives in
  backups and is restored when the team is ready.
