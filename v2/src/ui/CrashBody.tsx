'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Button, buttonVariants } from './Button';

/**
 * What a crash says, wherever it is caught (V216 item 11, QA-164, QA-184): the app's words in the app font, Try again
 * — which asks the server again as well, so a page whose data could not be read gets a fresh read — and Go to My day.
 * Never the raw error. `body` picks the sentence: a screen that could not be drawn, or the app that could not reach
 * its data (the frame itself failed: the person or the settings could not be read).
 */
export function CrashBody({ reset, body = 'body' }: { reset: () => void; body?: 'body' | 'bodyNoData' }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div
      role="alert"
      data-state="crashed"
      className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5"
    >
      <p className="text-base text-text">{t(`errors.crash.${body}`)}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          loading={pending}
          onClick={() =>
            start(() => {
              router.refresh();
              reset();
            })
          }
          data-crash-retry
        >
          {t('common.tryAgain')}
        </Button>
        <Link href="/my-day" className={buttonVariants({ variant: 'secondary', size: 'md' })} data-crash-home>
          {t('errors.crash.goMyDay')}
        </Link>
      </div>
    </div>
  );
}
