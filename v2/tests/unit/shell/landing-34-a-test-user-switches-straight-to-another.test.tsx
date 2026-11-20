// @vitest-environment jsdom
/**
 * Landing 34, item 29 (the 19 Nov test round): "Sign in as test user" existed only on the real Admin's account, so
 * going from one TEST user to another meant a trip back to the real account each time. While a device is switched,
 * the bar now lists the other TEST users, and a TEST row or a TEST person's page offers the direct switch. Who may
 * start a switch is unchanged and still the database's call: the direct switch is the two steps the database already
 * allows (back to my account, then sign in as the other), each made as the real signed-in person and each logged.
 * Every name is made up.
 * Sabotage: tests/sabotage/landing-34-shell.mjs.
 */
import { createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { DbError } from '../../../src/core/db/errors';
import { offersSwitch, offersSwitchOver, switchTargets } from '../../../src/core/test-switch/offer';

vi.mock('@/ui/Menu', () => ({
  Menu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MenuItem: ({ children, disabled, ...rest }: { children: React.ReactNode; disabled?: boolean }) => (
    <div role="menuitem" aria-disabled={disabled || undefined} {...rest}>
      {children}
    </div>
  ),
}));

const { SwitchOverRows, TestSwitchBarView } = await import('../../../src/ui/shell/TestSwitchBar');

const by = { by_id: 'o1', by_name_en: 'Made-up Owner', by_name_ar: null, since: '2026-11-19T10:00:00Z' };
const switched = (id: string, admin: boolean) =>
  ({ status: 'ok', test_switch: by, person: { id, role: { is_admin: admin } } }) as unknown as Me;
const owner = { status: 'ok', test_switch: null, person: { id: 'o1', role: { is_admin: true } } } as unknown as Me;

const PEOPLE = [
  { id: 't2', is_test: true, full_name_en: 'TEST Member' },
  { id: 'r1', is_test: false, full_name_en: 'Made-up Colleague' },
  { id: 't1', is_test: true, full_name_en: 'TEST Admin' },
  { id: 't3', is_test: true, full_name_en: 'TEST Manager' },
  { id: 'r2', full_name_en: 'Made-up Other' },
];

describe('while switched, the way to another TEST user is direct', () => {
  it('is offered on every other TEST person, whoever the device is signed in as', () => {
    for (const admin of [true, false]) {
      const me = switched('t1', admin);
      expect(offersSwitchOver(me, { id: 't2', is_test: true })).toBe(true);
      expect(offersSwitch(me, { is_test: true }), 'the first switch is still not offered twice (QA-615)').toBe(false);
    }
  });
  it('is never offered on the TEST user the device already is, nor on a real colleague', () => {
    const me = switched('t1', true);
    expect(offersSwitchOver(me, { id: 't1', is_test: true })).toBe(false);
    expect(offersSwitchOver(me, { id: 'r1', is_test: false })).toBe(false);
    expect(offersSwitchOver(me, { id: 'r2' })).toBe(false);
  });
  it('is not offered to a device that is not switched: starting a switch stays the owner’s own door', () => {
    expect(offersSwitchOver(owner, { id: 't2', is_test: true })).toBe(false);
    const member = { status: 'ok', person: { id: 'm1', role: { is_admin: false } } } as unknown as Me;
    expect(offersSwitchOver(member, { id: 't2', is_test: true })).toBe(false);
    expect(offersSwitch(member, { is_test: true })).toBe(false);
  });
  it('the bar lists the other TEST users by name, A to Z', () => {
    expect(switchTargets(switched('t1', false), PEOPLE).map((p) => p.full_name_en)).toEqual([
      'TEST Manager',
      'TEST Member',
    ]);
    expect(switchTargets(owner, PEOPLE)).toEqual([]);
  });
});

describe('the bar while signed in as a TEST user', () => {
  const words = { loading: 'Loading', failed: 'The test users could not load. Try again', none: 'No other test user' };
  it('draws the way to the other TEST users before Back to my account', () => {
    const html = renderToStaticMarkup(
      <TestSwitchBarView
        line="TEST user: TEST Admin (you are Made-up Owner)"
        back="Back to my account"
        onBack={() => {}}
        others={<button data-test-switch-menu>Switch test user</button>}
      />,
    );
    expect(html.indexOf('data-test-switch-menu')).toBeGreaterThan(-1);
    expect(html.indexOf('data-test-switch-menu')).toBeLessThan(html.indexOf('data-test-switch-back'));
  });
  it('each TEST user is a row that carries their id', () => {
    const html = renderToStaticMarkup(
      <SwitchOverRows
        state={switchTargets(switched('t1', false), PEOPLE)}
        words={words}
        onPick={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(html).toContain('data-test-switch-to="t2"');
    expect(html).toContain('data-test-switch-to="t3"');
    expect(html).not.toContain('data-test-switch-to="t1"');
    expect(html).not.toContain('Made-up Colleague');
  });
  it('says so while the list is read, when there is nobody else, and offers Try again when the read failed', () => {
    const draw = (state: Parameters<typeof SwitchOverRows>[0]['state']) =>
      renderToStaticMarkup(<SwitchOverRows state={state} words={words} onPick={() => {}} onRetry={() => {}} />);
    expect(draw(null)).toContain('Loading');
    expect(draw([])).toContain('No other test user');
    expect(draw('failed')).toContain('data-test-switch-retry');
    expect(draw('failed')).toContain('The test users could not load. Try again');
  });
  it('has its words in English and in Arabic', () => {
    for (const messages of [en, ar]) {
      const t = createTranslator({ locale: messages === en ? 'en' : 'ar', messages });
      for (const k of ['over', 'overTo', 'none', 'listFailed'] as const)
        expect(t(`testSwitch.${k}`).length).toBeGreaterThan(5);
      expect(t('testSwitch.switchedBack', { reason: 'X' })).toContain('X');
    }
    expect(createTranslator({ locale: 'en', messages: en })('testSwitch.over')).toBe('Switch test user');
  });
});

describe('the direct switch is the two steps the database allows', () => {
  const load = async (rpc: (...args: unknown[]) => Promise<unknown>) => {
    vi.resetModules();
    vi.doMock('../../../src/core/db/rpc', () => ({ rpc }));
    return import('../../../src/core/test-switch/use-test-switch');
  };
  it('goes back to my account, then signs in as the other TEST user, then starts the app over', async () => {
    const calls: unknown[][] = [];
    const page = { went: [] as string[], reloaded: 0 };
    const { switchOver } = await load(async (...args) => {
      calls.push(args);
      return args[0] === 'me' ? { status: 'ok', profile: { theme: 'light', density: 'compact' } } : {};
    });
    await switchOver('t2', { go: (p) => page.went.push(p), reload: () => (page.reloaded += 1) });
    expect(calls).toEqual([
      ['test_switch_end', {}],
      ['test_switch_start', { p_person: 't2' }],
      ['me', {}],
    ]);
    expect(page.went).toEqual(['/']);
    expect(page.reloaded).toBe(0);
  });
  it('a refusal of the first step changes nothing and is thrown as it is', async () => {
    const calls: unknown[] = [];
    const page = { went: [] as string[], reloaded: 0 };
    const refusal = new DbError('PermissionDenied', 'auth.no_active_person');
    const { switchOver, SwitchedBack } = await load(async (fn) => {
      calls.push(fn);
      throw refusal;
    });
    const thrown = await switchOver('t2', { go: (p) => page.went.push(p), reload: () => (page.reloaded += 1) }).catch(
      (e: unknown) => e,
    );
    expect(thrown).toBe(refusal);
    expect(thrown).not.toBeInstanceOf(SwitchedBack);
    expect(calls, 'the second step is never asked').toEqual(['test_switch_end']);
    expect(page).toEqual({ went: [], reloaded: 0 });
  });
  it('a refusal of the second step says the device is back on its own account, with the database’s reason', async () => {
    const page = { went: [] as string[], reloaded: 0 };
    const refusal = new DbError('PermissionDenied', 'test_switch.not_a_test_user');
    const { switchOver, SwitchedBack } = await load(async (fn) => {
      if (fn === 'test_switch_start') throw refusal;
      return true;
    });
    const thrown = await switchOver('r1', { go: (p) => page.went.push(p), reload: () => (page.reloaded += 1) }).catch(
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(SwitchedBack);
    expect((thrown as InstanceType<typeof SwitchedBack>).refusal).toBe(refusal);
    expect(page.went, 'the app is not started as someone the database refused').toEqual([]);
  });
});
