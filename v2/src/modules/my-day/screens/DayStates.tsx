'use client';
import { CircleAlert, Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition, type ReactNode } from 'react';
import { Button, buttonVariants } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { CrashBody } from '@/ui/CrashBody';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { dayHeading } from '../my-work';
import { DayBanner } from './DayBanner';
import { card, IconCircle } from './look';

/** My day itself, not a page under it (a note, the weekly review): only My day wears the banner. */
const onMyDay = (path: string | null) => (path ?? '').replace(/\/+$/, '') === '/my-day';

/**
 * My day while it is being read (the boards' loading state): the banner stays, with the day and a soft bar where the
 * count will be, and the cards below are soft bars. A page under My day shows the app's plain loading lines.
 */
export function DayLoading() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  if (!onMyDay(usePathname())) return <DataState kind="loading" message={t('common.loading')} />;
  return (
    <>
      <DayBanner heading={dayHeading(new Date(), locale)} loading />
      <DataState kind="loading" message={t('state.loading', { what: t('nav.my_day') })} className="gap-4">
        {[0, 1].map((i) => (
          <div key={i} className={cn(card, 'flex flex-col gap-4 py-4')} data-day-skeleton>
            <div className="flex items-center gap-3">
              <span className="shimmer size-[var(--icon-circle)] shrink-0 rounded-pill bg-pressed max-sm:size-8" />
              <span className="shimmer h-4 w-2/5 rounded-pill bg-pressed" />
            </div>
            {['w-3/5', 'w-1/2', 'w-2/3'].map((w) => (
              <div key={w} className="flex items-center gap-3">
                <span className="shimmer size-5 shrink-0 rounded-pill bg-pressed" />
                <span className={cn('shimmer h-3.5 rounded-pill bg-pressed', w)} />
              </div>
            ))}
          </div>
        ))}
      </DataState>
    </>
  );
}

/**
 * My day when it could not be drawn (the boards' error state): the banner with the day, then one card that says so
 * with Try again — which asks the server again as well, as the app's crash page does. A page under My day keeps the
 * app's own crash words.
 */
export function DayCrash({ reset }: { reset: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!onMyDay(usePathname()))
    return (
      <>
        <PageHeader title={t('errors.crash.title')} />
        <CrashBody reset={reset} />
      </>
    );
  return (
    <>
      <DayBanner heading={dayHeading(new Date(), locale)} />
      <div
        role="alert"
        data-state="crashed"
        className={cn(card, 'flex flex-col items-center gap-4 px-6 py-14 text-center max-sm:px-4 max-sm:py-10')}
      >
        <p className="flex items-center gap-2 font-display text-lg font-medium leading-6 text-strong">
          <CircleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
          {t('pages.myDay.banner.failed')}
        </p>
        <Button
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
      </div>
    </>
  );
}

/**
 * A closed My day (the boards' lock card): the banner with the day, then a card no wider than 560 px that says so in
 * the app's own no-access words and offers the one place that is always open, My profile.
 */
export function DayLocked({ heading, message, children }: { heading: string; message: string; children?: ReactNode }) {
  const t = useTranslations();
  return (
    <>
      <DayBanner heading={heading} />
      {/* the page frame sizes its own children, so the 560 px card sits inside a plain row */}
      <div>
        <div
          role="status"
          data-state="no-access"
          className={cn(card, 'mx-auto flex w-full max-w-[560px] flex-col items-start gap-5 p-6 sm:p-10')}
        >
          <div className="flex items-center gap-3">
            <IconCircle>
              <Lock />
            </IconCircle>
            <p className="min-w-0 break-words font-display text-lg font-medium leading-6 text-strong">{message}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {children}
            <Link href="/profile" className={buttonVariants({ variant: 'secondary' })} data-no-access-profile>
              {t('nav.profile')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
