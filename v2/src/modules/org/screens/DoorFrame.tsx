'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { setPref } from '@/core/prefs';
import { BrandLogo } from '@/ui/BrandLogo';

/**
 * The door frame (the visual spec of 29 Sep, V213): the pages outside the shell — sign in, choose a new password.
 * At 1024 px and wider a flat slate panel at the inline start, 400 px, holding only the white logo (40 px, at 48/48)
 * and a 24×3 orange rule under it — no motif, no tagline, no copyright. Below 1024 px the panel is gone: a 56 px slate
 * bar with a 24 px logo and the language button, then the content with 16 px gutters. The content side is light
 * (`color-scheme: light`, its own `--door-*` tokens) whatever the person's theme, a 400 px column at the inline start,
 * its heading at max(96 px, 22 vh) — never vertically centred. The language button shows once Arabic is on (V122).
 */
export function DoorFrame({
  children,
  arabicEnabled = false,
  footer,
  ...rest
}: {
  children: ReactNode;
  arabicEnabled?: boolean;
  footer?: ReactNode;
  [key: `data-${string}`]: unknown;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const other = locale === 'ar' ? 'en' : 'ar';
  const language = arabicEnabled ? (
    <button
      type="button"
      lang={other}
      dir={other === 'ar' ? 'rtl' : 'ltr'}
      onClick={() => {
        setPref('locale', other);
        window.location.reload();
      }}
      className="door-language inline-flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-[15px] font-medium"
      data-door-language
    >
      {other === 'ar' ? 'العربية' : 'English'}
    </button>
  ) : null;
  return (
    <div className="door flex min-h-dvh flex-col lg:flex-row" {...rest}>
      <aside className="door-panel hidden w-[400px] shrink-0 lg:block" data-brand-panel>
        <div className="flex flex-col items-start gap-3 ps-12 pt-12">
          <BrandLogo variant="on-dark" height={40} label={t('app.brand')} />
          <span aria-hidden="true" className="door-rule block h-[3px] w-6 rounded-full" />
        </div>
      </aside>
      <header className="door-panel flex h-14 shrink-0 items-center justify-between px-4 lg:hidden" data-door-bar>
        <BrandLogo variant="on-dark" height={24} label={t('app.brand')} />
        {language}
      </header>
      <main className="door-page relative flex min-w-0 flex-1 flex-col px-4 pb-8 sm:px-12">
        {language ? <div className="absolute end-4 top-3 hidden lg:block">{language}</div> : null}
        <div className="door-column flex w-full max-w-[400px] flex-1 flex-col pt-[max(96px,22vh)]">
          {children}
          <p className="door-footer mt-auto pt-10 text-xs">{footer}</p>
        </div>
      </main>
    </div>
  );
}
