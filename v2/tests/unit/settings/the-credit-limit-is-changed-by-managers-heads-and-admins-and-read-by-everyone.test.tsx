/**
 * Landing 31 — the credit limit in Settings → Finance (the owner's decision of 16 Nov 2026; boards fin2-credit-*).
 * A manager, a head of department and an admin get the edit form by role, and (Landing 40) so does a team member whose
 * record says "Allowed" — the database's answer says who; a viewer never does. Everyone else gets the read-only view —
 * the figure, never a box; the amount typed is whole riyals above zero; the Finance page opens for someone who is not
 * an admin with that card and nothing else of Settings, and every other Settings page still refuses them.
 * The database decides for real (CCL-01). Every value is made up.
 * Sabotages: tests/sabotage/landing-31-settings.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { mayChangeCreditLimit, parseCreditLimit } from '../../../src/modules/settings/credit-limit';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const role = (key: string | null) => ({
  person: { role: key === null ? null : { key, is_admin: key === 'admin' } },
});

describe('who is offered the edit form', () => {
  it('a manager, a head of department, an admin and a team member may be — the database says who is', () => {
    for (const key of ['manager', 'head', 'admin', 'member']) expect(mayChangeCreditLimit(role(key)), key).toBe(true);
  });
  it('a viewer and a person with no role never are', () => {
    for (const key of ['viewer', null]) expect(mayChangeCreditLimit(role(key)), String(key)).toBe(false);
  });
});

describe('the amount typed', () => {
  it('is whole riyals, with or without the thousands commas', () => {
    expect(parseCreditLimit('1,250,000')).toBe(1250000);
    expect(parseCreditLimit('1250000')).toBe(1250000);
    expect(parseCreditLimit(' 900 000 ')).toBe(900000);
    expect(parseCreditLimit('1')).toBe(1);
  });
  it('is refused when empty, zero, negative, a fraction, not a number, or more than the setting takes', () => {
    for (const bad of ['', ' ', '0', '-5', '1250000.50', '1.5', '12a', 'SAR 5', '1e6', '1000000001', '99999999999'])
      expect(parseCreditLimit(bad), JSON.stringify(bad)).toBeNull();
  });
});

const { CreditLimitCard } = await import('../../../src/modules/settings/screens/CreditLimitCard');
const draw = (canEdit: boolean, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      <CreditLimitCard amount={1250000} canEdit={canEdit} undo={false} />
    </NextIntlClientProvider>,
  );

describe('the card', () => {
  it('the edit form: the amount in a box, left to right, with Cancel and Save', () => {
    const html = draw(true);
    expect(html).toContain('data-credit-limit="edit"');
    expect(html).toMatch(/<input[^>]*data-credit-limit-input/);
    expect(html).toMatch(/<input[^>]*value="1,250,000"/);
    expect(html).toMatch(/<input[^>]*dir="ltr"/);
    expect(html).toMatch(/<button[^>]*data-credit-limit-cancel[^>]*>Cancel</);
    expect(html).toMatch(/<button[^>]*data-credit-limit-save[^>]*>Save</);
    expect(html).toContain('Managers and heads of department can change it.');
  });
  it('nothing is saved until the amount has changed: Save and Cancel start switched off', () => {
    const html = draw(true);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-credit-limit-save/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-credit-limit-cancel/);
  });
  it('the read-only view: the figure as SAR 1,250,000, who can change it, and no box or button', () => {
    const html = draw(false);
    expect(html).toContain('data-credit-limit="view"');
    expect(html).toMatch(/data-credit-limit-value[^>]*><bdi dir="ltr"[^>]*><span[^>]*>SAR<\/span> 1,250,000<\/bdi>/);
    expect(html).toContain('Only managers and heads of department can change this.');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-credit-limit-save');
  });
  it('reads in Arabic, the figure in Latin numerals', () => {
    const view = draw(false, 'ar');
    expect(view).toContain('حد الائتمان');
    expect(view).toContain('يغيّره المديرون ورؤساء الإدارات فقط.');
    expect(view).toContain('1,250,000');
    const edit = draw(true, 'ar');
    expect(edit).toContain('يطبّق على كل عميل آجل الدفع ما لم يحدد سجله حدًا خاصًا');
    expect(edit).toMatch(/<input[^>]*value="1,250,000"/);
  });
});

// ---- the page: who gets which view, and what else of Settings opens
const answers: Record<string, unknown> = {};
const asked: string[] = [];
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn(async (fn: string) => {
    asked.push(fn);
    if (answers[fn] instanceof Error) throw answers[fn];
    return answers[fn] ?? [];
  }),
}));
let me = role('member') as { person: { id?: string; role: { key: string; is_admin: boolean } | null } };
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

beforeEach(() => {
  asked.length = 0;
  for (const k of Object.keys(answers)) delete answers[k];
  answers.finance_credit_limit = { amount: 1250000, can_edit: false, is_default: true, set_at: null };
  answers.settings = { can_edit: true, settings: [{ key: 'finance.credit_limit' }, { key: 'finance.cost_estimate' }] };
  answers.org = { departments: [] };
});

describe('Settings → Finance, by who opens it', () => {
  it('a team member: the read-only card, Finance alone in the menu, and nothing else of Settings is read', async () => {
    me = role('member');
    const page = await open('finance');
    expect(page.CreditLimitCard?.[0]?.props).toMatchObject({ amount: 1250000, canEdit: false });
    expect(page.SettingsShell?.[0]?.props.only).toEqual(['finance']);
    expect(page.SettingsGroup).toBeUndefined();
    expect(asked).toEqual(['finance_credit_limit']);
  });
  it('a viewer stays read-only even if the answer said they may change it', async () => {
    me = role('viewer');
    answers.finance_credit_limit = { amount: 1250000, can_edit: true, is_default: true, set_at: null };
    expect((await open('finance')).CreditLimitCard?.[0]?.props.canEdit).toBe(false);
  });
  it('a team member the database allows (their record says Allowed) gets the edit form', async () => {
    me = role('member');
    answers.finance_credit_limit = { amount: 1250000, can_edit: true, is_default: true, set_at: null };
    expect((await open('finance')).CreditLimitCard?.[0]?.props).toMatchObject({ canEdit: true, undo: false });
  });
  it('a manager and a head of department: the edit form, without Undo (a setting is undone by an admin)', async () => {
    answers.finance_credit_limit = { amount: 900000, can_edit: true, is_default: false, set_at: null };
    for (const key of ['manager', 'head']) {
      me = role(key);
      const page = await open('finance');
      expect(page.CreditLimitCard?.[0]?.props, key).toMatchObject({ amount: 900000, canEdit: true, undo: false });
      expect(page.SettingsGroup, key).toBeUndefined();
    }
  });
  it('the database has the last word: a manager it refuses sees the read-only view', async () => {
    me = role('manager');
    expect((await open('finance')).CreditLimitCard?.[0]?.props.canEdit).toBe(false);
  });
  it('an admin: the edit form with Undo, above the other Finance settings — the figure not drawn a second time', async () => {
    me = role('admin');
    answers.finance_credit_limit = { amount: 1250000, can_edit: true, is_default: true, set_at: null };
    const page = await open('finance');
    expect(page.CreditLimitCard?.[0]?.props).toMatchObject({ canEdit: true, undo: true });
    expect(page.SettingsShell?.[0]?.props.only).toBeUndefined();
    expect((page.SettingsGroup?.[0]?.props.settings as { key: string }[]).map((s) => s.key)).toEqual([
      'finance.cost_estimate',
    ]);
  });
  it('a read that fails is said with Try again, never drawn as a figure', async () => {
    me = role('member');
    answers.finance_credit_limit = new Error('made up: the server did not answer');
    const page = await open('finance');
    expect(page.CreditLimitCard).toBeUndefined();
    expect(page.DataState?.[0]?.props).toMatchObject({ kind: 'failed' });
    expect(page.DataState?.[0]?.props.action).toBeTruthy();
  });
  it('every other Settings page still refuses someone who is not an admin, and points to the credit limit', async () => {
    for (const key of ['member', 'viewer', 'manager', 'head']) {
      me = role(key);
      asked.length = 0;
      for (const group of ['org', 'work', 'app', 'partners', 'performance']) {
        const page = await open(group);
        expect(page.DataState?.[0]?.props, `${key} · ${group}`).toMatchObject({
          kind: 'no-access',
          message: 'settings.noAccessAsk',
        });
        expect(page.SettingsShell, `${key} · ${group}`).toBeUndefined();
        expect((page.SettingsMenuList?.[0]?.props.groups as { slug: string }[]).map((g) => g.slug)).toEqual([
          'finance',
        ]);
      }
      expect(asked, `${key}: nothing is read`).toEqual([]);
    }
  });
});
