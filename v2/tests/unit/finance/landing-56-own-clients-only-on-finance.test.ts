/**
 * Landing 56 — "Own clients only" on Finance (the owner's approval of 26 Nov 2026; the per-member design of 22 Nov).
 * The Team member role starts at Own on Finance and on an organisation's Finance tab. Own reads all of Finance,
 * types an invoice, and changes the entries of the clients that are theirs — every client with the extra "Edit
 * someone else's work", which the database says in one answer (api.finance_my_clients). Full changes every entry;
 * View none. The refusal is worded in both languages. The database decides for real (OWN-02). Every value is made up.
 * Sabotages: tests/sabotage/landing-56.mjs.
 */
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import finance from '../../../src/modules/finance/module';
import { mayChangeEntryOf, mayTypeInvoice, myClientsOf, NO_CLIENTS } from '../../../src/modules/finance/own-clients';
import partners from '../../../src/modules/partners/module';

describe('the Team member role on Finance', () => {
  const financePage = finance.pages?.find((p) => p.key === 'finance');
  const tab = partners.pages?.find((p) => p.key === 'partner_finance');
  it('starts at Own on Finance and on an organisation’s Finance tab', () => {
    expect(financePage?.defaults?.member).toBe('own');
    expect(tab?.defaults?.member).toBe('own');
  });
  it('a manager, a head and an admin keep Full; a Viewer reads', () => {
    for (const d of [financePage?.defaults, tab?.defaults])
      expect([d?.admin, d?.head, d?.manager, d?.viewer]).toEqual(['full', 'full', 'full', 'view']);
  });
});

describe('who types an invoice', () => {
  it('Own and Full do; View and None do not', () => {
    expect(mayTypeInvoice('own')).toBe(true);
    expect(mayTypeInvoice('full')).toBe(true);
    expect(mayTypeInvoice('view')).toBe(false);
    expect(mayTypeInvoice('none')).toBe(false);
    expect(mayTypeInvoice(undefined)).toBe(false);
  });
});

describe('whose entries a person at Own may change', () => {
  const mine = myClientsOf({ all: false, partners: ['made-up-mine'] });
  it('an entry recorded under a client that is theirs', () => {
    expect(mayChangeEntryOf(mine, 'made-up-mine')).toBe(true);
  });
  it('never a colleague’s client’s, nor an entry under no organisation', () => {
    expect(mayChangeEntryOf(mine, 'made-up-theirs')).toBe(false);
    expect(mayChangeEntryOf(mine, null)).toBe(false);
    expect(mayChangeEntryOf(mine, undefined)).toBe(false);
  });
  it('every client, when the database says all are open (Full, or the extra “Edit someone else’s work”)', () => {
    const all = myClientsOf({ all: true, partners: [] });
    expect(mayChangeEntryOf(all, 'made-up-theirs')).toBe(true);
    expect(mayChangeEntryOf(all, null)).toBe(true);
  });
  it('nothing, until the database has answered or when its answer is not one', () => {
    expect(myClientsOf(null)).toEqual(NO_CLIENTS);
    expect(myClientsOf('made up')).toEqual(NO_CLIENTS);
    expect(myClientsOf({ all: 'yes', partners: 'made up' })).toEqual(NO_CLIENTS);
    expect(myClientsOf({ partners: ['made-up-a', 7] }).partners).toEqual(['made-up-a']);
    expect(mayChangeEntryOf(NO_CLIENTS, 'made-up-mine')).toBe(false);
  });
});

describe('the refusal', () => {
  it('is said in English and in Arabic, with the entry it is about', () => {
    for (const words of [en, ar]) {
      const said = (words.errors.finance as Record<string, string>).own_clients_only;
      expect(said).toBeTruthy();
      expect(said).toContain('{detail}');
    }
  });
});
