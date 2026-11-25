'use client';
import { Flame } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import type { TaskStatus } from '@/modules/tasks/types';
import { cn } from '@/ui/cn';
import {
  THREE_GROUPS,
  URGENT_WITHIN_DAYS,
  readStreak,
  readTeamStreaks,
  threeMore,
  threeProgress,
  type Streak,
  type TeamStreak,
  type TodaysThree as Three,
} from '../logic';
import { card, CardHead } from './look';
import { TodayRow } from './TodayBlock';

/**
 * The two streak reads are new in Landing 34 (`api.my_streak`, `api.team_streaks`); until the database types are made
 * again their names are not in the typed list, so the one shared browser call is used through this untyped door.
 */
const ask = rpc as unknown as (fn: string, args: Record<string, never>, opts?: { retry?: boolean }) => Promise<unknown>;

/**
 * Today's three (Landing 34, item 1; drawn as the boards of Landing 53) — the daily practice at the top of My day:
 * 3 important + 3 short + 3 maintenance from the person's OWN tasks (`todaysThree`, the database's pick). The heading
 * has a small streak line beside it — a flame, the working days in a row (`api.my_streak`, asked from the browser so it
 * never holds the page back; when it cannot be read that part is simply not there), and how far today's rows are
 * worked down ("7 of 9 done today", counted from the rows themselves). Three cards side by side on a wide screen; on a
 * phone and a tablet one card with the three stacked and the streak line under the title. Each row is the Today
 * block's own row: the tick, the title, its kind tag and the star; a task finished today keeps its place, ticked.
 * The section is always drawn on Me — with no tasks at all each group says so in a line. Under the groups, one quiet
 * line saying whose tasks these are and where each group comes from.
 */
export function TodaysThree({ three, statuses }: { three: Three; statuses: TaskStatus[] }) {
  const t = useTranslations('pages.myDay.three');
  const [streak, setStreak] = useState<Streak | null>(null);
  const progress = threeProgress(three);
  // the streak is asked on opening and again whenever my tasks change (a task ticked done counts at once)
  const seen =
    [...THREE_GROUPS.flatMap((g) => three[g]), ...three.rest].map((task) => task.id).join(',') +
    `|${THREE_GROUPS.map((g) => three.totals[g]).join(',')}|${progress.done}`;
  useEffect(() => {
    let live = true;
    ask('my_streak', {}, { retry: true })
      .then((raw) => {
        if (live) setStreak(readStreak(raw));
      })
      .catch(() => {
        // the streak is a small extra: when it cannot be read the line is simply not there
        if (live) setStreak(null);
      });
    return () => {
      live = false;
    };
  }, [seen]);
  return (
    <section
      className={cn(card, 'pb-3 pt-1 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0 lg:shadow-none')}
      data-todays-three
    >
      {/* the heading with the streak line beside it; on a narrow screen the line wraps under the title */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 max-lg:border-b max-lg:border-border lg:pb-4 lg:pt-0">
        <h2 className="text-lg font-semibold leading-6 text-strong lg:text-xl lg:leading-7">{t('title')}</h2>
        {streak || progress.total ? (
          // one line of plain text, its parts apart by real spaces (item 15) — it wraps between words on a phone
          <p className="min-w-0 text-sm text-muted" data-streak-line>
            <Flame aria-hidden="true" className="me-1.5 inline size-4 shrink-0 align-[-3px] text-accent-ink" />
            {streak ? (
              <span data-streak={streak.days}>
                {streak.days > 0 ? t('streak.days', { days: streak.days }) : t('streak.none')}
              </span>
            ) : null}
            {streak && progress.total ? ' · ' : null}
            {progress.total ? (
              <span data-streak-today={progress.done} data-streak-of={progress.total}>
                {t('streak.today', { done: progress.done, target: progress.total })}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      {/* three cards side by side on a wide screen; on a phone and a tablet the three stack inside the one card */}
      <div className="grid grid-cols-1 gap-x-4 lg:grid-cols-3">
        {THREE_GROUPS.map((g) => (
          <div
            key={g}
            className="min-w-0 lg:rounded-lg lg:border lg:border-border lg:bg-raised lg:px-5 lg:pb-2 lg:shadow-1"
            data-three-group={g}
          >
            <h3 className="flex flex-wrap items-baseline gap-x-2 pt-4 text-base font-semibold text-strong">
              {/* a real space between the name and its count, not a margin alone (Landing 34, item 15) */}
              <span>{t(`groups.${g}`)}</span>{' '}
              <span className="font-data text-sm font-medium text-muted" data-three-count>
                {three[g].length}
              </span>
            </h3>
            <p className="pb-1 text-sm text-muted" data-three-sub>
              {t(`groupSub.${g}`)}
            </p>
            {three[g].length ? (
              <ul className="divide-y divide-border">
                {three[g].map((task) => (
                  <TodayRow key={task.id} task={task} statuses={statuses} three />
                ))}
              </ul>
            ) : (
              <p className="py-2.5 text-base text-muted" data-three-empty>
                {t(`empty.${g}`)}
              </p>
            )}
            {threeMore(three, g) > 0 ? (
              // the group holds more than three: the others are in the block below or on Tasks, never lost
              <p className="py-2 text-sm" data-three-more={threeMore(three, g)}>
                <Link href="/tasks" className="text-link hover:underline">
                  {t('more', { count: threeMore(three, g) })}
                </Link>
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {/* whose tasks these are and where each group comes from: one quiet line under the cards */}
      <div className="flex flex-col gap-1 pt-3 text-xs text-muted max-lg:border-t max-lg:border-border lg:flex-row lg:flex-wrap lg:gap-x-5">
        <p data-three-own>{t('sub')}</p>
        <ul aria-label={t('sourcesLabel')} className="contents" data-three-sources>
          {THREE_GROUPS.map((g) => (
            <li key={g} data-three-source={g}>
              {t(`sources.${g}`, { days: URGENT_WITHIN_DAYS })}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * My team's streaks, on the My team tab (`api.team_streaks`): a name and its working days in a row, the longest first.
 * The database answers an empty list to a reader who manages nobody, and then — as when it cannot be read — nothing is
 * drawn at all.
 */
export function TeamStreaks() {
  const t = useTranslations('pages.myDay.three');
  const locale = useLocale() as 'en' | 'ar';
  const [rows, setRows] = useState<TeamStreak[]>([]);
  useEffect(() => {
    let live = true;
    ask('team_streaks', {}, { retry: true })
      .then((raw) => {
        if (live) setRows(readTeamStreaks(raw));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!rows.length) return null;
  return (
    <section className={cn(card, 'py-1')} data-team-streaks>
      <CardHead icon={<Flame />} title={t('team.title')} />
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li
            key={r.person_id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[var(--list-row-min)] py-[var(--list-row-py)]"
            data-team-streak={r.person_id}
          >
            <span className="min-w-0 flex-1 break-words text-base font-medium">
              <bdi>
                {(locale === 'ar' ? (r.full_name_ar ?? r.full_name_en) : (r.full_name_en ?? r.full_name_ar)) ?? ''}
              </bdi>
            </span>{' '}
            <span className="font-data text-sm whitespace-nowrap text-muted" data-team-streak-days={r.days}>
              {t('team.days', { days: r.days })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
