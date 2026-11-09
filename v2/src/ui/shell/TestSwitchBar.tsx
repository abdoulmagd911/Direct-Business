'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useMaybeMe } from '@/core/auth/me-context';
import type { Me } from '@/core/auth/me';
import { useTestSwitch } from '@/core/test-switch/use-test-switch';
import { Button } from '../Button';

/** "TEST user: [name] (you are [owner name])" in the language of the screen. The test user's name is always the English
 * name: a test account is named in English, and its stored Arabic name is a translation of that proper name, never
 * used (F212/U2). The owner's name is a real person's name, so it follows the screen's language. */
export function testSwitchNames(me: Me, locale: 'en' | 'ar') {
  const by = me.test_switch;
  const ar = locale === 'ar';
  return {
    name: me.person.full_name_en,
    owner: by ? (ar && by.by_name_ar) || by.by_name_en : '',
  };
}

/** The bar itself, drawn from words and one press: kept apart so a test can look at it without the session. */
export function TestSwitchBarView({
  line,
  back,
  onBack,
  busy,
}: {
  line: string;
  back: string;
  onBack: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-warning-soft px-4 py-2 text-sm font-medium text-warning"
      data-test-switch-bar
    >
      <span className="min-w-0 [overflow-wrap:break-word]" data-test-switch-line>
        {line}
      </span>
      <Button onClick={onBack} disabled={busy} data-test-switch-back>
        {back}
      </Button>
    </div>
  );
}

/**
 * The bar at the top of every page while this device is switched to a TEST user (V656): api.me() says so in
 * `test_switch`. Back to my account calls api.test_switch_end and starts the app over as the owner.
 */
export function TestSwitchBar() {
  const me = useMaybeMe();
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const sw = useTestSwitch();
  if (!me?.test_switch) return null;
  return (
    <TestSwitchBarView
      line={t('testSwitch.bar', testSwitchNames(me, locale))}
      back={t('testSwitch.back')}
      onBack={() => void sw.end()}
      busy={sw.busy}
    />
  );
}
