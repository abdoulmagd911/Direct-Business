// @vitest-environment jsdom
/**
 * Landing 31 · the theme switcher (rules board): five themes — Light, Dark, Direct, Turquoise (opt-in) and System — in
 * three places (My profile → Look as five cards, the profile menu, the phone's sheet). A pick changes the screen at
 * once and is saved to the profile; a save that fails puts the screen back.
 * Sabotage: tests/sabotage/landing-31-themes.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ar from '../../../messages/ar.json';
import { saveTheme } from '../../../src/core/prefs/use-theme-choice';
import { ThemeCards, ThemeRows } from '../../../src/ui/ThemePicker';

const draw = (node: React.ReactNode, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar}>
      {node}
    </NextIntlClientProvider>,
  );
const dom = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const FIVE = ['light', 'dark', 'direct', 'turquoise', 'system'];

describe('the five theme cards in My profile → Look', () => {
  it('draws five cards in the boards’ order, one of them checked', () => {
    const d = dom(draw(<ThemeCards value="dark" onChange={() => {}} defaultTheme="light" />));
    const cards = [...d.querySelectorAll<HTMLElement>('[data-theme-card]')];
    expect(cards.map((c) => c.getAttribute('data-theme-card'))).toEqual(FIVE);
    expect(cards.filter((c) => c.getAttribute('aria-checked') === 'true').map((c) => c.dataset.themeCard)).toEqual([
      'dark',
    ]);
    expect(d.querySelector('[data-theme-cards]')!.getAttribute('role')).toBe('radiogroup');
  });
  it('marks Turquoise as opt-in and the admins’ default as Default, and nothing else', () => {
    const d = dom(draw(<ThemeCards value="light" onChange={() => {}} defaultTheme="light" />));
    const text = (k: string) => d.querySelector(`[data-theme-card="${k}"]`)!.textContent!;
    expect(text('turquoise')).toContain('Opt-in');
    expect(text('light')).toContain('Default');
    for (const k of ['dark', 'direct', 'system']) {
      expect(text(k)).not.toContain('Opt-in');
      expect(text(k)).not.toContain('Default');
    }
  });
  it('each card draws its own theme, whatever theme the app is in', () => {
    const d = dom(draw(<ThemeCards value="light" onChange={() => {}} />));
    for (const k of ['light', 'dark', 'direct', 'turquoise'])
      expect(d.querySelector(`[data-theme-card="${k}"] [data-theme="${k}"]`)).not.toBeNull();
    // System shows both halves
    expect(d.querySelector('[data-theme-card="system"] [data-theme="light"]')).not.toBeNull();
    expect(d.querySelector('[data-theme-card="system"] [data-theme="dark"]')).not.toBeNull();
  });
  it('has the boards’ words in Arabic', () => {
    const html = draw(<ThemeCards value="light" onChange={() => {}} />, 'ar');
    expect(html).toContain(ar.theme.turquoise);
    expect(html).toContain(ar.theme.system);
    expect(html).toContain(ar.themePicker.optIn);
  });
});

describe('the phone sheet’s five rows', () => {
  it('draws five rows with a line each, the current one checked', () => {
    const d = dom(draw(<ThemeRows value="system" onChange={() => {}} />));
    const rows = [...d.querySelectorAll<HTMLElement>('[data-theme-row]')];
    expect(rows.map((r) => r.dataset.themeRow)).toEqual(FIVE);
    expect(rows.find((r) => r.getAttribute('aria-checked') === 'true')!.dataset.themeRow).toBe('system');
    for (const k of FIVE)
      expect(d.querySelector(`[data-theme-row="${k}"]`)!.textContent).toContain(
        (en.themePicker.line as Record<string, string>)[k],
      );
  });
});

describe('a pick changes the screen at once and saves to the profile', () => {
  const io = (rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>) => ({
    apply: vi.fn(),
    rpc: vi.fn(rpc),
    refresh: vi.fn(),
    failed: vi.fn(),
  });
  it('applies first, then writes the profile at its current version', async () => {
    const order: string[] = [];
    const o = io(async (fn) => {
      order.push(fn);
      return fn === 'me' ? { status: 'ok', profile: { version: 7 } } : {};
    });
    o.apply.mockImplementation(() => order.push('apply'));
    expect(await saveTheme('turquoise', 'light', o)).toBe(true);
    expect(order).toEqual(['apply', 'me', 'profile_update']);
    expect(o.apply).toHaveBeenCalledWith('turquoise');
    expect(o.rpc).toHaveBeenLastCalledWith('profile_update', {
      p_changes: { theme: 'turquoise' },
      p_version: 7,
      p_person_version: undefined,
    });
    expect(o.refresh).toHaveBeenCalledTimes(1);
    expect(o.failed).not.toHaveBeenCalled();
  });
  it('a save that fails puts the screen back and says so', async () => {
    const o = io(async (fn) => {
      if (fn === 'profile_update') throw new Error('refused');
      return { status: 'ok', profile: { version: 1 } };
    });
    expect(await saveTheme('dark', 'direct', o)).toBe(false);
    expect(o.apply.mock.calls.map((c) => c[0])).toEqual(['dark', 'direct']);
    expect(o.failed).toHaveBeenCalledTimes(1);
    expect(o.refresh).not.toHaveBeenCalled();
  });
});
