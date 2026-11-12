/**
 * F-B3-01: the /files page renders the filter bar once per breakpoint — one wide form, one phone form.
 * The two forms are siblings, and the same key on both broke React reconciliation and piled up extra
 * filter bars across soft navigations; each form now carries its own key. The accumulation itself only
 * shows across navigations in a browser, so this pins the shape it must keep: the two forms carry
 * different keys, and a render holds exactly two forms, one wide and one phone. Made-up values.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';

vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => ({ levels: {} })) }));
vi.mock('@/core/db/server-rpc', () => ({ serverRpc: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => 'en',
}));
// the page shell is async — a passthrough is all this shape test needs from it.
vi.mock('@/ui/shell/Page', () => ({ Page: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
// next/link suspends without the app router — a plain anchor is all this shape test needs.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { serverRpc } from '@/core/db/server-rpc';
import { FilesArchivePage } from '../../../src/modules/partners/screens/files-archive-page';

const draw = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

const answer = (rows: unknown[] = [], total = 0) => ({
  rows,
  total,
  facets: { purposes: [], statuses: [], sides: [] },
  uploaders: [],
});

const setup = () => {
  (serverRpc as unknown as { mockImplementation: (fn: (name: string) => unknown) => void }).mockImplementation(
    (name: string) => {
      if (name === 'all_files') return Promise.resolve(answer());
      if (name === 'list') return Promise.resolve([]);
      return Promise.resolve(null);
    },
  );
};

const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

/** Every form element in a rendered element tree, with its key. */
const forms = (el: React.ReactNode, out: { key: string | null }[] = []): { key: string | null }[] => {
  if (Array.isArray(el)) {
    for (const child of el) forms(child, out);
    return out;
  }
  if (el && typeof el === 'object' && 'type' in el) {
    const node = el as { type: unknown; key: string | null; props?: { children?: React.ReactNode } };
    if (node.type === 'form') out.push({ key: node.key });
    forms(node.props?.children, out);
  }
  return out;
};

describe('the /files page renders one filter bar per breakpoint (F-B3-01)', () => {
  it('keys the two sibling forms differently, so reconciliation cannot pile up bars', async () => {
    setup();
    const el = await FilesArchivePage({ searchParams: Promise.resolve({}) });
    const found = forms(el);
    expect(found).toHaveLength(2);
    expect(new Set(found.map((f) => f.key)).size).toBe(2);
    expect(found.map((f) => f.key).sort()).toEqual(['{}:phone', '{}:wide']);
  });

  it('renders exactly two forms — one wide, one phone — each with its own search box', async () => {
    setup();
    const html = draw(await FilesArchivePage({ searchParams: Promise.resolve({}) }));
    expect(count(html, /<form/g)).toBe(2);
    expect(count(html, /mb-4 hidden flex-col gap-3 sm:flex/g)).toBe(1);
    expect(count(html, /mb-4 flex flex-col gap-3 sm:hidden/g)).toBe(1);
    expect(count(html, /name="q"/g)).toBe(2);
  });

  it('with filters set, Clear filters appears once per form and no third bar', async () => {
    setup();
    const html = draw(await FilesArchivePage({ searchParams: Promise.resolve({ q: 'proof' }) }));
    expect(count(html, /<form/g)).toBe(2);
    expect(count(html, /partners\.archive\.clearFilters/g)).toBe(2);
    expect(count(html, /name="q"/g)).toBe(2);
  });
});
