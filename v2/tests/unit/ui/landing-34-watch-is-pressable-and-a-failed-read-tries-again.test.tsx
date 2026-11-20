// @vitest-environment jsdom
/**
 * Landing 34.
 * Item 21: the Watch button was disabled, with no word why, for as long as its own read was out — on a slow day that
 * read as "disabled on every record". It is pressable at once (a press then asks to watch), and the one case that
 * stays disabled — the Viewer's — says why, in words on the page and as the button's tooltip.
 * Items 2/3: a failed read says why and its Try again is seen to work — it reads again, spins while the read is out,
 * and a second failure says it was tried.
 * Item 20: a record may keep its tab row to one line on a phone. Every name is made up.
 * Sabotage: tests/sabotage/landing-34-partners.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ar from '../../../messages/ar.json';

const ROLE = vi.hoisted(() => ({ key: 'member' }));
const calls = vi.hoisted(() => ({ rpc: [] as [string, Record<string, unknown>][], refresh: 0 }));
vi.mock('@/core/auth/me-context', () => ({ useMaybeMe: () => ({ person: { role: { key: ROLE.key } } }) }));
vi.mock('@/core/db/rpc', () => ({
  rpc: (fn: string, args: Record<string, unknown>) => {
    calls.rpc.push([fn, args]);
    // the read of "am I watching" never answers in these tests: the slow day
    return fn === 'following' ? new Promise(() => {}) : Promise.resolve(true);
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => void (calls.refresh += 1) }),
  usePathname: () => '/partners/made-up-org',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/ui/shell/AppShell', () => ({ PageFrame: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const { FollowButton } = await import('../../../src/ui/FollowButton');
const { ReadFailed } = await import('../../../src/modules/partners/screens/ReadFailed');
const { RecordPage } = await import('../../../src/ui/record/RecordPage');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  calls.rpc.length = 0;
  calls.refresh = 0;
  ROLE.key = 'member';
});

const mount = (node: ReactNode, locale: 'en' | 'ar' = 'en') => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar}>
        {node}
      </NextIntlClientProvider>,
    );
  });
};

describe('Watch is pressable, and says why when it is not', () => {
  it('is not disabled while its own read is still out', () => {
    mount(<FollowButton entity="partner" id="made-up-org" />);
    const button = document.querySelector('[data-follow]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Watch');
    expect(document.querySelector('[data-follow-reason]')).toBeNull();
  });
  it('a press before the read has answered asks to watch', async () => {
    mount(<FollowButton entity="partner" id="made-up-org" />);
    await act(async () => (document.querySelector('[data-follow]') as HTMLButtonElement).click());
    expect(calls.rpc).toContainEqual(['follow', { p_entity: 'partner', p_id: 'made-up-org', p_on: true }]);
    expect(document.querySelector('[data-follow]')?.hasAttribute('data-following')).toBe(true);
  });
  it('a Viewer’s button is disabled and says why, on the page and as its tooltip', () => {
    ROLE.key = 'viewer';
    mount(<FollowButton entity="partner" id="made-up-org" />);
    const button = document.querySelector('[data-follow]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Watching is not available for your role.');
    const reason = document.querySelector('[data-follow-reason]');
    expect(reason?.textContent).toBe('Watching is not available for your role.');
    expect(button.getAttribute('aria-describedby')).toBe(reason?.id);
  });
});

describe('a failed read says why, and Try again is seen to work', () => {
  it('says what failed, why, and its reference', () => {
    mount(
      <ReadFailed message="Organisations could not load." failure={{ kind: 'timeout', ref: 'Unavailable · 57014' }} />,
    );
    const box = document.querySelector('[data-state="failed"]');
    expect(box?.textContent).toContain('Organisations could not load. It took too long and was stopped.');
    expect(document.querySelector('[data-failure-ref]')?.textContent).toBe('Unavailable · 57014');
  });
  it('a server that did not answer is said so', () => {
    mount(
      <ReadFailed message="This organisation could not load." failure={{ kind: 'unavailable', ref: 'Unavailable' }} />,
    );
    expect(document.querySelector('[data-state="failed"]')?.textContent).toContain(
      'This organisation could not load. The server did not answer.',
    );
  });
  it('Try again reads again, and a read that fails again says it was tried', async () => {
    mount(
      <ReadFailed message="Organisations could not load." failure={{ kind: 'timeout', ref: 'Unavailable · 57014' }} />,
    );
    expect(document.querySelector('[data-read-tried]')).toBeNull();
    await act(async () => (document.querySelector('[data-read-retry]') as HTMLButtonElement).click());
    expect(calls.refresh).toBe(1);
    expect(document.querySelector('[data-read-tried]')?.textContent).toBe('Tried again once: it still did not load.');
    await act(async () => (document.querySelector('[data-read-retry]') as HTMLButtonElement).click());
    expect(calls.refresh).toBe(2);
    expect(document.querySelector('[data-read-tried]')?.textContent).toBe(
      'Tried again 2 times: it still did not load.',
    );
  });
  it('says the same in Arabic', () => {
    mount(<ReadFailed message="تعذّر تحميل الجهات." failure={{ kind: 'timeout', ref: 'Unavailable · 57014' }} />, 'ar');
    expect(document.querySelector('[data-state="failed"]')?.textContent).toContain(
      'استغرق التحميل وقتاً طويلاً فتم إيقافه.',
    );
  });
});

describe('a record may keep its tab row to one line on a phone', () => {
  const record = (oneRow: boolean) =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <RecordPage
          back={{ href: '/partners', label: 'Back' }}
          title="Made-up Org"
          tabs={['overview', 'discussion', 'codes', 'finance', 'history', 'related'].map((key) => ({
            key,
            label: key,
          }))}
          tab="overview"
          tabHref={(k) => `/partners/made-up-org?tab=${k}`}
          tabsOneRow={oneRow}
          words={{ tabs: 'Sections', notMeasured: 'Not measured' }}
        >
          <p>made-up body</p>
        </RecordPage>
      </NextIntlClientProvider>,
    );
  it('with it, the row does not wrap on a phone and scrolls inside itself', () => {
    const html = record(true);
    expect(html).toContain('max-sm:[&amp;_[data-tabs]]:flex-nowrap');
    expect(html).toContain('data-tabs-one-row');
    expect(html, 'the row is still the scroller').toMatch(/<nav[^>]*class="[^"]*overflow-x-auto[^"]*"[^>]*data-tabs/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it('without it, a record’s row is as it was', () => {
    const html = record(false);
    expect(html).not.toContain('flex-nowrap');
    expect(html).not.toContain('data-tabs-one-row');
  });
});
