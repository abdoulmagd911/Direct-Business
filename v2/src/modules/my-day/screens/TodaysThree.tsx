'use client';
import { Flame, ListChecks } from 'lucide-react';
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
  type Streak,
  type TeamStreak,
  type TodaysThree as Three,
} from '../logic';
import { card, CardHead, groupHead } from './look';
import { TodayRow } from './TodayBlock';

/**
 * The two streak reads are new in Landing 34 (`api.my_streak`, `api.team_streaks`); until the database types are made
 * again their names are not in the typed list, so the one shared browser call is used through this untyped door.
 */
const ask = rpc as unknown as (fn: string, args: Record<string, never>, opts?: { retry?: boolean }) => Promise<unknown>;

/**
 * Today's three (Landing 34, item 1) — the daily practice at the top of My day: 3 important + 3 short + 3 maintenance
 * from the person's OWN task lists (`todaysThree`), each row the Today block's own row, so the tick, the star and the
 * title behave as they do below. The section is always drawn on Me — with no tasks at all each group says so in a line
 * (a missing section was the bug). Under the heading a small streak line (`api.my_streak`, asked from the browser like
 * What's new, so it never holds the page back): when it cannot be read nothing is drawn for it, never an error. Under
 * the groups, one line per group saying where it comes from.
 */
export function TodaysThree({ three, statuses }: { three: Three; statuses: TaskStatus[] }) {
  const t = useTranslations('pages.myDay.three');
  const [streak, setStreak] = useState<Streak | null>(null);
  // the streak is asked on opening and again whenever my open tasks change (a task ticked done leaves the list)
  const seen = [...THREE_GROUPS.flatMap((g) => three[g]), ...three.rest].map((task) => task.id).join(',');
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
    <section className={cn(card, 'pb-3 pt-1')} data-todays-three>
      <CardHead icon={<ListChecks />} title={t('title')} />
      <div className="flex flex-col gap-1 border-b border-border py-2.5 text-sm text-muted">
        <p data-three-own>{t('sub')}</p>
        {streak ? (
          // one line of plain text, its parts apart by real spaces (item 15) — it wraps between words on a phone
          <p data-streak={streak.days}>
            {streak.days > 0 ? t('streak.days', { days: streak.days }) : t('streak.none')}
            {' · '}
            <span data-streak-today={streak.today_done}>
              {t('streak.today', { done: Math.min(streak.today_done, streak.target), target: streak.target })}
            </span>
          </p>
        ) : null}
      </div>
      {/* three columns on a wide screen; on a phone and a tablet the three stack */}
      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-3">
        {THREE_GROUPS.map((g) => (
          <div key={g} className="min-w-0" data-three-group={g}>
            <h3 className={groupHead}>
              {t(`groups.${g}`)}{' '}
              <span className="ms-1 font-data" data-three-count>
                {three[g].length}
              </span>
            </h3>
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
          </div>
        ))}
      </div>
      <ul
        aria-label={t('sourcesLabel')}
        className="flex flex-col gap-1 border-t border-border pt-3 text-sm text-muted lg:flex-row lg:flex-wrap lg:gap-x-6"
        data-three-sources
      >
        {THREE_GROUPS.map((g) => (
          <li key={g} data-three-source={g}>
            {t(`sources.${g}`, { days: URGENT_WITHIN_DAYS })}
          </li>
        ))}
      </ul>
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
