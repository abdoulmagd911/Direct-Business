// @vitest-environment jsdom
/**
 * Landing 34, item 6 (the 19 Nov test round, on a phone): "Add task spun, came back with NO error and no task; then
 * /tasks/new opened with no form for 15 s."
 *  - A save the server refused or never answered is said IN the form, in the refusal's own words, and stays there;
 *    everything typed stays as it was, and Add task can be pressed again.
 *  - The form /tasks/new opens is drawn with the page's first answer, outside the part that arrives late: it does
 *    not wait for the list, and what is typed stays when the names to pick from arrive.
 * Every value is made up.
 * Sabotage: tests/sabotage/landing-34-shell.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { Suspense, act, isValidElement, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { DbError } from '../../../src/core/db/errors';
import { ME } from './fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
Element.prototype.scrollIntoView = () => {};

const TEAM = '33333333-3333-4333-8333-333333333333';
const { rpcMock, toasts, started, replaced } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  toasts: [] as string[],
  started: [] as string[],
  replaced: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: (href: string) => replaced.push(href), refresh: () => {} }),
}));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: ME, team_id: TEAM }, capabilities: [], levels: { tasks: 'own' } }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: rpcMock }));
vi.mock('@/ui/Toast', () => ({
  toast: { failed: (m: string) => toasts.push(m), done: () => {}, working: () => {}, dismiss: () => {} },
}));
// the page's reads (the same stand-in as tests/unit/pages/a-list-page-asks-for-its-data-in-one-round)
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn(async (fn: string) => {
    started.push(fn);
    if (fn === 'org') return { people: [], departments: [], teams: [], roles: [] };
    if (fn === 'tasks' || fn === 'partners' || fn === 'projects') return { rows: [], total: 0, more: false };
    return [];
  }),
}));
const me = { person: { id: ME }, levels: { tasks: 'full', clients: 'full', projects: 'view' }, capabilities: [] };
vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => me) }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k, getLocale: async () => 'en' }));
vi.mock('@/ui/shell/Page', () => ({ Page: ({ children }: { children: ReactNode }) => <>{children}</> }));

const { QuickAddForm } = await import('../../../src/modules/tasks/screens/QuickAdd');
const { NewTaskEntry } = await import('../../../src/modules/tasks/screens/NewTaskEntry');
const { default: TasksPage } = await import('../../../src/app/(app)/tasks/page');

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  rpcMock.mockReset();
  toasts.length = 0;
  started.length = 0;
  replaced.length = 0;
  window.history.replaceState(null, '', '/');
});

const mount = async (node: ReactNode) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        {node}
      </NextIntlClientProvider>,
    );
  });
};
const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const title = () => document.querySelector('input[name="title"]') as HTMLInputElement;
const notes = () => document.querySelector('textarea[name="notes"]') as HTMLTextAreaElement;
const press = () =>
  act(async () => {
    (document.querySelector('[data-quick-add]') as HTMLFormElement).requestSubmit();
    await new Promise((r) => setTimeout(r, 0));
  });
const alert = () => document.querySelector('[data-quick-add-failed]');

describe('a save that failed is said in the form, and nothing typed is lost', () => {
  const form = <QuickAddForm org={null} partners={[]} projects={[]} priorities={[]} onClose={() => {}} />;

  it('a server that never answered: the timeout’s words stay in the form, the typing stays, Add task works again', async () => {
    rpcMock.mockRejectedValue(new DbError('Unavailable', 'common.unavailable', 'task_create timed out after 30s'));
    await mount(form);
    await type(title(), 'Made-up task for Made-up Org');
    await type(notes(), 'made-up notes');
    expect(alert()).toBeNull();
    await press();
    expect(alert()?.getAttribute('role')).toBe('alert');
    expect(alert()?.textContent).toBe(
      'The server did not answer. Try again. Nothing was saved. What you typed is still here.',
    );
    expect(toasts, 'the toast says the same words').toEqual(['The server did not answer. Try again.']);
    expect(title().value).toBe('Made-up task for Made-up Org');
    expect(notes().value).toBe('made-up notes');
    const save = document.querySelector('[data-quick-add-save]') as HTMLButtonElement;
    expect(save.disabled, 'not left spinning').toBe(false);
  });
  it('a refusal is said in the refusal’s own words', async () => {
    rpcMock.mockRejectedValue(new DbError('PermissionDenied', 'access.needs_level', '{"page":"tasks","level":"own"}'));
    await mount(form);
    await type(title(), 'Made-up task');
    await press();
    expect(toasts).toHaveLength(1);
    expect(alert()?.textContent).toContain(toasts[0]!);
    expect(alert()?.textContent).not.toContain('errors.');
    expect(alert()?.textContent).toContain('Nothing was saved.');
  });
  it('the next try clears the old failure, and a save that goes through shows none', async () => {
    rpcMock.mockRejectedValueOnce(new DbError('Unavailable', 'common.unavailable'));
    rpcMock.mockResolvedValueOnce({ id: 'made-up-id', number: 'TSK-2026-0001', request_id: null });
    const closed = vi.fn();
    await mount(<QuickAddForm org={null} partners={[]} projects={[]} priorities={[]} onClose={closed} />);
    await type(title(), 'Made-up task');
    await press();
    expect(alert()).not.toBeNull();
    await press();
    expect(alert()).toBeNull();
    expect(closed).toHaveBeenCalledTimes(1);
    // the save is tried twice; once it goes through at Default, the task is read once to say who owns it (Landing 57)
    expect(rpcMock.mock.calls.map((c) => c[0])).toEqual(['task_create', 'task_create', 'task']);
  });
});

describe('the form /tasks/new opens does not wait for the list', () => {
  it('the page’s first answer holds the form OUTSIDE the part that arrives late, and the list under it is closed', async () => {
    const page = (await TasksPage({ searchParams: Promise.resolve({ new: '1' }) })) as ReactElement<{
      children: ReactNode[];
    }>;
    const [form, late] = page.props.children as ReactElement[];
    expect(isValidElement(form) && form.type).toBe(NewTaskEntry);
    expect((form!.props as { names: unknown }).names).toBeInstanceOf(Promise);
    expect(late!.type, 'the list arrives late, behind the loading state').toBe(Suspense);
    const body = (late!.props as { children: ReactNode[] | ReactElement }).children;
    const list = (Array.isArray(body) ? body.find(isValidElement) : body) as ReactElement<{
      params: { new?: string };
      lookups: unknown;
    }>;
    expect(list.props.params.new, 'the list’s own Add task is not opened a second time').toBeUndefined();
    expect(list.props.lookups, 'the names are read once, for the form and the list').toBeInstanceOf(Promise);
    // run the late part: one round of reads, the organisation asked for once
    await (list.type as (p: unknown) => Promise<unknown>)(list.props);
    expect(started.filter((f) => f === 'org')).toHaveLength(1);
    expect(started).toEqual(expect.arrayContaining(['tasks', 'list', 'org', 'partners', 'projects']));
  });
  it('a visit to the list itself is not changed: no form, the page as before', async () => {
    const page = (await TasksPage({ searchParams: Promise.resolve({}) })) as ReactElement;
    expect(page.type).not.toBe(Suspense);
    expect(JSON.stringify(page.props)).toContain('"adding":false');
  });
  it('the form is there at once, and what is typed stays when the names arrive', async () => {
    window.history.replaceState(null, '', '/tasks/new');
    let arrive!: (n: Parameters<typeof NewTaskEntry>[0]['names'] extends Promise<infer N> ? N : never) => void;
    const names = new Promise<Parameters<typeof arrive>[0]>((done) => (arrive = done));
    await mount(<NewTaskEntry names={names} />);
    expect(document.querySelector('[data-quick-add]'), 'no waiting for the names').not.toBeNull();
    expect(document.body.textContent).not.toContain('Partner');
    await type(title(), 'Typed before the list was read');
    await act(async () => {
      arrive({
        org: null,
        partners: [{ id: 'made-up-org', number: 'ORG-990001', name_en: 'Made-up Org', name_ar: null }],
        projects: [],
        priorities: [],
      });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.body.textContent, 'the partner picker has joined the form').toContain('Made-up Org');
    expect(title().value, 'the same form, not a new one').toBe('Typed before the list was read');
  });
  it('a save moves on to the new task’s page and spends the address', async () => {
    window.history.replaceState(null, '', '/tasks/new');
    rpcMock.mockResolvedValue({ id: 'made-up-id', number: 'TSK-2026-0001', request_id: null });
    await mount(<NewTaskEntry names={new Promise(() => {})} />);
    await type(title(), 'Made-up task');
    await press();
    expect(window.location.pathname, 'a reload does not open the empty form again').toBe('/tasks');
    expect(replaced).toEqual(['/tasks/TSK-2026-0001']);
    expect(document.querySelector('[data-quick-add]')).toBeNull();
  });
  it('names that could not be read leave a form that still works', async () => {
    window.history.replaceState(null, '', '/tasks/new');
    await mount(<NewTaskEntry names={Promise.reject(new Error('made-up failure'))} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(title()).not.toBeNull();
  });
});
