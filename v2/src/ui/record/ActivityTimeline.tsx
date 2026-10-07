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

import { groupPreferenceRuns, type HistoryRow } from './history';
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
  describe,
  summarize,
}: {
  rows: HistoryRow[];
  /** Who is who, for the chips: from api.org() or the record itself. */
  people: Record<string, AvatarPerson>;
  initial?: number;
  onChanged?: () => void;
  /** A field's value in words — a department's or a person's name for its id; null when the screen has no word. */
  describe?: (field: string, value: unknown) => string | null;
  /** An added record in words from what the screen knows of it (api.activity carries field names only). */
  summarize?: (entity: string | undefined, id: string | undefined) => string | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  // A column name is never shown: its wording, else the name in plain words ("manager_id" → "Manager").
  const fieldLabel = (f: string) => {
    if (t.has(`activity.fields.${f}`)) return t(`activity.fields.${f}`);
    const plain = f.replace(/_id$/, '').replace(/_/g, ' ');
    return plain.charAt(0).toUpperCase() + plain.slice(1);
  };
  const valueWords = (field: string, v: unknown): string => {
    const said = describe?.(field, v);
    if (said) return said;
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return t(v ? 'common.yes' : 'common.no');
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return JSON.stringify(v);
  };
  const record = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  /** What an added record is, in words: its name, then who and where ("Kareem Medhat · Sales · reports to Othman"). */
  const summary = (c: HistoryRow['changes'][number]): string | null => {
    if (c.action !== 'insert') return null;
    const after = record(c.after);
    if (!after) return summarize?.(c.entity, c.id) ?? null;
    const name = ['full_name_en', 'trade_name_en', 'name_en', 'title', 'email', 'key']
      .map((k) => after[k])
      .find(Boolean);
    const parts: string[] = [];
    if (typeof name === 'string') parts.push(name);
    for (const k of ['department_id', 'team_id', 'role_id']) {
      const word = after[k] ? describe?.(k, after[k]) : null;
      if (word) parts.push(word);
    }
    const manager = after.manager_id ? describe?.('manager_id', after.manager_id) : null;
    if (manager) parts.push(t('activity.reportsTo', { name: manager }));
    return parts.length ? parts.join(' · ') : null;
  };
  const MAX_CHIPS = 8;

  const label = (r: HistoryRow) => {
    if (r.label_key && t.has(`activity.labels.${r.label_key}`))
      return t(`activity.labels.${r.label_key}`, (r.label_args ?? {}) as Record<string, string | number>);
    const c = r.changes?.[0];
    if (!c) return t('activity.actions.request');
    const what = c.entity && t.has(`entity.${c.entity}`) ? t(`entity.${c.entity}`) : (c.entity ?? '');
    if (!t.has(`activity.actions.${c.action}`)) return t('activity.actions.request');
    return t(`activity.actions.${c.action}`, { what, fields: c.fields.map(fieldLabel).join(', ') });
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

  const items = groupPreferenceRuns(rows).map((r) => {
    const who = r.actor_id ? people[r.actor_id] : undefined;
    return (
      <li
        key={r.request_id}
        className="flex gap-3 py-3"
        data-history-row
        data-kind={r.kind}
        data-undone={r.undone || undefined}
        data-history-grouped={r.grouped}
      >
        <div className="mt-1 size-2 shrink-0 rounded-pill bg-border-strong" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-medium text-text">{label(r)}</span>
            {r.grouped ? (
              <StatusChip tone="neutral">{t('activity.groupedChanges', { count: r.grouped })}</StatusChip>
            ) : null}
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
          {r.changes.map((c) => summary(c)).filter(Boolean).length ? (
            <p className="text-xs text-muted" data-history-summary>
              {r.changes
                .map((c) => summary(c))
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {(() => {
            // An added record is said by its summary, never by every column; a change lists each field with its
            // before and after; a system request with many fields collapses to their count (W6, W7).
            const changed = r.changes.filter((c) => c.action !== 'insert' && c.fields?.length);
            const total = changed.reduce((n, c) => n + c.fields.length, 0);
            if (!total) return null;
            const machine = r.kind !== 'ui' && r.kind !== 'undo';
            if (machine && total > MAX_CHIPS)
              return (
                <ul className="flex flex-wrap gap-1.5 pt-0.5 text-xs text-muted">
                  <li className="rounded-sm bg-surface px-1.5 py-0.5">{t('activity.fieldsCount', { count: total })}</li>
                </ul>
              );
            // One chip per field: a request that changes the same field on two records (a person's two emails) says
            // the field once, with each distinct before → after (QA-190)
            const byField = new Map<string, string[]>();
            for (const c of changed)
              for (const f of c.fields) {
                const before = record(c.before)?.[f];
                const after = record(c.after)?.[f];
                const shown = before !== undefined || after !== undefined;
                const said = shown ? `${valueWords(f, before)} → ${valueWords(f, after)}` : '';
                const seen = byField.get(f) ?? [];
                if (!seen.includes(said)) seen.push(said);
                byField.set(f, seen);
              }
            const chips = [...byField].map(([f, values]) => {
              const said = values.filter(Boolean).join(' · ');
              return (
                <li key={f} className="rounded-sm bg-surface px-1.5 py-0.5" data-history-field={f}>
                  {fieldLabel(f)}
                  {said ? `: ${said}` : ''}
                </li>
              );
            });
            return (
              <ul className="flex flex-wrap gap-1.5 pt-0.5 text-xs text-muted">
                {chips.slice(0, MAX_CHIPS)}
                {chips.length > MAX_CHIPS ? (
                  <li className="px-1.5 py-0.5">{t('activity.moreFields', { count: chips.length - MAX_CHIPS })}</li>
                ) : null}
              </ul>
            );
          })()}
        </div>
        {!r.undone && r.kind !== 'system' && r.kind !== 'job' && r.kind !== 'undo' ? (
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
