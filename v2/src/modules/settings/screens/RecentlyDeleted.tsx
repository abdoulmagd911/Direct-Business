'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { command } from '@/core/commands/command';
import { restoreRecord } from '@/core/commands/undo';
import { formatDate } from '@/core/i18n/format';
import { modules } from '@/core/registry';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { DatePicker } from '@/ui/DatePicker';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';
import type { AvatarPerson } from '@/ui/Avatar';

/** One row of api.recently_deleted (V401): a removed record the viewer may see, inside the restore window. */
export type DeletedRow = {
  entity: string;
  id: string;
  label: string | null;
  /** The record's Arabic name where it has one (api.recently_deleted sends it; else the label again). */
  label_ar?: string | null;
  deleted_at: string;
  deleted_by: string | null;
  reason: string | null;
  /** QA-576: false when this person may not restore it (core.may_restore); the button is then not drawn. */
  can_restore?: boolean;
  /** QA-585: why it cannot be restored, the refusal's full key (restore.blocked_by_duplicate …); the row says it in one line. */
  restore_blocked?: string | null;
};

/** Each record kind's word as its module registers it (the registry's entity labels). */
const ENTITY_LABELS: Record<string, string> = Object.fromEntries(
  modules.flatMap((m) => (m.entities ?? []).map((e) => [e.key, e.label] as const)),
);

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
  // F-B5-07: a deleted row's label expands the row in place instead of linking out — the link went to the live
  // record's route, which 404s for a deleted record, so the full text was unreachable. The expanded row shows
  // the label and the reason in full; the truncation leg of the same finding is evidence-owed (§5.7), not built.
  const [openId, setOpenId] = useState<string | null>(null);

  // A dotted kind ("task.removed") reads by its first part — "Task" — never raw; a kind with no word of its own reads by
  // the word its module gives it (a removed achievement participant is "Achievement", a target "Targets"), and failing
  // all of those in plain words — "achievement_participant" showed as typed in the code.
  const kindOf = (entity: string) => {
    if (t.has(`entity.${entity}`)) return t(`entity.${entity}`);
    const first = entity.split('.')[0];
    if (first && t.has(`entity.${first}`)) return t(`entity.${first}`);
    const label = ENTITY_LABELS[entity] ?? (first ? ENTITY_LABELS[first] : undefined);
    if (label && t.has(label)) return t(label);
    const plain = entity.replace(/[._]+/g, ' ').trim();
    return plain.charAt(0).toUpperCase() + plain.slice(1);
  };
  // A removed setting's label is its key ("app.arabic_enabled"); its name lives in the settings catalog. Anything else
  // reads by its name in the language on screen — the Arabic one where the record has it.
  const labelOf = (d: DeletedRow) => {
    if (d.entity === 'setting' && d.label && t.has(`setting.${d.label}`)) return t(`setting.${d.label}`);
    if (locale === 'ar' && d.label_ar) return d.label_ar;
    return d.label;
  };
  // the day a record was removed, in Riyadh (the company's calendar — the stored moment is UTC, and its first ten
  // characters were the UTC day: a removal between midnight and 03:00 fell on the day before)
  const riyadhDayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
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
      if (since && riyadhDayOf(r.deleted_at) < since) return false;
      if (
        needle &&
        !`${r.label ?? ''} ${r.label_ar ?? ''} ${r.reason ?? ''} ${kindOf(r.entity)}`.toLowerCase().includes(needle)
      ) {
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
        {/* the app's own date box (FIX-02), not the browser's: its picker dismissed on a day-click without setting the
            day; only a whole day filters, half-typed text stays in the box */}
        <Field label={t('activity.filters.since')}>
          {(p) => (
            <DatePicker
              id={p.id}
              describedBy={p['aria-describedby']}
              invalid={p['aria-invalid']}
              value={since || undefined}
              onChange={(v) => setSince(v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '')}
              chips="none"
              className="w-60 font-data"
            />
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
                  const key = `${d.entity}:${d.id}`;
                  const open = openId === key;
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                      data-deleted-row={d.id}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : key)}
                          aria-expanded={open}
                          className="text-start font-medium hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                          data-deleted-details={d.id}
                        >
                          {whatOf(d)}
                        </button>
                        <span className="text-xs text-muted">
                          {[
                            d.deleted_by && people[d.deleted_by] ? people[d.deleted_by]!.displayName : null,
                            formatDate(new Date(d.deleted_at), locale, { dateStyle: 'medium', timeStyle: 'short' }),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {reasonOf(d) ? <span className="break-words text-xs text-muted">{reasonOf(d)}</span> : null}
                        {open ? (
                          <span
                            className="mt-1 flex min-w-0 flex-col gap-0.5 border-s-2 border-border ps-3"
                            data-deleted-full={d.id}
                          >
                            {labelOf(d) ? <span className="break-words text-sm">{labelOf(d)}</span> : null}
                            {reasonOf(d) ? <span className="break-words text-xs text-muted">{reasonOf(d)}</span> : null}
                          </span>
                        ) : null}
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
