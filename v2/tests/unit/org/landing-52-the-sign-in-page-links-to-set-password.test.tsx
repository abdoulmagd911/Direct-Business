// @vitest-environment jsdom
/**
 * Landing 52 (FIX-19, the F1 live re-test of 25 Nov): the sign-in page had no set-password link — only the plain
 * line "Forgot your password? Ask your admin.". Now the door carries one real link under that line, to
 * /set-password; that page is open to a visitor who is not signed in (the gate lets it through), and its first step
 * is the same form worded for a temporary password — "Temporary password", "Continue", "Back to sign in" — sent to
 * the sign-in door's own server check. The language button and the rest of the door are not touched. In English
 * and in Arabic. Every value is made up.
 * Sabotage: tests/sabotage/landing-52.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { isPublicPath } from '../../../src/core/db/proxy-session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));
vi.mock('@/core/auth/password-actions', () => ({ signInWithPassword: signInMock }));
vi.mock('@/core/auth/actions', () => ({ sendCode: vi.fn(), verifyCode: vi.fn() }));
vi.mock('@/core/prefs', () => ({ setPref: vi.fn() }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { SignIn } = await import('../../../src/modules/org/screens/SignIn');
const { SetPasswordStart } = await import('../../../src/modules/org/screens/SetPasswordStart');

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  signInMock.mockReset();
});

const draw = (what: React.ReactNode, locale: 'en' | 'ar' = 'en') => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
        {what}
      </NextIntlClientProvider>,
    );
  });
};

const type = (selector: string, value: string) => {
  const box = document.querySelector(selector) as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(box, value);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('the sign-in page links to set-password (Landing 52, FIX-19)', () => {
  it('the door carries a real link to /set-password, under the unchanged "Ask your admin" line', () => {
    draw(<SignIn next={null} refusal={null} />);
    const link = document.querySelector('[data-door-set-password]') as HTMLAnchorElement | null;
    expect(link, 'the sign-in page has a set-password link').not.toBeNull();
    expect(link!.tagName, 'a real link, not plain text').toBe('A');
    expect(link!.getAttribute('href')).toBe('/set-password');
    expect(link!.textContent).toBe('Have a temporary password? Set your password');
    expect(document.body.textContent, 'the line above it stays').toContain('Forgot your password? Ask your admin.');
    // what the door had is still there: the two boxes, Sign in, the language button
    expect(document.querySelector('input[name="email"]')).not.toBeNull();
    expect(document.querySelector('input[name="password"]')).not.toBeNull();
    expect(document.querySelector('[data-door="password"]')?.textContent).toBe('Sign in');
    expect(document.querySelector('[data-door-language]')?.textContent).toContain('العربية');
  });

  it('in Arabic the link is in Arabic', () => {
    draw(<SignIn next={null} refusal={null} />, 'ar');
    const link = document.querySelector('[data-door-set-password]');
    expect(link?.textContent).toBe('لديك كلمة مرور مؤقتة؟ عيّن كلمة مرورك');
    expect(link?.getAttribute('href')).toBe('/set-password');
  });

  it('the gate lets a signed-out visitor reach /set-password — and nothing else new', () => {
    expect(isPublicPath('/set-password'), 'the link leads to a page, not back to sign-in').toBe(true);
    expect(isPublicPath('/sign-in')).toBe(true);
    for (const closed of ['/set-password/x', '/set-passwords', '/my-day', '/settings', '/recently-deleted', '/'])
      expect(isPublicPath(closed), `${closed} still needs a sign-in`).toBe(false);
  });

  it('the page it leads to asks for the work email and the temporary password, and goes back to sign in', () => {
    draw(<SetPasswordStart next={null} />);
    expect(document.querySelector('h1')?.textContent).toBe('Set your password');
    expect(document.body.textContent).toContain(
      'Sign in with your work email and the temporary password from your admin. Then you choose your own.',
    );
    const box = document.querySelector('input[name="password"]') as HTMLInputElement;
    expect(document.querySelector(`label[for="${box.id}"]`)?.textContent).toBe('Temporary password');
    expect(document.querySelector('[data-door="temporary-password"]')?.textContent).toBe('Continue');
    const back = document.querySelector('[data-door-back]') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/sign-in');
    expect(back.textContent).toBe('Back to sign in');
    expect(document.querySelector('[data-door-set-password]'), 'no link to itself').toBeNull();
  });

  it('Continue sends the email and the temporary password to the sign-in door’s own server check', async () => {
    signInMock.mockResolvedValue({ ok: false, error: 'wrong_password' });
    draw(<SetPasswordStart next={null} />);
    type('input[name="email"]', 'made.up@example.test');
    type('input[name="password"]', 'Made-up-temporary-1');
    await act(async () => {
      (document.querySelector('form') as HTMLFormElement).dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    expect(signInMock).toHaveBeenCalledWith('made.up@example.test', 'Made-up-temporary-1', null);
    expect(document.querySelector('[data-door-alert]')?.textContent, 'a refusal is said in words').toContain(
      "That email and password don't match.",
    );
  });
});
