'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buttonVariants, Button } from '@/ui/Button';
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
      <div
        role="alert"
        data-state="crashed"
        className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5"
      >
        <p className="text-base text-text">{t('errors.crash.body')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={reset} data-crash-retry>
            {t('common.tryAgain')}
          </Button>
          <Link href="/my-day" className={buttonVariants({ variant: 'secondary', size: 'md' })} data-crash-home>
            {t('errors.crash.goMyDay')}
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
