/**
 * Landing 31 — the Settings menu in the new look (boards settings-pc-*, x-ph-settings-*). Every group is a link with
 * its own line icon in a peach circle; the open one is marked; a person who is not an admin is listed only what opens
 * for them (Finance, for the credit limit); the phone's one list carries what each group holds and a chevron; and only
 * a phone's browser gets that list at the Settings address. Every value is made up.
 * Sabotages: tests/sabotage/landing-31-settings.mjs.
 */
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { settingsGroups } from '../../../src/modules/settings/groups';
import { isPhoneBrowser, settingsIcon } from '../../../src/modules/settings/menu';

const word = (key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], en) as string;
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => word(k) }));
vi.mock('@/ui/shell/Page', () => ({ Page: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/ui/PageHeader', () => ({ PageHeader: ({ title }: { title: ReactNode }) => <h1>{title}</h1> }));
vi.mock('@/ui/LinkPending', () => ({ LinkPending: () => null }));

const { SettingsShell } = await import('../../../src/modules/settings/screens/SettingsShell');
const { SettingsMenuList } = await import('../../../src/modules/settings/screens/SettingsMenuList');

const groups = settingsGroups();
/** Each link of the menu: its group, its markup. */
const links = (html: string, hook: string) =>
  [...html.matchAll(new RegExp(`<a[^>]*${hook}="([^"]+)"[^>]*>(.*?)</a>`, 'g'))].map((m) => ({
    slug: m[1]!,
    tag: m[0].slice(0, m[0].indexOf('>') + 1),
    inner: m[2]!,
  }));

describe('the Settings menu beside the page', () => {
  it('draws every group as a link, each with its icon in a peach circle', async () => {
    const html = renderToStaticMarkup(await SettingsShell({ current: 'org', title: 'People', children: null }));
    const menu = links(html, 'data-settings-group');
    expect(menu.map((l) => l.slug)).toEqual(groups.map((g) => g.slug));
    expect(menu.length).toBeGreaterThanOrEqual(6);
    for (const l of menu) {
      expect(l.inner, l.slug).toMatch(/<span[^>]*bg-accent-soft[^>]*text-accent-ink[^>]*data-settings-icon[^>]*><svg/);
      expect(l.tag, l.slug).toContain(`href="/settings/${l.slug}"`);
      expect(l.inner, l.slug).toContain(word(groups.find((g) => g.slug === l.slug)!.label).replace('&', '&amp;'));
    }
  });
  it('gives each group an icon of its own — none falls back to the plain circle', () => {
    const icons = groups.map((g) => settingsIcon(g.slug));
    expect(new Set(icons).size).toBe(groups.length);
    for (const g of groups) expect(settingsIcon(g.slug), g.slug).not.toBe(settingsIcon('no-such-group'));
  });
  it('marks the open group, and only that one', async () => {
    const html = renderToStaticMarkup(await SettingsShell({ current: 'finance', title: 'Finance', children: null }));
    const open = links(html, 'data-settings-group').filter((l) => l.tag.includes('aria-current="page"'));
    expect(open.map((l) => l.slug)).toEqual(['finance']);
    expect(open[0]!.tag).toContain('ring-sel');
  });
  it('is a wrapped row of pills a finger tall on a phone, and a column from 1,280 px', async () => {
    const html = renderToStaticMarkup(await SettingsShell({ current: 'org', title: 'People', children: null }));
    const nav = html.match(/<nav[^>]*data-settings-groups[^>]*>/)![0];
    expect(nav).toContain('flex-wrap');
    expect(nav).toContain('xl:flex-col');
    for (const l of links(html, 'data-settings-group')) {
      expect(l.tag).toContain('min-h-11');
      expect(l.tag).toContain('rounded-pill');
    }
  });
  it('lists only what opens for someone who is not an admin', async () => {
    const html = renderToStaticMarkup(
      await SettingsShell({ current: 'finance', title: 'Finance', only: ['finance'], children: null }),
    );
    expect(links(html, 'data-settings-group').map((l) => l.slug)).toEqual(['finance']);
  });
  it('keeps the content right after the menu, tables at the whole width', async () => {
    const html = renderToStaticMarkup(
      await SettingsShell({ current: 'org', title: 'People', children: <p data-made-up>made up</p> }),
    );
    expect(html).toMatch(/<\/nav><div class="[^"]*\[&amp;&gt;\[data-wide\]\]:max-w-none[^"]*"><p data-made-up/);
  });
});

describe('the one list on a phone', () => {
  it('is a row per group: icon, name, what it holds, a chevron that follows the reading direction', async () => {
    const html = renderToStaticMarkup(await SettingsMenuList({ groups, holds: { org: 10, finance: 'Credit limit' } }));
    const rows = links(html, 'data-settings-menu-row');
    expect(rows.map((r) => r.slug)).toEqual(groups.map((g) => g.slug));
    for (const r of rows) {
      expect(r.inner, r.slug).toMatch(/data-settings-icon[^>]*><svg/);
      expect(r.tag, `${r.slug} is a finger tall`).toContain('min-h-14');
      expect(r.inner, r.slug).toContain('rtl:-scale-x-100');
    }
    const holds = (slug: string) =>
      rows.find((r) => r.slug === slug)!.inner.match(/data-settings-menu-holds[^>]*>([^<]*)</)?.[1];
    expect(holds('org')).toBe('10');
    expect(holds('finance')).toBe('Credit limit');
    expect(holds('app'), 'a group with nothing to count says nothing').toBeUndefined();
  });
});

describe('who gets the list at the Settings address', () => {
  it('a phone does; a computer, a tablet and an unknown browser open People & access', () => {
    expect(
      isPhoneBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),
    ).toBe(true);
    expect(
      isPhoneBrowser('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'),
    ).toBe(true);
    expect(
      isPhoneBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'),
    ).toBe(false);
    expect(isPhoneBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBe(
      false,
    );
    expect(isPhoneBrowser(null)).toBe(false);
    expect(isPhoneBrowser(undefined)).toBe(false);
  });
});
