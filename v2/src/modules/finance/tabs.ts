/**
 * Landing 58 — Finance in tabs on every screen (the owner's review of 26 Nov: "Finance is too much on one page"). The
 * headline stays on top for everyone: the period, the Payments stamp, the figure cards, the not-yet-invoiced line and
 * Needs attention. Under it, one row of tabs, each holding the sections that belong together:
 *   Overview — the months and income by service, and the period's achievements;
 *   Ledger   — the ledger (its filters, companies, invoices and rows) and "Is it counted?";
 *   Owed     — what is owed and how old;
 *   Checks   — does Finance agree with itself, and what is held to tie;
 *   Import   — the import, for a person who imports.
 * Nothing is read differently: every section stays on the page and is only put away, so a tab opens at once.
 * The open tab rides the address (`?tab=ledger`) so Back, refresh and a shared link keep it; Overview is the bare address.
 */
import { opensLedgerView } from './ledger';

export const FINANCE_TABS = ['overview', 'ledger', 'owed', 'checks', 'import'] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];

/** The tab that holds each section's anchor (`…/finance#finance-ageing` opens Owed). */
const ANCHOR_TAB: [RegExp, FinanceTab][] = [
  [/^#finance-ageing/, 'owed'],
  [/^#finance-(reconciliation|held)/, 'checks'],
  [/^#finance-import/, 'import'],
  [/^#finance-(months|service|achievements)/, 'overview'],
];

/** The tab an anchor names, or none. */
export function tabOfAnchor(hash: string): FinanceTab | null {
  if (opensLedgerView(hash)) return 'ledger';
  for (const [re, tab] of ANCHOR_TAB) if (re.test(hash)) return tab;
  return null;
}

/** The tab the address asks for; Import only for a person who imports, anything else is Overview. */
export function financeTab(param: string | undefined, mayImport: boolean): FinanceTab {
  const tab = FINANCE_TABS.find((x) => x === param) ?? 'overview';
  return tab === 'import' && !mayImport ? 'overview' : tab;
}

/** The address of a tab, keeping every other part of the address (the period, the ledger's filters). */
export function financeTabHref(search: string, tab: FinanceTab, hash = ''): string {
  const p = new URLSearchParams(search);
  if (tab === 'overview') p.delete('tab');
  else p.set('tab', tab);
  const qs = p.toString();
  return `/finance${qs ? `?${qs}` : ''}${hash}`;
}
