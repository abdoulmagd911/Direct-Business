// @vitest-environment jsdom
/**
 * Email and role are facts on /profile (FIX-20 F208): they render in both languages, unconditionally — never keyed
 * on the locale, never gated by role. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { ProfileFacts } from '../../../src/modules/org/screens/MyProfile';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
// the screen's password section is a server action: keep it out of this render test
vi.mock('@/core/auth/password-actions', () => ({ changePassword: vi.fn() }));

const me = {
  session: { email: 'made.up@example.test' },
  person: {
    role: { key: 'manager', name_en: 'Manager', name_ar: 'مدير', is_admin: false },
  },
} as unknown as Me;

const html = (locale: 'en' | 'ar') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      <ProfileFacts me={me} />
    </NextIntlClientProvider>,
  );

describe('profile shows email and role', () => {
  it('shows both in English', () => {
    const out = html('en');
    expect(out).toContain('Email');
    expect(out).toContain('made.up@example.test');
    expect(out).toContain('Role');
    expect(out).toContain('Manager');
  });

  it('shows both in Arabic, with the Arabic role name', () => {
    const out = html('ar');
    expect(out).toContain('البريد الإلكتروني');
    expect(out).toContain('made.up@example.test');
    expect(out).toContain('الدور');
    expect(out).toContain('مدير');
  });
});
