/**
 * Landing 58 — Finance in tabs on every screen (the owner's review of 26 Nov: "Finance is too much on one page"). The
 * address names the open tab (`?tab=`), Overview is the bare address, Import is only for a person who imports, and an
 * anchor that names a section opens that section's tab. Sabotages: tests/sabotage/landing-58.mjs.
 */
import { describe, expect, it } from 'vitest';
import { financeTab, financeTabHref, tabOfAnchor } from '../../../src/modules/finance/tabs';

describe('the address names the open tab', () => {
  it('opens the tab it names, and Overview when it names none or an unknown one', () => {
    expect(financeTab(undefined, false)).toBe('overview');
    expect(financeTab('ledger', false)).toBe('ledger');
    expect(financeTab('owed', false)).toBe('owed');
    expect(financeTab('checks', false)).toBe('checks');
    expect(financeTab('made-up', false)).toBe('overview');
  });

  it('opens Import only for a person who imports', () => {
    expect(financeTab('import', true)).toBe('import');
    expect(financeTab('import', false), 'no Import tab: Overview instead').toBe('overview');
  });

  it('keeps the period and the ledger filters when the tab changes, and Overview is the bare address', () => {
    expect(financeTabHref('?period=ytd&company=p1', 'ledger')).toBe('/finance?period=ytd&company=p1&tab=ledger');
    expect(financeTabHref('?period=ytd&tab=ledger', 'owed')).toBe('/finance?period=ytd&tab=owed');
    expect(financeTabHref('?period=ytd&tab=checks', 'overview')).toBe('/finance?period=ytd');
    expect(financeTabHref('', 'overview')).toBe('/finance');
  });
});

describe('an anchor opens the tab that holds its section', () => {
  it('the ledger and its parts open Ledger', () => {
    for (const h of ['#finance-ledger', '#finance-ledger-waiting', '#finance-company', '#finance-counted'])
      expect(tabOfAnchor(h), h).toBe('ledger');
  });

  it('what is owed opens Owed; the reconciliation and what is held open Checks', () => {
    expect(tabOfAnchor('#finance-ageing')).toBe('owed');
    expect(tabOfAnchor('#finance-reconciliation')).toBe('checks');
    expect(tabOfAnchor('#finance-held')).toBe('checks');
  });

  it('the months, income by service and achievements are Overview; the import is Import', () => {
    for (const h of ['#finance-months', '#finance-service', '#finance-achievements'])
      expect(tabOfAnchor(h), h).toBe('overview');
    expect(tabOfAnchor('#finance-import')).toBe('import');
  });

  it('an address with no anchor, or another one, opens nothing by itself', () => {
    expect(tabOfAnchor('')).toBeNull();
    expect(tabOfAnchor('#made-up')).toBeNull();
  });
});
