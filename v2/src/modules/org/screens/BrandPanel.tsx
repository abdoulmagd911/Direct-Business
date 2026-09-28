import { useLocale, useTranslations } from 'next-intl';
import { BrandLogo } from '@/ui/BrandLogo';

/**
 * The sign-in brand panel (owner, 28 Sep): Direct slate, the white logo, the tagline, and one quiet
 * flight-path pattern — the single bold element of the page. Sits at the inline start (left in
 * English, right in Arabic) on wide screens and as a band on top on a phone.
 */
export function BrandPanel() {
  const t = useTranslations('signIn');
  const locale = useLocale();
  return (
    <aside
      className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-nav-bg px-8 py-8 text-nav-text md:w-[46%] md:max-w-[640px] md:px-14 md:py-12"
      data-brand-panel
    >
      <FlightPaths />
      <div className="relative">
        <BrandLogo variant="on-dark" height={40} />
      </div>
      <div className="relative mt-10 flex flex-col items-start gap-3 md:mb-16 md:mt-auto">
        <p className="max-w-[22ch] font-display text-2xl font-medium leading-snug text-nav-active-text md:text-3xl">
          {t('tagline')}
        </p>
        <p
          lang={locale === 'ar' ? 'en' : 'ar'}
          dir={locale === 'ar' ? 'ltr' : 'rtl'}
          className="max-w-[32ch] text-end text-base text-nav-muted md:text-lg"
        >
          {locale === 'ar' ? 'The commercial arm of the all-in-one travel app' : 'الذراع التجاري لتطبيق السفر الشامل'}
        </p>
      </div>
      <p className="relative hidden text-sm text-nav-muted md:block">{t('footer')}</p>
    </aside>
  );
}

/** Great-circle-like arcs and a few waypoints, drawn in the nav text colour at low opacity. Decorative. */
function FlightPaths() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-nav-text"
      viewBox="0 0 640 1000"
      preserveAspectRatio="xMidYMin slice"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="1" strokeDasharray="3 7" opacity="0.28">
        <path d="M-40 520 C 120 330, 300 290, 700 60" />
        <path d="M-60 640 C 140 470, 360 470, 720 220" />
        <path d="M-20 240 C 160 140, 340 200, 700 -20" />
      </g>
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.5" className="hidden md:block">
        <path d="M40 450 C 200 300, 380 260, 600 120" />
      </g>
      <g fill="currentColor" opacity="0.7" className="hidden md:block">
        <circle cx="40" cy="450" r="3.5" />
        <circle cx="318" cy="284" r="3.5" />
        <circle cx="600" cy="120" r="3.5" />
      </g>
      <path
        d="M304 276 L330 284 L304 292 L311 284 Z"
        fill="var(--nav-mark)"
        opacity="0.95"
        transform="rotate(-33 318 284)"
        className="hidden md:block"
      />
    </svg>
  );
}
