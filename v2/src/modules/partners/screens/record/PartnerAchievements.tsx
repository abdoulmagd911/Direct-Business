'use client';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { nameOf, type OrgPerson } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { readFailure, type ReadFailure } from '../../read-failure';
import type { PartnerAchievements as Answer } from '../../types';

/**
 * The achievements logged with this organisation, on the record's Related tab (Landing 35 — the owner's check of
 * 21 Nov: "add an achievement and confirm it shows on the client"; until then an achievement named its organisation
 * and the organisation's record showed it nowhere). Its own small read, api.partner_achievements, asked only when the
 * Related tab is opened: once, kept while the record stays open, and read again after a change on the record
 * (`stamp` moves) — the record's first paint never waits on it. Newest first; each row is its number, title,
 * category, the day and who logged it, and the title opens the achievement's own record. The database lists exactly
 * what the reader could see on the Achievements page.
 *
 * No amount is drawn, ever: an achievement's value is not revenue (FIX-06 / D29), and a figure here would be read as
 * the organisation's money.
 *
 * Stays mounted on every tab (it draws nothing on the others), so what was read is kept while the person moves
 * between tabs — as the Codes and Finance tabs do (SummaryTabs).
 */
export function PartnerAchievements({
  tab,
  partnerId,
  stamp,
  people,
}: {
  /** The record's open tab; only 'related' draws (and asks). */
  tab: string;
  partnerId: string;
  /** Moves when something on the record was changed: the list is read again. */
  stamp: number;
  /** The people of the workspace, for the name of who logged each one. */
  people: OrgPerson[];
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const wanted = tab === 'related';
  const [attempt, setAttempt] = useState(0);
  const key = `${partnerId}:${stamp}:${attempt}`;
  const [got, setGot] = useState<{ id: string; answer: Answer } | null>(null);
  const [failed, setFailed] = useState<{ key: string; failure: ReadFailure } | null>(null);
  /** The read that has answered: leaving the tab and coming back asks nothing again. */
  const answered = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || answered.current === key) return;
    let live = true;
    rpc('partner_achievements', { p_partner: partnerId }, { retry: true })
      .then((a) => {
        if (!live) return;
        answered.current = key;
        setGot({ id: partnerId, answer: a as unknown as Answer });
        setFailed(null);
      })
      .catch((e: unknown) => {
        if (live) setFailed({ key, failure: readFailure(e) });
      });
    return () => {
      live = false;
    };
  }, [wanted, key, partnerId]);

  if (!wanted) return null;
  const what = t('partners.related.achievements');
  // what was read stays on screen while it is read again after a change; another record's list never does
  const answer = got?.id === partnerId ? got.answer : null;
  const failure = failed?.key === key ? failed.failure : null;
  const state = answer ? (answer.rows.length ? 'ready' : 'empty') : failure ? 'failed' : 'loading';
  return (
    <section
      className="rounded-lg border border-border bg-raised p-5"
      data-partner-achievements
      data-partner-achievements-state={state}
    >
      <h2 className="mb-2 text-base font-semibold">{what}</h2>
      {!answer && !failure ? <DataState kind="loading" message={t('state.loading', { what })} /> : null}
      {!answer && failure ? (
        <DataState
          kind="failed"
          message={`${t('state.failed', { what })}. ${t(`partners.read.${failure.kind}`)}`}
          action={
            <>
              {attempt > 0 ? (
                <span className="text-sm text-muted" data-read-tried={attempt}>
                  {t('partners.read.again', { count: attempt })}
                </span>
              ) : null}
              <bdi className="font-data text-xs text-muted" data-failure-ref>
                {failure.ref}
              </bdi>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw />}
                onClick={() => setAttempt((n) => n + 1)}
                className="ms-auto"
                data-partner-achievements-retry
              >
                {t('common.tryAgain')}
              </Button>
            </>
          }
        />
      ) : null}
      {answer && !answer.rows.length ? (
        <DataState kind="empty" message={t('partners.related.achievementsNone')} />
      ) : null}
      {answer?.rows.length ? (
        <>
          <ul className="divide-y divide-border text-sm">
            {answer.rows.map((a) => {
              const by = a.logged_by ? people.find((p) => p.id === a.logged_by) : undefined;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                  data-partner-achievement={a.number}
                >
                  <span className="font-data text-xs text-muted">{a.number}</span>
                  <Link
                    href={`/kpis/achievements/${a.id}`}
                    className="inline-flex min-h-11 min-w-0 items-center font-medium text-link hover:underline sm:min-h-0"
                  >
                    <bdi className="truncate">{a.title}</bdi>
                  </Link>
                  <StatusChip tone="neutral">{locale === 'ar' ? a.category_ar : a.category_en}</StatusChip>
                  {a.happened_on ? (
                    <span className="font-data text-xs text-muted" data-partner-achievement-day>
                      {formatDate(a.happened_on, locale, { dateStyle: 'medium' })}
                    </span>
                  ) : null}
                  {by ? (
                    <span className="text-xs text-muted" data-partner-achievement-by>
                      {t('partners.related.loggedBy', { name: nameOf(by, locale) })}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {answer.more ? (
            <p className="mt-2 text-xs text-muted" data-partner-achievements-more>
              {t('partners.related.achievementsMore', { shown: answer.rows.length, total: answer.total })}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
