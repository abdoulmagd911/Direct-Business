# Landing 58 — Finance in tabs on every screen

28 Nov 2026 · base `9316ba01` (Landing 57 and its follow-up) · target `v2/main` · branch `v2/c-landing-58-finance-tabs` ·
by pull request.

Approved by the owner: the order of 27 Nov ("build Tasks first, then Finance tabs, then Achievements wording, as
separate landings, one at a time"), and his go for this one on 28 Nov ("And?", after Landing 57 went live). It answers
item 2 of the review of 26 Nov: "Finance — too much on one page." Layout only: **no figure, read, rule or access
changes**, and no database change.

## What changes

1. **The figures stay on top for everyone**: the period, the Payments stamp, the four figure cards, the not-yet-invoiced
   line, the commissions sentence and Needs attention.
2. **Under them, one row of tabs on every screen** (it was a phone-only switch of three views; a wide screen showed
   every section in one long page):
   - **Overview** — the months (with Close month), income by service, and the period's achievements;
   - **Ledger** — the ledger (its filters, saved views, companies, invoices and rows) and "Is it counted?";
   - **Owed** — what is owed and how old;
   - **Checks** — does Finance agree with itself, and what is held to tie;
   - **Import** — the import, only for a person who imports (Own or Full on Finance and the import extra, as before).
3. **The open tab is in the address** (`/finance?tab=ledger`; Overview is the bare `/finance`), so Back, a refresh and a
   shared link keep it. The period and the ledger's filters are kept when the tab changes.
4. **An address that names a section opens its tab** — `…/finance#finance-company` opens Ledger and goes to Income by
   company; `#finance-ageing` opens Owed. This also works for a link followed on the page itself.
5. **Nothing is read differently.** Every section stays on the page and is only put away while its tab is not open, so
   a tab opens at once and each section is read once, in the same order as before.

## Decisions taken (please confirm or overrule)

1. **Five tabs, named as above**, with the achievements under Overview (a list with no amount, apart from the money).
2. **The figures and Needs attention stay above the tabs** on every tab.
3. **Arabic words are drafts** (not drawn — please review with the rest of the Arabic): «أقسام المالية», «نظرة عامة»,
   «السجل», «المستحقات», «التحقق», «استيراد». «السجل» and «المستحقات» are the words already on the page.

## Files

- `src/modules/finance/tabs.ts` — the tabs, the tab an address or an anchor opens, the address of a tab.
- `src/modules/finance/screens/FinanceOverview.tsx` — the tab row under the figures; the Overview panel.
- `src/modules/finance/screens/FinanceOverviewLive.tsx` — the open tab, in the address; anchors; the Import panel.
- `src/modules/finance/screens/FinanceLedgerSection.tsx` — the Ledger, Owed, Checks and achievements panels.
- `src/modules/finance/screens/overview-page.tsx` — the tab from the address.
- `messages/en.json`, `messages/ar.json` — the tab words (the phone-only view words are retired).
- Tests: `tests/unit/finance/landing-58-finance-in-tabs.test.ts` (7), `tests/e2e/landing-58-finance-in-tabs.spec.ts`
  (2); sabotages `tests/sabotage/landing-58.mjs` (5) and `tests/sabotage/landing-58-e2e.mjs` (4).
- Older tests, because the layout changed: the Landing 31 cards test now describes the tabs instead of the phone switch;
  seven Finance browser tests open the tab that holds the section they read (one shared step, `openFinanceTab`), and
  two sabotages point at the new lines (`the-overview-stays-under-every-tab`, `e2e-l40-the-import-section-ignores-the-extra`).
  No test was loosened: each still checks the same thing, after the press a person now makes.

## Verification

- The 5 unit sabotages and the 4 browser sabotages: each red with its own words; the two re-pointed sabotages red.
- Every browser sabotage aimed at a test that opens Finance or a Finance file (148): each red with its own words. One,
  `commissions-sentence-missing`, first went red on figures an earlier sabotage in the same local run had left in the
  test database; run again on a freshly reset database it is red with its own words.
- Full checks: types, lint, format, the 19 checks, generated types, registry — clean; unit 1,995 passed; database 399
  files passed; browser 628 passed, 0 failed (11 skipped by time of day); the 902 unit sabotages red; tree clean.
