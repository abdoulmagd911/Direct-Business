'use client';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/ui/BrandLogo';
import { CrashBody } from '@/ui/CrashBody';

/**
 * The frame itself could not load (QA-184): the app layout reads the person and the settings before any page, and when
 * the data API is down or times out that read fails above `(app)/error.tsx`. This boundary sits inside the root
 * layout, so the app font, the theme and the words are there; there is no drawer — the drawer needs the person.
 */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-text" data-root-error>
      <div className="flex w-full max-w-[520px] flex-col gap-5">
        <BrandLogo height={28} />
        <h1 className="font-display text-2xl font-semibold">{t('errors.crash.title')}</h1>
        <CrashBody reset={reset} body="bodyNoData" />
      </div>
    </main>
  );
}
