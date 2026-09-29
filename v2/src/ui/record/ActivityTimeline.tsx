'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { run } from '@/core/commands/run';
import { undoRequest } from '@/core/commands/undo';
import { formatDate } from '@/core/i18n/format';
import { Button } from '../Button';
import { StatusChip } from '../Chip';
import { PersonChip } from '../PersonChip';
import type { AvatarPerson } from '../Avatar';
import { ShowAll } from './ShowAll';

import { type HistoryRow } from './history';
export type { HistoryRow, RecordChange } from './history';
export { historyRows } from './history';

/**
 * The activity timeline of a record (V61, §3.3): newest first, each request with who, when, what changed and Undo
 * where the request is not undone. The database decides who may undo (V128); a refusal comes back in words. Long
 * histories show the last few with "Show all" (V81).
 */
export function ActivityTimeline({
  rows,
  people,
  initial = 5,
  onChanged,
}: {
  rows: HistoryRow[];
  /** Who is who, for the chips: from api.org() or the record itself. */
  people: Record<string, AvatarPerson>;
  initial?: number;
  onChanged?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const label = (r: HistoryRow) => {
    if (r.label_key && t.has(`activity.labels.${r.label_key}`))
      return t(`activity.labels.${r.label_key}`, (r.label_args ?? {}) as Record<string, string | number>);
    const c = r.changes?.[0];
    if (!c) return t('activity.actions.request');
    const what = c.entity && t.has(`entity.${c.entity}`) ? t(`entity.${c.entity}`) : (c.entity ?? '');
    return t(`activity.actions.${c.action}`, { what, fields: c.fields.join(', ') });
  };

  const undo = (r: HistoryRow) => {
    setBusy(r.request_id);
    return run(
      {
        done: t('activity.undone'),
        undo: t('common.undo'),
        undone: t('activity.undone'),
        has: (k) => t.has(k),
        failed: (k, detail) => t(k, { detail }),
      },
      () => undoRequest(r.request_id),
      () => {
        onChanged?.();
        router.refresh();
      },
    ).finally(() => setBusy(null));
  };

  const items = rows.map((r) => {
    const who = r.actor_id ? people[r.actor_id] : undefined;
    return (
      <li key={r.request_id} className="flex gap-3 py-3" data-history-row data-undone={r.undone || undefined}>
        <div className="mt-1 size-2 shrink-0 rounded-pill bg-border-strong" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium text-text">{label(r)}</span>
            {r.undone ? <StatusChip tone="neutral">{t('activity.undoneChip')}</StatusChip> : null}
            {r.kind === 'undo' ? <StatusChip tone="info">{t('activity.kinds.undo')}</StatusChip> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            {who ? (
              <PersonChip person={who} href={`/people/${r.actor_id}`} size="xs" />
            ) : r.kind !== 'ui' ? (
              <span>{t(`activity.kinds.${r.kind}`)}</span>
            ) : null}
            <time dateTime={r.at}>
              {formatDate(new Date(r.at), locale, { dateStyle: 'medium', timeStyle: 'short' })}
            </time>
            {r.reason ? <span>· {r.reason}</span> : null}
          </div>
          {r.changes?.some((c) => c.fields?.length) ? (
            <ul className="flex flex-wrap gap-1.5 pt-0.5 text-xs text-muted">
              {r.changes.flatMap((c) =>
                (c.fields ?? []).map((f) => (
                  <li key={`${c.id}-${f}`} className="rounded-sm bg-surface px-1.5 py-0.5 font-data">
                    {f}
                  </li>
                )),
              )}
            </ul>
          ) : null}
        </div>
        {!r.undone && r.kind !== 'system' && r.kind !== 'job' ? (
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 self-start"
            loading={busy === r.request_id}
            onClick={() => void undo(r)}
            data-undo-request
          >
            {t('common.undo')}
          </Button>
        ) : null}
      </li>
    );
  });

  if (!items.length) return <p className="text-sm text-muted">{t('activity.none')}</p>;
  return (
    <ShowAll
      items={items}
      initial={initial}
      labels={{ showAll: (n) => t('record.showAll', { count: n }), showLess: t('record.showLess') }}
      render={(children) => <ol className="divide-y divide-border">{children}</ol>}
    />
  );
}
