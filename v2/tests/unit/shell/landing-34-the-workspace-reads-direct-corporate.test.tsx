/**
 * Landing 34, items 33 and 36–38 (the 19 Nov test round): the workspace reads "Direct Corporate". The tab says
 * "<Page> · Direct Corporate", sign-in says "Sign in · Direct Corporate Workspace" and "© 2026 Direct Corporate", the
 * heading is "Direct Corporate" with the Workspace pill, and beside the Direct wordmark — the artwork, untouched — the
 * word "Corporate" is TEXT: in the drawer, on the door, and now on the phone's top bar, which had no logo at all. In
 * Arabic the wordmark stays and the name is «دايركت للشركات». On a phone the sign-in card sits under the band, not in
 * the middle of what is left.
 * Sabotage: tests/sabotage/landing-34-shell.mjs.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const locale = vi.hoisted(() => ({ current: 'en' as 'en' | 'ar' }));
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', async () => {
  const { createTranslator: make } = await import('next-intl');
  const catalogs = {
    en: (await import('../../../messages/en.json')).default,
    ar: (await import('../../../messages/ar.json')).default,
  };
  return {
    getTranslations: async () => make({ locale: locale.current, messages: catalogs[locale.current] }),
    getLocale: async () => locale.current,
    getMessages: async () => catalogs[locale.current],
  };
});
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/my-day',
}));
vi.mock('@/ui/fonts', () => ({ fontClassNames: '' }));
vi.mock('@/core/auth/get-me', () => ({ getMe: async () => null }));
vi.mock('@/core/settings/app', () => ({ getAppSettings: async () => ({}) }));
vi.mock('@/core/auth/Hydrated', () => ({ Hydrated: () => null }));
vi.mock('@/ui/shell/CreateMenu', () => ({ CreateMenu: () => null }));
vi.mock('@/ui/shell/ProfileMenu', () => ({ ProfileMenu: () => <button data-profile-chip /> }));
vi.mock('@/core/prefs', async (original) => ({ ...(await original<object>()), setPref: () => {} }));

const { generateMetadata } = await import('../../../src/app/layout');
const { generateMetadata: signInMetadata } = await import('../../../src/app/(auth)/sign-in/page');
const { BrandLockup } = await import('../../../src/ui/BrandLogo');
const { TopBar } = await import('../../../src/ui/shell/TopBar');
const { DoorFrame } = await import('../../../src/modules/org/screens/DoorFrame');

const t = (l: 'en' | 'ar') => createTranslator({ locale: l, messages: l === 'en' ? en : ar });
const words = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const within = (l: 'en' | 'ar', node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={l} messages={l === 'en' ? en : ar} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

describe('the tab title', () => {
  it('is "<Page> · Direct Corporate", and "Direct Corporate" alone where a page names none', async () => {
    locale.current = 'en';
    expect((await generateMetadata()).title).toEqual({
      default: 'Direct Corporate',
      template: '%s · Direct Corporate',
    });
  });
  it('is the workspace’s Arabic name in Arabic', async () => {
    locale.current = 'ar';
    expect((await generateMetadata()).title).toEqual({ default: 'دايركت للشركات', template: '%s · دايركت للشركات' });
  });
  it('on sign-in is "Sign in · Direct Corporate Workspace"', async () => {
    locale.current = 'en';
    expect((await signInMetadata()).title).toEqual({ absolute: 'Sign in · Direct Corporate Workspace' });
    locale.current = 'ar';
    expect((await signInMetadata()).title).toEqual({ absolute: 'تسجيل الدخول · مساحة عمل دايركت للشركات' });
  });
});

describe('the words', () => {
  it('the footer is "© 2026 Direct Corporate"', () => {
    expect(t('en')('sign_in.footer', { year: 2026 })).toBe('© 2026 Direct Corporate');
    expect(t('ar')('sign_in.footer', { year: 2026 })).toBe('© 2026 دايركت للشركات');
  });
  it('the sign-in heading is "Direct Corporate" and the Workspace pill, named whole to a screen reader', () => {
    expect(t('en')('sign_in.heading.lead')).toBe('Direct Corporate');
    expect(t('en')('sign_in.heading.pill')).toBe('Workspace');
    expect(t('en')('app.name')).toBe('Direct Corporate Workspace');
    expect(t('ar')('sign_in.heading.lead')).toBe('دايركت للشركات');
    expect(t('ar')('app.name')).toBe('مساحة عمل دايركت للشركات');
  });
  it('nothing the app says still calls the workspace "Commercial Workspace"', () => {
    expect(JSON.stringify(en)).not.toContain('Commercial Workspace');
    expect(JSON.stringify(ar)).not.toContain('Commercial Workspace');
    expect(JSON.stringify(ar)).not.toContain('مساحة العمل التجارية');
  });
});

describe('the wordmark and the word beside it', () => {
  it('the Direct wordmark artwork is the same two files, unchanged', () => {
    const sum = (f: string) =>
      createHash('sha256')
        .update(readFileSync(`public/brand/${f}`))
        .digest('hex');
    expect(sum('direct-logo.svg')).toBe('e37443e1d77e7fd552eb823b395f6cd6a3c7c10ab0b1b1aa77468dfe9616b69e');
    expect(sum('direct-logo-on-dark.svg')).toBe('12b8573f0ef70bbdebb9a5c0f597d0c02b3279a4a36861fa6c80f49d4d46eb3d');
  });
  it('draws the wordmark image, then "Corporate" as text — never smaller than 12 px', () => {
    const html = renderToStaticMarkup(<BrandLockup variant="on-dark" height={26} word="Corporate" />);
    expect(html).toContain('src="/brand/direct-logo-on-dark.svg"');
    expect(html).toContain('alt="Direct"');
    expect(html).toMatch(/data-brand-word="true">Corporate</);
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('data-brand-word'));
    expect(renderToStaticMarkup(<BrandLockup height={12} word="Corporate" />)).toContain('font-size:12px');
  });
  it('on a ground that follows the theme, the white wordmark shows on every dark theme', () => {
    const html = renderToStaticMarkup(<BrandLockup word="Corporate" />).replaceAll('&amp;', '&');
    for (const theme of ['dark', 'turquoise']) expect(html).toContain(`[[data-theme=${theme}]_&]:block`);
    expect(html).toContain('[@media(prefers-color-scheme:dark)]:[[data-theme=system]_&]:block');
  });
});

describe('the phone’s top bar (item 37)', () => {
  const bar = (l: 'en' | 'ar') => within(l, <TopBar onOpenSearch={() => {}} />);
  it('starts with the wordmark and "Corporate", a way to My day, shown under 640 px only', () => {
    const html = bar('en');
    const brand = /<a[^>]*data-top-brand[^>]*>.*?<\/a>/s.exec(html)?.[0] ?? '';
    expect(brand).toContain('href="/my-day"');
    expect(brand).toContain('aria-label="My day"');
    expect(brand).toContain('sm:hidden');
    expect(brand, 'a 44 px tap target that never shrinks').toMatch(/class="[^"]*\bh-11\b[^"]*\bshrink-0\b/);
    expect(brand).toContain('/brand/direct-logo.svg');
    expect(words(brand)).toBe('Corporate');
    expect(html.indexOf('data-top-brand')).toBeLessThan(html.indexOf('data-search'));
  });
  it('the search still says Search beside it, and gives way (it can shrink; the logo cannot)', () => {
    const html = bar('en');
    const search = /<button[^>]*data-search[^>]*>.*?<\/button>/s.exec(html)?.[0] ?? '';
    expect(search).toMatch(/class="[^"]*\bh-11\b[^"]*\bmin-w-0\b[^"]*\bflex-1\b/);
    expect(words(search)).toContain('Search');
  });
  it('in Arabic the wordmark stays and the word is «للشركات»', () => {
    const brand = /<a[^>]*data-top-brand[^>]*>.*?<\/a>/s.exec(bar('ar'))?.[0] ?? '';
    expect(brand).toContain('/brand/direct-logo.svg');
    expect(words(brand)).toBe('للشركات');
  });
});

describe('the door (sign in)', () => {
  const door = within(
    'en',
    <DoorFrame footer="© 2026 Direct Corporate">
      <p>form</p>
    </DoorFrame>,
  );
  it('shows the wordmark with "Corporate" on the wide panel and on the phone’s band', () => {
    const panel = /<aside[^>]*data-brand-panel.*?<\/aside>/s.exec(door)?.[0] ?? '';
    const band = /<header[^>]*data-door-bar.*?<\/header>/s.exec(door)?.[0] ?? '';
    for (const part of [panel, band]) {
      expect(part).toContain('/brand/direct-logo-on-dark.svg');
      expect(part).toMatch(/data-brand-word="true">Corporate</);
    }
  });
  it('on a phone the card sits under the band; from 640 px it is centred both ways (item 33)', () => {
    const card = /<div[^>]*data-door-card[^>]*>/.exec(door)?.[0] ?? '';
    const classes = (/class="([^"]*)"/.exec(card)?.[1] ?? '').split(/\s+/);
    expect(classes, 'not centred in the height on a phone').not.toContain('m-auto');
    expect(classes).toEqual(expect.arrayContaining(['mx-auto', 'mb-auto', 'sm:my-auto']));
    const main = /<main[^>]*>/.exec(door)?.[0] ?? '';
    expect(main, '20 px under the band').toMatch(/\bpt-5\b/);
  });
});
