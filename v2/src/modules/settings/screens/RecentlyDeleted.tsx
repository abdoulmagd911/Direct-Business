'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { command } from '@/core/commands/command';
import { restoreRecord } from '@/core/commands/undo';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { entityRoute } from '@/ui/entity-route';
import type { AvatarPerson } from '@/ui/Avatar';

/** One row of api.recently_deleted (V401): a removed record the viewer may see, inside the restore window. */
export type DeletedRow = {
  entity: string;
  id: string;
  label: string | null;
  deleted_at: string;
  deleted_by: string | null;
  reason: string | null;
  /** QA-576: false when this person may not restore it (core.may_restore); the button is then not drawn. */
  can_restore?: boolean;
  /** QA-585: why it cannot be restored, the refusal's full key (restore.blocked_by_duplicate …); the row says it in one line. */
  restore_blocked?: string | null;
};

/** The refusal keys api.recently_deleted sends, as the catalog's short names under activity.deleted.blocked. */
const BLOCKED: Record<string, string> = {
  'restore.blocked_by_duplicate': 'has_owner',
  'access.needs_capability': 'needs_capability',
  'restore.not_allowed': 'not_allowed',
};

/**
 * Recently deleted (V401, V141): what the viewer may see, inside audit.recently_deleted_days; Restore brings a record
 * back as one logged request (api.restore), with Undo. Everyone reaches it from the profile menu (QA-71) — a member
 * restores their own saved view or note there; Activity shows the same list to those who may see Activity.
 * The filters are client-side, over the loaded rows; the count says how many of the loaded rows are shown (D36(c)).
 * A removal reason is shown in full on its own line — it wraps, it is never cut off mid-word (F227).
 */
export function RecentlyDeleted({ rows, people }: { rows: DeletedRow[]; people: Record<string, AvatarPerson> }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [person, setPerson] = useState('all');
  const [since, setSince] = useState('');

  // A dotted kind ("task.removed") reads by its first part — "Task" — never raw.
  const kindOf = (entity: string) => {
    if (t.has(`entity.${entity}`)) return t(`entity.${entity}`);
    const first = entity.split('.')[0];
    if (first && t.has(`entity.${first}`)) return t(`entity.${first}`);
    return entity;
  };
  // A removed setting's label is its key ("app.arabic_enabled"); its name lives in the settings catalog.
  const labelOf = (d: DeletedRow) => {
    if (d.entity === 'setting' && d.label && t.has(`setting.${d.label}`)) return t(`setting.${d.label}`);
    return d.label;
  };
  // A system removal reason ("replaced", "undo") reads in the language on screen; a person's own words stay as written.
  const reasonOf = (d: DeletedRow) => {
    if (!d.reason) return null;
    if (t.has(`activity.deleted.reasons.${d.reason}`)) return t(`activity.deleted.reasons.${d.reason}`);
    return d.reason;
  };
  const types = useMemo(
    () => [...new Set(rows.map((r) => r.entity))].sort((a, b) => kindOf(a).localeCompare(kindOf(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows],
  );
  const removers = useMemo(
    () =>
      Object.entries(people)
        .filter(([id]) => rows.some((r) => r.deleted_by === id))
        .map(([id, p]) => ({ id, displayName: p.displayName }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [rows, people],
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== 'all' && r.entity !== type) return false;
      if (person !== 'all' && r.deleted_by !== person) return false;
      if (since && r.deleted_at.slice(0, 10) < since) return false;
      if (needle && !`${r.label ?? ''} ${r.reason ?? ''} ${kindOf(r.entity)}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, type, person, since]);
  const filtering = q.trim() !== '' || type !== 'all' || person !== 'all' || since !== '';

  const whatOf = (d: DeletedRow) => {
    const kind = kindOf(d.entity);
    const label = labelOf(d);
    return label ? `${kind} · ${label}` : kind;
  };
  const restore = (d: DeletedRow) =>
    command(
      {
        done: t('activity.deleted.restored', { what: whatOf(d) }),
        undo: t('common.undo'),
        undone: t('activity.undone'),
        has: (k) => t.has(k),
        failed: (k, detail) => t(k, { detail }),
      },
      () => restoreRecord(d.entity, d.id),
      { after: () => router.refresh() },
    );
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3" data-deleted-filters>
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute start-3 size-4 text-muted" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('common.search')}
            placeholder={t('activity.deleted.searchPlaceholder')}
            autoComplete="off"
            className="ps-9 sm:w-72"
          />
        </label>
        <Field label={t('activity.filters.what')}>
          {(p) => (
            <Select
              {...p}
              value={type}
              onValueChange={setType}
              placeholder={t('activity.filters.anything')}
              options={[
                { value: 'all', label: t('common.all') },
                ...types.map((e) => ({ value: e, label: kindOf(e) })),
              ]}
            />
          )}
        </Field>
        <Field label={t('activity.filters.who')}>
          {(p) => (
            <Select
              {...p}
              value={person}
              onValueChange={setPerson}
              placeholder={t('activity.filters.anyone')}
              options={[
                { value: 'all', label: t('common.all') },
                ...removers.map((p) => ({ value: p.id, label: p.displayName })),
              ]}
            />
          )}
        </Field>
        <Field label={t('activity.filters.since')}>
          {(p) => (
            <Input {...p} type="date" value={since} onChange={(e) => setSince(e.target.value)} className="font-data" />
          )}
        </Field>
      </div>
      {rows.length === 0 ? (
        <section className="rounded-lg border border-border bg-raised" data-activity-deleted>
          <DataState kind="empty" message={t('activity.deleted.none')} />
        </section>
      ) : (
        <>
          <p className="text-xs text-muted" data-deleted-count>
            {filtering
              ? t('activity.deleted.showing', { shown: filtered.length, total: rows.length })
              : t('activity.deleted.count', { count: rows.length })}
          </p>
          {filtered.length === 0 ? (
            <section className="rounded-lg border border-border bg-raised" data-activity-deleted>
              <DataState kind="empty" message={t('activity.deleted.none')} />
            </section>
          ) : (
            <section className="rounded-lg border border-border bg-raised" data-activity-deleted>
              <ul className="divide-y divide-border">
                {filtered.map((d) => {
                  const href = entityRoute(d.entity, d.id);
                  return (
                    <li
                      key={`${d.entity}:${d.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                      data-deleted-row={d.id}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">
                          {href ? (
                            <Link href={href} className="hover:underline">
                              {whatOf(d)}
                            </Link>
                          ) : (
                            whatOf(d)
                          )}
                        </span>
                        <span className="text-xs text-muted">
                          {[
                            d.deleted_by && people[d.deleted_by] ? people[d.deleted_by]!.displayName : null,
                            formatDate(new Date(d.deleted_at), locale, { dateStyle: 'medium', timeStyle: 'short' }),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {reasonOf(d) ? <span className="break-words text-xs text-muted">{reasonOf(d)}</span> : null}
                      </span>
                      {d.can_restore === false ? (
                        <span className="text-xs text-muted" data-deleted-blocked>
                          {t(
                            `activity.deleted.blocked.${(d.restore_blocked && BLOCKED[d.restore_blocked]) || 'other'}`,
                          )}
                        </span>
                      ) : (
                        <Button size="xs" onClick={() => void restore(d)} data-deleted-restore>
                          {t('activity.deleted.restore')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
