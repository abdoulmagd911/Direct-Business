/**
 * The employee view's menu rule (V217): work pages show at any level above none; manage pages for Manager, Head and
 * Admin — Overview and Activity for Head and Admin only, KPIs and Reports for a Viewer too; Suppliers is a tab, never
 * an entry; the phone bar is the first four and More, with no More for a Viewer whose four fill it. Out of the menu is
 * still reachable (Ctrl K's pages).
 */
import { describe, expect, it } from 'vitest';
import type { Me } from '../../../src/core/auth/me';
import { barFor, navFor, reachableFor } from '../../../src/ui/shell/nav';

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

describe('the menu (V217)', () => {
  it('gives a member the work pages only, whatever their level on the manage pages', () => {
    const member = me('member', everywhere('own', { pipeline: 'none', overview: 'none', activity: 'none' }));
    expect(keys(member)).toEqual(['my_day', 'tasks', 'clients']);
    expect(reachableFor(member).map((e) => e.page)).toContain('kpis');
    expect(barFor(member)).toMatchObject({ rest: [], more: true });
  });

  it('adds Pipeline for a member who holds it (a Business Development person change)', () => {
    expect(keys(me('member', everywhere('own', { overview: 'none', activity: 'none' })))).toEqual([
      'my_day',
      'tasks',
      'clients',
      'pipeline',
    ]);
  });

  it('keeps Overview and Activity from a manager even at View; a head and an admin get them', () => {
    const levels = everywhere('full', { overview: 'view', activity: 'view' });
    expect(keys(me('manager', levels))).toEqual([
      'my_day',
      'tasks',
      'clients',
      'pipeline',
      'projects',
      'finance',
      'kpis',
      'reports',
      'appraisal',
    ]);
    expect(keys(me('head', levels))).toContain('overview');
    expect(keys(me('head', levels))).toContain('activity');
    const admin = me('admin', levels, true);
    expect(barFor(admin).rest.at(-1)?.key).toBe('settings');
  });

  it('gives a viewer My day, Clients, KPIs and Reports, and no More', () => {
    const viewer = me('viewer', everywhere('view', { tasks: 'none', pipeline: 'none', appraisal: 'none' }));
    expect(keys(viewer)).toEqual(['my_day', 'clients', 'kpis', 'reports']);
    expect(barFor(viewer)).toMatchObject({ rest: [], more: false });
  });

  it('never puts Suppliers in the menu: it is the second tab of Clients', () => {
    expect(keys(me('admin', everywhere('full'), true))).not.toContain('suppliers_partners');
  });

  it('shows nobody a page at none', () => {
    expect(keys(me('head', everywhere('none')))).toEqual([]);
  });
});
