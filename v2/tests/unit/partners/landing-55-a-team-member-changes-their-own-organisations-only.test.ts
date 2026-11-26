/**
 * Landing 55 — a team member changes their own organisations only (the owner's approved design of 22 Nov 2026:
 * "Member: can add, edit and delete anything for their own clients. Cannot edit someone else's work."). The Team
 * member role starts at Own on the two organisation pages; the screen offers Edit, + Add, Archive / Remove and the
 * file picker only where the database allows the save: Full on a side's page, or Own and that side's owner, or Own
 * with the extra "Edit someone else's work". A note or a logged activity is the writer's own entry and stays open.
 * The database decides for real (OWN-01). Every value is made up.
 * Sabotages: tests/sabotage/landing-55.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  editsOthersWork,
  mayAddOrganisation,
  mayChangeOrganisation,
  mayChangeSide,
  mayLogOn,
  mayWriteSide,
} from '../../../src/modules/partners/may-change';
import partners from '../../../src/modules/partners/module';

type Level = 'none' | 'view' | 'own' | 'full';
const me = (key: string, level: Level, capabilities: string[] = [], supplierLevel: Level = level) => ({
  person: { id: 'made-up-me', role: { key, is_admin: key === 'admin' } },
  levels: { clients: level, suppliers_partners: supplierLevel },
  capabilities,
});
const mine = { side: 'client' as const, owner_id: 'made-up-me' };
const theirs = { side: 'client' as const, owner_id: 'made-up-colleague' };
const unowned = { side: 'client' as const, owner_id: null };
const EXTRA = ['records.edit_others'];

describe('the Team member role on the organisation pages', () => {
  const pageOf = (key: string) => partners.pages?.find((p) => p.key === key);
  it('starts at Own on Partners and on Suppliers & partners', () => {
    expect(pageOf('clients')?.defaults?.member).toBe('own');
    expect(pageOf('suppliers_partners')?.defaults?.member).toBe('own');
  });
  it('a manager, a head and an admin keep Full; a Viewer reads', () => {
    for (const key of ['clients', 'suppliers_partners']) {
      const d = pageOf(key)?.defaults;
      expect([d?.admin, d?.head, d?.manager, d?.viewer], key).toEqual(['full', 'full', 'full', 'view']);
    }
  });
  it('an organisation’s Finance tab follows Finance’s own rule: Own for a team member (Landing 56)', () => {
    expect(pageOf('partner_finance')?.defaults?.member).toBe('own');
  });
});

describe('who may change an organisation', () => {
  it('a team member changes the one whose side they own', () => {
    expect(mayWriteSide(me('member', 'own'), mine)).toBe(true);
    expect(mayChangeOrganisation(me('member', 'own'), [mine])).toBe(true);
  });
  it('and never a colleague’s, nor one with no owner', () => {
    expect(mayWriteSide(me('member', 'own'), theirs)).toBe(false);
    expect(mayChangeOrganisation(me('member', 'own'), [theirs])).toBe(false);
    expect(mayChangeOrganisation(me('member', 'own'), [unowned])).toBe(false);
  });
  it('Full on a side’s page changes every organisation on it', () => {
    expect(mayChangeOrganisation(me('manager', 'full'), [theirs])).toBe(true);
    expect(mayChangeOrganisation(me('manager', 'full'), [unowned])).toBe(true);
  });
  it('“Edit someone else’s work — Allowed” opens a colleague’s to a person at Own', () => {
    expect(mayChangeOrganisation(me('member', 'own', EXTRA), [theirs])).toBe(true);
    expect(mayWriteSide(me('member', 'own', EXTRA), theirs)).toBe(true);
  });
  it('a Viewer changes nothing, whatever their record still says', () => {
    expect(mayChangeOrganisation(me('viewer', 'view'), [mine])).toBe(false);
    expect(mayChangeOrganisation(me('viewer', 'view', EXTRA), [theirs])).toBe(false);
    expect(editsOthersWork(me('viewer', 'own', EXTRA))).toBe(false);
    expect(mayChangeOrganisation(me('viewer', 'own', EXTRA), [theirs])).toBe(false);
  });
  it('an organisation with two sides is changed by the owner of either', () => {
    const supplierTheirs = { side: 'supplier_partner' as const, owner_id: 'made-up-colleague' };
    expect(mayChangeOrganisation(me('member', 'own'), [mine, supplierTheirs])).toBe(true);
    // but each side's own rows stay with who may write that side
    expect(mayWriteSide(me('member', 'own'), supplierTheirs)).toBe(false);
  });
  it('with no side on, only Full on either page', () => {
    expect(mayChangeOrganisation(me('member', 'own'), [])).toBe(false);
    expect(mayChangeOrganisation(me('manager', 'full'), [])).toBe(true);
  });
});

describe('a side’s type, tier and start, and switching it on or off', () => {
  it('a side that is on: who may write it', () => {
    expect(mayChangeSide(me('member', 'own'), 'client', [mine])).toBe(true);
    expect(mayChangeSide(me('member', 'own'), 'client', [theirs])).toBe(false);
  });
  it('a side not yet on: who may change the organisation, with that side’s page at Own or above', () => {
    expect(mayChangeSide(me('member', 'own'), 'supplier_partner', [mine])).toBe(true);
    expect(mayChangeSide(me('member', 'own'), 'supplier_partner', [theirs])).toBe(false);
    expect(mayChangeSide(me('member', 'own', [], 'view'), 'supplier_partner', [mine])).toBe(false);
  });
});

describe('adding an organisation, and a person’s own entries', () => {
  it('Own adds an organisation — it is theirs; View does not', () => {
    expect(mayAddOrganisation(me('member', 'own'), 'client')).toBe(true);
    expect(mayAddOrganisation(me('manager', 'full'), 'client')).toBe(true);
    expect(mayAddOrganisation(me('viewer', 'view'), 'client')).toBe(false);
    expect(mayAddOrganisation(me('member', 'none'), 'client')).toBe(false);
  });
  it('a note or a logged activity stays open on a colleague’s organisation, never to a Viewer', () => {
    expect(mayLogOn(me('member', 'own'), [theirs])).toBe(true);
    expect(mayLogOn(me('viewer', 'view'), [theirs])).toBe(false);
    expect(mayLogOn(me('member', 'own'), [])).toBe(false);
  });
});
