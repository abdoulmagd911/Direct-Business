'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/ui/BrandLogo';
import { DataState } from '@/ui/DataState';

/**
 * The app frame's own read failed transiently (the person could not be read: the gateway held it and gave up).
 * A retryable state inside the root layout — the drawer and the page both need the person, so there is no shell to
 * draw — instead of the root crash page (F131/F163). Try again asks the server again (router.refresh re-runs the
 * layout's read); there is no Go to My day here, because My day's own layout would fail the same way while the
 * data is unreachable.
 */
export function LayoutTransient() {
  const t = useTranslations();
  const router = useRouter();
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-text" data-layout-transient>
      <div className="flex w-full max-w-[520px] flex-col gap-5">
        <BrandLogo height={28} />
        <DataState
          kind="failed"
          message={t('errors.crash.bodyNoData')}
          onRetry={() => router.refresh()}
          retryLabel={t('common.tryAgain')}
        />
      </div>
    </main>
  );
}
