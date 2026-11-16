'use client';
import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { setPref } from '@/core/prefs';
import { BrandLogo } from '@/ui/BrandLogo';

/**
 * The door frame (the V21 board "Sign-in · layout A", Landing 31): the pages outside the shell — sign in, choose a new
 * password. At 1024 px and wider a slate panel at the inline start, 36% wide (360–560 px), holding only the logo,
 * centred both ways — no text, no art. Below 1024 px the panel becomes a slate band with the logo at the start and
 * the language button at the end. Beside it the page: the language button at the end of the top row, then a white card
 * (480 px, 20 px corners, a soft shadow) centred both ways, and the footer under it. The door follows the theme — the
 * one last used on this device, or the device's own on a first visit. The language button always shows on the door
 * (F205): nobody is signed in here, so the cookie stands whatever the Arabic switch says; in-app Arabic stays gated
 * (ACC-139).
 */
export function DoorFrame({
  children,
  footer,
  ...rest
}: {
  children: ReactNode;
  footer?: ReactNode;
  [key: `data-${string}`]: unknown;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const other = locale === 'ar' ? 'en' : 'ar';
  const language = (
    <button
      type="button"
      lang={other}
      dir={other === 'ar' ? 'rtl' : 'ltr'}
      onClick={() => {
        setPref('locale', other);
        window.location.reload();
      }}
      className="door-language inline-flex h-11 min-w-11 items-center justify-center gap-2 px-3.5 text-sm font-semibold sm:h-8"
      data-door-language
    >
      <Globe className="size-4" aria-hidden="true" />
      {other === 'ar' ? 'العربية' : 'English'}
    </button>
  );
  return (
    <div className="door flex min-h-dvh flex-col lg:flex-row" {...rest}>
      <aside
        className="door-panel hidden w-[36%] min-w-[360px] max-w-[560px] shrink-0 items-center justify-center p-14 lg:flex"
        data-brand-panel
      >
        <BrandLogo variant="on-dark" height={48} label={t('app.brand')} />
      </aside>
      <header
        className="door-panel flex h-[60px] shrink-0 items-center justify-between px-4 sm:h-[88px] sm:px-6 lg:hidden"
        data-door-bar
      >
        <BrandLogo variant="on-dark" height={24} label={t('app.brand')} />
        {language}
      </header>
      <main className="door-page flex min-w-0 flex-1 flex-col px-4 pb-6 pt-7 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="hidden justify-end lg:flex">{language}</div>
        <div
          className="door-card door-column m-auto flex w-full max-w-[480px] flex-col gap-5 px-5 py-6 sm:gap-[22px] sm:p-10"
          data-door-card
        >
          {children}
        </div>
        <p className="door-footer pt-6 text-center text-xs leading-[18px]">{footer}</p>
      </main>
    </div>
  );
}
