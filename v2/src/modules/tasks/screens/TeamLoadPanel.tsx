'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { DataState } from '@/ui/DataState';
import { cn } from '@/ui/cn';
import { byLoad } from '../rules';
import type { TeamLoad } from '../types';

/**
 * The team's load (V91), on Tasks › Team for a manager or a head: per person, their open tasks, how many are overdue,
 * their open action items, the clients they look after and the prospects they hold. Live work only (V491). The most
 * overdue lead, so who needs help is seen first. One card per person: it wraps at 390 px, never scrolls sideways.
 */
export function TeamLoadPanel({ load }: { load: TeamLoad[] | null }) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const title = t('pages.tasks.load.title');
  if (!load)
    return (
      <DataState
        kind="failed"
        message={t('state.failed', { what: title })}
        onRetry={() => router.refresh()}
        retryLabel={t('common.tryAgain')}
      />
    );
  return (
    <section className="flex flex-col gap-2" data-team-load aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {load.length === 0 ? (
        <p className="text-base text-muted">{t('pages.tasks.load.empty')}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {byLoad(load).map((p) => (
            <li
              key={p.person_id}
              className="flex flex-col gap-1 rounded-lg border border-border bg-raised px-4 py-3"
              data-load-person={p.full_name_en}
            >
              <p className="break-words text-base font-medium">
                {locale === 'ar' && p.full_name_ar ? p.full_name_ar : p.full_name_en}
              </p>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                <span data-load-open>{t('pages.tasks.load.open', { count: p.open_tasks })}</span>
                <span data-load-overdue className={cn(p.overdue > 0 && 'font-medium text-danger')}>
                  {t('pages.tasks.load.overdue', { count: p.overdue })}
                </span>
                <span>{t('pages.tasks.load.items', { count: p.open_action_items })}</span>
                {p.partners_owned ? <span>{t('pages.tasks.load.clients', { count: p.partners_owned })}</span> : null}
                {p.prospects_assigned ? (
                  <span>{t('pages.tasks.load.prospects', { count: p.prospects_assigned })}</span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
