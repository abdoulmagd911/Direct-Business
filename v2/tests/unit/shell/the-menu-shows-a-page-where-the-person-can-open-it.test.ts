/**
 * The menu rule (V238, replacing V217's work/manage tiers): a page is in the menu where the person's access opens it
 * (any level above none), whatever their role, and nowhere else; Suppliers is a tab of Clients, never an entry while
 * Clients is open; Settings is the admin's alone, at the foot; the phone bar is the first four and More, with no More for
 * a Viewer whose four fill it. Ctrl K's pages are the same list. Every person and level is made up.
 * Sabotage: tests/sabotage/nav-access.mjs "menu-ignores-the-access-list".
 */
import { describe, expect, it } from 'vitest';
import type { Me } from '../../../src/core/auth/me';
import { barFor, menuFor, navFor, reachableFor } from '../../../src/ui/shell/nav';

const ALL = ['my_day', 'tasks', 'clients', 'suppliers_partners', 'pipeline', 'overview', 'projects', 'finance'].concat([
  'kpis',
  'reports',
  'appraisal',
  'activity',
]);

function me(role: string, levels: Record<string, string>, isAdmin = false): Me {
  return {
    person: { role: { id: 'r', key: role, name_en: role, name_ar: null, is_admin: isAdmin } },
    levels,
  } as unknown as Me;
}

const everywhere = (level: string, but: Record<string, string> = {}) =>
  Object.fromEntries(ALL.map((k) => [k, but[k] ?? level]));
const keys = (m: Me) => navFor(m).map((e) => e.page);

describe('the menu (V238)', () => {
  it('shows a member every page their access opens, in order — Finance and KPIs included', () => {
    const member = me('member', everywhere('own', { pipeline: 'none', overview: 'none', activity: 'none' }));
    expect(keys(member)).toEqual(['my_day', 'tasks', 'clients', 'projects', 'finance', 'kpis', 'reports', 'appraisal']);
  });

  it('shows no page the access closes, whatever the role', () => {
    const closed = everywhere('full', { finance: 'none', kpis: 'none', pipeline: 'none' });
    expect(keys(me('head', closed))).not.toContain('finance');
    expect(keys(me('head', closed))).not.toContain('kpis');
    expect(keys(me('head', closed))).not.toContain('pipeline');
    expect(keys(me('head', closed))).toContain('projects');
  });

  it('follows the level, not the role: a member with Pipeline gets it, a head without it does not', () => {
    expect(keys(me('member', everywhere('own', { overview: 'none', activity: 'none' })))).toContain('pipeline');
    expect(keys(me('head', everywhere('full', { pipeline: 'none' })))).not.toContain('pipeline');
  });

  it('shows Overview and Activity to anyone whose access opens them', () => {
    const levels = everywhere('full', { overview: 'view', activity: 'view' });
    expect(keys(me('manager', levels))).toEqual([
      'my_day',
      'tasks',
      'clients',
      'pipeline',
      'overview',
      'projects',
      'finance',
      'kpis',
      'reports',
      'appraisal',
      'activity',
    ]);
  });

  it('puts Settings at the foot for an admin and nowhere else', () => {
    const levels = everywhere('full');
    expect(barFor(me('admin', levels, true)).rest.at(-1)?.key).toBe('settings');
    expect(menuFor(me('admin', levels, true)).at(-1)?.key).toBe('settings');
    for (const role of ['head', 'manager', 'member', 'viewer'])
      expect(menuFor(me(role, levels)).map((e) => e.key)).not.toContain('settings');
  });

  it('gives a viewer what their access opens and no More when four fill the bar', () => {
    const viewer = me(
      'viewer',
      everywhere('view', { tasks: 'none', pipeline: 'none', appraisal: 'none', overview: 'none' }),
    );
    expect(keys(viewer)).toEqual(['my_day', 'clients', 'projects', 'finance', 'kpis', 'reports', 'activity']);
    expect(barFor(viewer).more).toBe(true);
    const small = me('viewer', everywhere('none', { my_day: 'view', clients: 'view', kpis: 'view', reports: 'view' }));
    expect(barFor(small)).toMatchObject({ rest: [], more: false });
  });

  it('the bar, More and Ctrl K are cut from the same list', () => {
    const member = me('member', everywhere('own', { pipeline: 'none', overview: 'none', activity: 'none' }));
    const { bar, rest } = barFor(member);
    expect([...bar, ...rest].map((e) => e.key)).toEqual(menuFor(member).map((e) => e.key));
    expect(reachableFor(member).map((e) => e.page)).toEqual(expect.arrayContaining(keys(member)));
  });

  it('never puts Suppliers in the menu while Clients is open: it is the second tab of Clients', () => {
    expect(keys(me('admin', everywhere('full'), true))).not.toContain('suppliers_partners');
  });

  it('gives Suppliers its own door to a person who cannot open Clients', () => {
    expect(keys(me('member', everywhere('own', { clients: 'none' })))).toContain('suppliers_partners');
  });

  it('shows nobody a page at none', () => {
    expect(keys(me('head', everywhere('none')))).toEqual([]);
  });
});
