'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMaybeMe } from '@/core/auth/me-context';
import { run } from '@/core/commands/run';
import { undoRequest } from '@/core/commands/undo';
import { formatDate } from '@/core/i18n/format';
import { entityRoute } from '@/ui/entity-route';
import { Button } from '../Button';
import { StatusChip } from '../Chip';
import { PersonChip } from '../PersonChip';
import type { AvatarPerson } from '../Avatar';
import { ShowAll } from './ShowAll';
import { fieldLabel, keyWord, listSeparator, makeValueWords } from './diff-words';

import { groupPreferenceRuns, type HistoryRow } from './history';
export type { HistoryRow, RecordChange } from './history';
export { historyRows } from './history';

/**
 * The activity timeline of a record (V61, §3.3): newest first, each request with who, when and what changed. A record's
 * timeline offers Undo on the reader's own newest action only (B, 26 Oct); the whole change log offers it on every
 * request not undone. The database decides who may undo (V128); a refusal comes back in words. Values read as words:
 * a person by name, a day as "26 Oct 2026", never an id or a raw date. Long histories show the last few with "Show
 * all" (V81).
 */
export function ActivityTimeline({
  rows,
  people,
  initial = 5,
  onChanged,
  describe,
  summarize,
  entityWords,
  undoEvery = false,
  totalCount,
  hasEarlier = false,
  onLoadEarlier,
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
  /** What this screen calls a kind of record in a line (a client's page says "Client added", never "Partner added"). */
  entityWords?: Record<string, string>;
  /** The whole change log: Undo on every request not undone, not only on the reader's newest. */
  undoEvery?: boolean;
  /** How many requests the log holds in all (the /activity page's true total): "Show all" names it, not the rows read so far. */
  totalCount?: number;
  /** Older pages wait past the ones read: "Show earlier" loads them. */
  hasEarlier?: boolean;
  onLoadEarlier?: () => Promise<void> | void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const me = useMaybeMe()?.person.id;
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const undoable = (r: HistoryRow) => !r.undone && r.kind !== 'system' && r.kind !== 'job' && r.kind !== 'undo';
  const newestMine = rows.find((r) => r.actor_id === me && undoable(r))?.request_id;
  const offersUndo = (r: HistoryRow) => undoable(r) && (undoEvery || r.request_id === newestMine);
  const words: Record<string, string> = {
    task_helper: t('activity.helper'),
    reminder: t('activity.followUp'),
    ...entityWords,
  };

  // The shared diff renderer (D36(a)): a column name is never shown, and a value reads in words — a list of
  // people by name, a start page by its word, a setting or capability key by its wording.
  const fieldLabelOf = (f: string) => fieldLabel(t, f);
  const valueWords = makeValueWords({ t, locale, describe, people });
  const record = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  /** What an added record is, in words: its name, then who and where ("Kareem Medhat · Sales · reports to Othman"). */
  const summary = (c: HistoryRow['changes'][number]): string | null => {
    if (c.action !== 'insert') return null;
    const after = record(c.after);
    if (!after) return summarize?.(c.entity, c.id) ?? null;
    // FIX-26 F031: a flag note's own words are its summary — the need-for-help note reads in History, not just
    // the flag. (Only the escalation kind: other notes keep the summary they already had.)
    if (after.kind === 'escalation' && typeof after.body === 'string' && after.body) return after.body;
    const nameField = ['full_name_en', 'trade_name_en', 'name_en', 'title', 'email', 'key'].find((k) => after[k]);
    let name = nameField ? after[nameField] : undefined;
    // A record named by its key alone reads by the key's word, never raw (O1: three capability keys joined
    // with "·" were a registry sync's summaries): a capability's word, a setting's, a start page's.
    if (nameField === 'key' && typeof name === 'string') name = keyWord(t, name) ?? name;
    const parts: string[] = [];
    if (typeof name === 'string') parts.push(name);
    // a task's helper by name; a follow-up by its time (B)
    if (typeof after.person_id === 'string' && c.entity === 'task_helper')
      parts.push(people[after.person_id]?.displayName ?? '—');
    if (typeof after.remind_at === 'string') parts.push(valueWords('remind_at', after.remind_at));
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
    const what =
      (c.entity && words[c.entity]) ||
      // A dotted kind ("task.removed", "achievement_ref" has its own word) reads by its first part, never raw.
      (c.entity && t.has(`entity.${c.entity}`)
        ? t(`entity.${c.entity}`)
        : c.entity && t.has(`entity.${c.entity.split('.')[0]}`)
          ? t(`entity.${c.entity.split('.')[0]}`)
          : (c.entity ?? ''));
    if (!t.has(`activity.actions.${c.action}`)) return t('activity.actions.request');
    return t(`activity.actions.${c.action}`, { what, fields: c.fields.map(fieldLabelOf).join(listSeparator(locale)) });
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
            {(() => {
              // The row title opens its record (FIX-18, F193 — D36(f)): the first change names the record.
              // A contract has no page of its own: its row opens the partner it belongs to, whose Overview
              // rail lists the contract (FIX-18, F-B4-03). The change carries the owner: after is the new
              // contract row on an insert (partner.contract.partner_id is not null), before is the old row
              // on a delete; an update carries only its changed fields, so it stays plain text unless the
              // owner itself changed. An invoice has no page yet (D-2, finance finalisation) and stays
              // plain text — never a link to nowhere, never /finance.
              const c = r.changes[0];
              const owner =
                c?.entity === 'contract' ? (record(c.after)?.partner_id ?? record(c.before)?.partner_id) : null;
              const href =
                entityRoute(c?.entity, c?.id) ?? (typeof owner === 'string' && owner ? `/partners/${owner}` : null);
              return href ? (
                <Link href={href} className="font-medium text-link hover:underline">
                  {label(r)}
                </Link>
              ) : (
                <span className="font-medium text-text">{label(r)}</span>
              );
            })()}
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
            const chips = [...byField]
              .map(([f, values]) => {
                const said = values.filter(Boolean).join(' · ');
                // A pill with no value is dropped, not shown bare (FIX-18, F202 — D23): the /activity read
                // used to carry no before/after, so every pill was bare; a pill that still has nothing to
                // show after the read fix is dropped the same way.
                if (!said) return null;
                return (
                  <li key={f} className="rounded-sm bg-surface px-1.5 py-0.5" data-history-field={f}>
                    {fieldLabelOf(f)}: {said}
                  </li>
                );
              })
              .filter(Boolean);
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
        {offersUndo(r) ? (
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
  const loadEarlier = async () => {
    if (!onLoadEarlier || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      await onLoadEarlier();
    } finally {
      setLoadingEarlier(false);
    }
  };
  return (
    <>
      <ShowAll
        items={items}
        initial={initial}
        labels={{
          // The count is the whole log's (F-B4-04), not the rows read so far: "Show all (484)" hid the 7 Nov
          // entries while naming only the grouped rows of one page.
          showAll: () => t('record.showAll', { count: totalCount ?? items.length }),
          showLess: t('record.showLess'),
        }}
        render={(children) => <ol className="divide-y divide-border">{children}</ol>}
      />
      {hasEarlier ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => void loadEarlier()}
          loading={loadingEarlier}
          data-activity-load-earlier
        >
          {t('activity.loadMore')}
        </Button>
      ) : null}
    </>
  );
}
