'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import type { MyDayAnswer, SinceCount } from '../types';

/**
 * What's new since the person's last visit (V433): on opening My day it asks `api.page_seen('my_day')` — which answers the
 * previous visit and records this one — then counts the notes shared with the team or everyone since (never a private
 * one). It asks once per opening, not on every refresh. Mark seen records the visit again and clears the block.
 */
export function SinceBlock() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const asked = useRef(false);
  const [since, setSince] = useState<{ at: string; counts: SinceCount[] } | null>(null);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    (async () => {
      try {
        const before = (await rpc('page_seen', { p_page: 'my_day' })) as unknown as string | null;
        if (!before) return;
        const a = (await rpc('my_day', { p_scope: 'me', p_limit: 1, p_since: before })) as unknown as MyDayAnswer;
        const counts = a.since.filter((s) => s.count > 0);
        if (counts.length) setSince({ at: before, counts });
      } catch {
        // the block is a convenience: when it cannot be read, the page simply goes without it
      }
    })();
  }, []);
  if (!since) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4" data-since>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{t('pages.myDay.blocks.since')}</h2>
        <span className="text-sm text-muted">
          {t('pages.myDay.since.at', {
            when: formatDate(since.at, locale, { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {since.counts.map((s) => (
          <li
            key={s.kind}
            className="inline-flex min-h-9 items-center rounded-pill border border-border px-3 text-sm"
            data-since-kind={s.kind}
          >
            {t(`pages.myDay.since.kinds.${s.kind}`, { count: s.count })}
          </li>
        ))}
      </ul>
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSince(null);
            void rpc('page_seen', { p_page: 'my_day' }).catch(() => undefined);
          }}
          data-since-seen
        >
          {t('pages.myDay.since.markSeen')}
        </Button>
      </div>
    </section>
  );
}
