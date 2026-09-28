# D27 — Company identifiers and automatic matching

PLANNED · 2026-09-28 · second builder · the owner's rulings of 28 Sep (13:15), Drive KB "10 App review and target design"
§2 and "03 Words we use" ("Company identifiers").

## What a company holds

A list of identifiers, each typed: **Payments client ID · discount code (optional valid-from / valid-to) · name or spelling
(English or Arabic, any number) · contact email · phone · VAT number · CR number** — table `company_identifiers`.

- **One identifier belongs to one company only** — the database refuses a second live row with the same type and value.
- Added and removed **by a person** on the company card, on Finance → Rules ("Belongs to …") or by pressing Import on the
  corporate clients export; every change is in the change log; a removal can be undone (the identifier comes back, unless
  another company holds it by then); an identifier is never moved to another company — it is removed and added again.
- **Never an identifier:** a Direct staff email or domain (`@directksa.…`), the dummy test VAT 311111111111113, and any
  value under an exclusion rule on Finance → Rules (test clients, Takamol …).

## How values are compared

| Type | Compared as |
|---|---|
| Name | lower case, spaces collapsed, Arabic diacritics and tatweel removed, أ إ آ ٱ → ا, ى ئ → ي, ة → ه, ؤ → و, Arabic-Indic digits → 0–9, punctuation dropped (dots inside a word joined: L.L.C. = LLC), and the words شركة / مؤسسة / company / co / corp / corporation / ltd / limited / llc / inc / est dropped |
| Email | lower case, trimmed |
| Phone | digits only, the Saudi prefixes (00966, +966, 966, a leading 0) folded, so 0501234567 = +966 50 123 4567 |
| VAT, CR | digits only |
| Client ID, discount code | as the money rules already compare them (`money_norm`) |

## Matching — a live view, never a stamp

Every money row is matched in this order: **client ID → VAT / CR → discount code (inside its dates, by the row's date) →
email → phone → name**. The first level that finds anything decides: one company = matched; two or more = **Needs a
decision**, naming them all; nothing at any level = **Needs a decision**. Nothing is guessed and nothing is written onto the
row, so adding or removing an identifier re-links past rows at once — in Finance, the Report Builder, the company card and
the KPIs, which all read `money_rows`.

A row's client ID is its own, else the Payments client whose contact email it carries (the client register, D26), so the
client-ID exclusion rules keep working. Exclusions (D16) are unchanged and still win.

## One mechanism

The client IDs of the billing profiles, the linked discount codes and the customer-name aliases of the old "Company merges"
are copied into identifiers once; matching reads identifiers only. A billing profile (prepaid / postpaid / tender) still
lives in `client_profiles`; its client ID is kept as an identifier of that company. A company merge carries the dropped
company's identifiers to the kept one, and undoing the merge takes them back.

## Deciding

Finance → Rules → **Needs a decision** lists the rows no identifier places, grouped by their strongest detail (client ID,
VAT/CR, code, email, phone, name), largest amount first, with a suggestion when a company's own name matches. **Belongs to X**
adds that detail to X's identifiers, so the next import matches by itself. A row two companies claim shows both, with the
identifiers that collide, so the wrong one can be removed. "New company…" and "Exclude…" stay.

## Imports

Every import lands in `money_rows` and is matched live. The corporate clients export is matched the same way (client ID →
VAT / CR → email → phone → names); on Import it adds the client's ID, Legal Name, Legal Name (Arabic), Trading Name, contact
email, phone, VAT and CR to the company it matches — skipping what may never be an identifier and what another company holds,
which it lists — and an unmatched client can be made a new company from the preview.
