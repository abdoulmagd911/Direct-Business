// @vitest-environment jsdom
/**
 * Change password says the mismatch as it is typed (FIX-20 F209, D36(e)): the message lives in the field's error
 * slot the moment the two new passwords differ, and Change stays off until they match. The server refuses the same
 * way on submit. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ session: { email: 'made.up@example.test' } }),
}));
vi.mock('@/core/auth/password-actions', () => ({ changePassword: vi.fn() }));

const { PasswordSection } = await import('../../../src/modules/org/screens/MyProfile');

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = (locale: 'en' | 'ar' = 'en') => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
        <PasswordSection />
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

const save = () => document.querySelector('[data-password-save]') as HTMLButtonElement;
const mismatch = () => document.querySelector('[role="alert"]')?.textContent ?? '';

describe('password mismatch is said as it is typed', () => {
  it('says the mismatch and keeps Change off while the two differ', () => {
    draw();
    type('[data-password-current]', 'current-password');
    type('[data-password-new]', 'abcdefghij');
    type('[data-password-again]', 'abcdefghik');
    expect(mismatch()).toContain(en.sign_in.password.error.mismatch);
    expect(save().disabled).toBe(true);
  });

  it('turns Change back on once the two match', () => {
    draw();
    type('[data-password-current]', 'current-password');
    type('[data-password-new]', 'abcdefghij');
    type('[data-password-again]', 'abcdefghik');
    type('[data-password-again]', 'abcdefghij');
    expect(mismatch()).not.toContain(en.sign_in.password.error.mismatch);
    expect(save().disabled).toBe(false);
  });

  it('says it in Arabic too', () => {
    draw('ar');
    type('[data-password-new]', 'abcdefghij');
    type('[data-password-again]', 'abcdefghik');
    expect(mismatch()).toContain(ar.sign_in.password.error.mismatch);
  });
});
