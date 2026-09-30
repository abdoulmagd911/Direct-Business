'use client';
import { useTranslations } from 'next-intl';
import { CrashBody } from '@/ui/CrashBody';
import { PageHeader } from '@/ui/PageHeader';
import { PageFrame } from '@/ui/shell/AppShell';

/**
 * A screen that crashed while drawing (Next's error boundary inside the app layout, so the shell — drawer, top bar,
 * bottom bar — stays): the app's own words and buttons, Try again (draw it once more) and Go to My day.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <PageFrame>
      <PageHeader title={t('errors.crash.title')} />
      <CrashBody reset={reset} />
    </PageFrame>
  );
}
