/**
 * Landing 32 (Finance F-B) — who sees the exclusion list and the merge list of Settings → Finance: an admin, and
 * nobody else. For anyone else the page draws neither card and does not even ask the database for the lists (which
 * would refuse them, 42501). A read that fails reaches the card as null — said with Try again, never an empty list.
 * Every value is made up. Sabotages: tests/sabotage/landing-32-settings-lists.mjs.
 */
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showsFinanceLists } from '../../../src/modules/settings/finance-lists';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const role = (key: string | null) => ({
  person: { role: key === null ? null : { key, is_admin: key === 'admin' } },
});

const answers: Record<string, unknown> = {};
const asked: string[] = [];
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn(async (fn: string) => {
    asked.push(fn);
    if (answers[fn] instanceof Error) throw answers[fn];
    return answers[fn] ?? [];
  }),
}));
let me = role('member');
vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => me) }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
type Drawn = { type: unknown; props: Record<string, unknown> };
const named = (name: string) => {
  const C = () => null;
  Object.defineProperty(C, 'name', { value: name });
  return C;
};
vi.mock('@/modules/settings/screens/SettingsShell', () => ({ SettingsShell: named('SettingsShell') }));
vi.mock('@/modules/settings/screens/SettingsGroup', () => ({ SettingsGroup: named('SettingsGroup') }));
vi.mock('@/modules/settings/screens/SettingsMenuList', () => ({ SettingsMenuList: named('SettingsMenuList') }));
vi.mock('@/modules/settings/screens/ListEditor', () => ({}));
vi.mock('@/modules/settings/screens/CreditLimitCard', () => ({ CreditLimitCard: named('CreditLimitCard') }));
vi.mock('@/modules/settings/screens/ExclusionListCard', () => ({ ExclusionListCard: named('ExclusionListCard') }));
vi.mock('@/modules/settings/screens/MergeListCard', () => ({ MergeListCard: named('MergeListCard') }));
vi.mock('@/modules/org/screens/OrgAccess', () => ({ OrgAccess: named('OrgAccess') }));
vi.mock('@/modules/perf/screens/TargetsScreen', () => ({ TargetsScreen: named('TargetsScreen') }));
vi.mock('@/ui/DataState', () => ({ DataState: named('DataState') }));
vi.mock('@/ui/PageHeader', () => ({ PageHeader: named('PageHeader') }));
vi.mock('@/ui/shell/Page', () => ({ Page: named('Page') }));

const { default: SettingsGroupPage } = await import('../../../src/app/(app)/settings/[group]/page');

/** Every element the page returned, by its component's name. */
function drawn(node: unknown, out: Record<string, Drawn[]> = {}): Record<string, Drawn[]> {
  if (Array.isArray(node)) for (const n of node) drawn(n, out);
  else if (node && typeof node === 'object' && 'props' in (node as object)) {
    const el = node as ReactElement<Record<string, unknown>>;
    const name = typeof el.type === 'string' ? el.type : ((el.type as { name?: string }).name ?? '');
    (out[name] ??= []).push({ type: el.type, props: el.props });
    drawn(el.props.children, out);
  }
  return out;
}
const open = async (group: string) =>
  drawn(await SettingsGroupPage({ params: Promise.resolve({ group }), searchParams: Promise.resolve({}) }));

const EXCLUSION = { id: 'made-up-rule-1', kind: 'client_id', value: '990001', row_level: false };
const MERGE = { id: 'made-up-merge-1', kind: 'discount_code', value: 'MADEUP10', partner_id: 'made-up-partner-1' };

beforeEach(() => {
  asked.length = 0;
  for (const k of Object.keys(answers)) delete answers[k];
  answers.finance_credit_limit = { amount: 1250000, can_edit: true, is_default: true, set_at: null };
  answers.settings = { can_edit: true, settings: [{ key: 'finance.cost_estimate' }] };
  answers.org = { departments: [] };
  answers.finance_exclusion_rules = [EXCLUSION];
  answers.finance_merge_rules = [MERGE];
});

describe('the rule', () => {
  it('an admin sees the two lists, on Finance', () => {
    expect(showsFinanceLists(role('admin'), 'finance')).toBe(true);
  });
  it('a manager, a head of department, a team member, a viewer and a person with no role do not', () => {
    for (const key of ['manager', 'head', 'member', 'viewer', null])
      expect(showsFinanceLists(role(key), 'finance'), String(key)).toBe(false);
  });
  it('no other Settings group carries them', () => {
    for (const group of ['org', 'work', 'app', 'partners', 'performance'])
      expect(showsFinanceLists(role('admin'), group), group).toBe(false);
  });
});

describe('Settings → Finance, by who opens it', () => {
  it('an admin: both cards, each with the rules its read returned', async () => {
    me = role('admin');
    const page = await open('finance');
    expect(page.ExclusionListCard?.[0]?.props.rules).toEqual([EXCLUSION]);
    expect(page.MergeListCard?.[0]?.props.rules).toEqual([MERGE]);
    expect(asked).toContain('finance_exclusion_rules');
    expect(asked).toContain('finance_merge_rules');
    // the credit limit and the other Finance settings are still there
    expect(page.CreditLimitCard).toHaveLength(1);
    expect(page.SettingsGroup).toHaveLength(1);
  });
  it('someone who is not an admin sees neither card, and the lists are not even read', async () => {
    for (const key of ['manager', 'head', 'member', 'viewer']) {
      me = role(key);
      asked.length = 0;
      const page = await open('finance');
      expect(page.ExclusionListCard, key).toBeUndefined();
      expect(page.MergeListCard, key).toBeUndefined();
      expect(asked, key).toEqual(['finance_credit_limit']);
    }
  });
  it('an admin on another Settings group sees neither card', async () => {
    me = role('admin');
    const page = await open('work');
    expect(page.ExclusionListCard).toBeUndefined();
    expect(page.MergeListCard).toBeUndefined();
    expect(asked).not.toContain('finance_exclusion_rules');
    expect(asked).not.toContain('finance_merge_rules');
  });
  it('a read that fails reaches its card as null — the other list still draws', async () => {
    me = role('admin');
    answers.finance_exclusion_rules = new Error('made up: the server did not answer');
    const page = await open('finance');
    expect(page.ExclusionListCard?.[0]?.props.rules).toBeNull();
    expect(page.MergeListCard?.[0]?.props.rules).toEqual([MERGE]);
  });
});
