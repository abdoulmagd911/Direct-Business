# QA sweep

Drives the real `index.html` in a headless browser against a local stand-in for Supabase,
so every page and button can be exercised without touching production data.

Why the stand-in: the sandbox these run in cannot reach `*.supabase.co` or the jsDelivr CDN,
and pointing a test run at the live database would write to real records.
`mock-supabase.mjs` serves the same REST and auth shapes with seeded rows.

## Running

```
npm i playwright @supabase/supabase-js
node scripts/qa/sweep-pages.mjs      # every nav page + every button, EN then AR
node scripts/qa/sweep-language.mjs   # lists UI text still in English while in Arabic
```

Chromium lives at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in this environment;
adjust `executablePath` elsewhere.

## Last run — 2026-08-08

- 16 nav pages opened, 134 buttons clicked, **0 JavaScript errors** in English or Arabic.
- Destructive buttons (delete/archive/sign out/reset) are skipped by a name filter.
- 135 pieces of UI text stay English when the app is switched to Arabic.
- `applyLang()` hardcodes `document.documentElement.dir='ltr'`, so Arabic never lays out
  right-to-left. Deliberate-looking, but worth a decision.
- Modals do not close on Escape.

## Before you write a probe: read the screen, not the model

**A probe that reads the model cannot see a defect that lives in the view.**

Five surfaces in a row proved this in September 2026. Each already had a probe. Each probe
verified the numbers *behind* the screen — `FIN._lastReport`, `__tot[m]`, `src.reduce(...)` — and
passed, correctly, for months. And on each surface the figures a person could actually read did
not add up:

| surface | what the screen showed | the probe that passed |
|---|---|---|
| drill-down (cycle 59) | three invoices of 100.40 printed `100 + 100 + 100` under a total printed `301` | `probe-drilldown-attacks`, reconciling raw rows to raw totals |
| Report Builder table (60) | three clients billing 100.40 printed as three rows of `100` above a TOTAL of `301` | `probe-report-builder-attacks`, four groupings, to the hallala |
| its CSV (60) | `TOTAL,301.20000000000005` | — nobody had read the file as text |
| ageing card (62) | six buckets printed `1.0K` each under an Outstanding of `10,752` | `probe-ageing-attacks` |
| Top clients table (63) | five rows of `1,000` above a Total of `5,002` | `probe-client-profit-honest` |

The mechanism is always the same and it is not really about rounding: **every figure is formatted
independently, so any two of them can disagree by the width of the formatting, and no amount of
correctness in the data prevents it.** `money0()` rounds to the riyal; `moneyS()` shortens to
K/M; the CSV wrote raw doubles. A model-level check cannot see any of it.

So, when the promise of a surface is arithmetic somebody performs by eye — a column with a total, a
row that expands into its parts, buckets under a headline — **assert on `textContent`, not on
`FIN`.** Read `FIN` only to prove a fix moved no money, and read that check carefully: cycle 60's
CSV defect and cycle 62's own arithmetic error were both found in exactly that check.

Two traps worth knowing before you start:

- **Do not test for a word the fix might use.** Cycle 57's probe passed under sabotage because one
  of its own fixture clients was named "Metric Co" and matched its text search; cycle 62's failed a
  *correct* fix because it searched for "rounded" and the fix said "shortened to fit". Assert on the
  substantive figure — the exact total the screen must state — which no wording can fake.
- **Ask whether the app can produce the value you are failing on.** Cycles 50 and 61 both caught
  something no write path in the app can create; cycle 61 came one step from "fixing" a file that
  was already right. Seed fixtures the way the app stores: `js/65` and `js/41` both write
  `Math.round(x*100)/100`, so a stored figure never carries more than two decimals.

`js/16` exports `finShortHides()`, `finShortBack()` and `finPrintedValue()` — one definition of
"which figure does a reader actually end up with". Use them rather than re-deriving the rule.
