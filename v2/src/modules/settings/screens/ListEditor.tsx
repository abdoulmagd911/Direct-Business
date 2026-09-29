'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { bannedIn } from '@/core/words/banned';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';

export type ListEntry = {
  id: string;
  key: string;
  name_en: string;
  name_ar: string | null;
  sort: number | null;
  active: boolean;
  version: number;
  [column: string]: unknown;
};

type Draft = { key: string; name_en: string; name_ar: string; sort: string };

/**
 * A setting list (§3.0 LIST, V76, V97, V133): its entries with both names, the key and the order; Add and Edit in one
 * dialog where the Arabic name is required; Archive through the safety rules — the count of records holding the entry
 * (api.list_usage) and, when any do, the entry they move to (api.list_retire: one logged change, one Undo). Entries
 * are archived, never deleted (hidden from pickers, kept on records).
 */
export function ListEditor({ entity, label, rows }: { entity: string; label: string; rows: ListEntry[] }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<ListEntry | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>({ key: '', name_en: '', name_ar: '', sort: '' });
  const [reason, setReason] = useState('');
  const [archiving, setArchiving] = useState<ListEntry | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [replaceWith, setReplaceWith] = useState('');
  const [busy, setBusy] = useState(false);
  const words = {
    done: t('settings.list.saved'),
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k: string) => t.has(k),
    failed: (k: string, d: string) => t(k, { detail: d }),
  };
  const shown = rows
    .filter((r) => showArchived || r.active)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name_en.localeCompare(b.name_en));
  const name = (r: ListEntry) => (locale === 'ar' && r.name_ar ? r.name_ar : r.name_en);

  const startEdit = (r: ListEntry | 'new') => {
    setDraft(
      r === 'new'
        ? { key: '', name_en: '', name_ar: '', sort: String(rows.length + 1) }
        : { key: r.key, name_en: r.name_en, name_ar: r.name_ar ?? '', sort: String(r.sort ?? '') },
    );
    setReason('');
    setEditing(r);
  };
  const banned = bannedIn(draft.name_en) ?? bannedIn(draft.name_ar);
  const draftOk =
    !banned && draft.key.trim().length > 0 && draft.name_en.trim().length > 0 && draft.name_ar.trim().length > 0;
  const save = async () => {
    if (editing === null) return;
    setBusy(true);
    const typed: Record<string, unknown> = {
      name_en: draft.name_en.trim(),
      name_ar: draft.name_ar.trim(),
      sort: draft.sort === '' ? null : Number(draft.sort),
    };
    // An edit sends only what changed (the old app's lesson: an untouched Save changes nothing, and the version is
    // checked per field it is asked to write); a new entry sends everything with its key.
    const values: Record<string, unknown> = {};
    if (editing === 'new') {
      Object.assign(values, typed, { key: draft.key.trim() });
    } else {
      for (const [k, v] of Object.entries(typed))
        if (JSON.stringify(v) !== JSON.stringify(editing[k] ?? null)) values[k] = v;
      if (!Object.keys(values).length) {
        setEditing(null);
        setBusy(false);
        return;
      }
    }
    await run(
      words,
      () =>
        rpc('list_save', {
          p_list: entity,
          p_id: (editing === 'new' ? null : editing.id) as unknown as string,
          p_values: values as never,
          p_version: editing === 'new' ? undefined : editing.version,
          p_reason: reason.trim() || undefined,
        }) as Promise<{ request_id?: string | null } | null>,
      () => {
        setEditing(null);
        router.refresh();
      },
    );
    setBusy(false);
  };

  const startArchive = async (r: ListEntry) => {
    setArchiving(r);
    setUsage(null);
    setReplaceWith('');
    setReason('');
    try {
      const n = (await rpc('list_usage', { p_list: entity, p_id: r.id })) as { total?: number } | null;
      setUsage(n?.total ?? 0);
    } catch {
      setUsage(null);
    }
  };
  const archive = async () => {
    if (!archiving) return;
    setBusy(true);
    const target = archiving;
    const replaced = (usage ?? 0) > 0;
    await run(
      { ...words, done: t('settings.list.archivedDone', { name: name(target) }) },
      () =>
        (replaced
          ? rpc('list_retire', {
              p_list: entity,
              p_id: target.id,
              p_replacement: replaceWith,
              p_reason: reason.trim(),
            })
          : rpc('list_save', {
              p_list: entity,
              p_id: target.id,
              p_values: { active: false } as never,
              p_version: target.version,
              p_reason: reason.trim() || undefined,
            })) as Promise<{ request_id?: string | null } | null>,
      () => {
        setArchiving(null);
        router.refresh();
      },
    );
    setBusy(false);
  };
  const restore = async (r: ListEntry) => {
    await run(
      { ...words, done: t('settings.list.restored', { name: name(r) }) },
      () =>
        rpc('list_save', {
          p_list: entity,
          p_id: r.id,
          p_values: { active: true } as never,
          p_version: r.version,
        }) as Promise<{
          request_id?: string | null;
        } | null>,
      () => router.refresh(),
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5" data-list={entity}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">{label}</h3>
          <span className="font-data text-xs text-muted">
            {t('settings.list.entries', { count: rows.filter((r) => r.active).length })}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {rows.some((r) => !r.active) ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={showArchived}
                onCheckedChange={setShowArchived}
                label={t('settings.list.showArchived')}
              />
              {t('settings.list.showArchived')}
            </label>
          ) : null}
          <Button size="sm" onClick={() => startEdit('new')} data-list-add>
            {t('settings.list.add')}
          </Button>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2 text-start font-medium">{t('settings.list.nameEn')}</th>
            <th className="py-2 text-start font-medium">{t('settings.list.nameAr')}</th>
            <th className="py-2 text-start font-medium">{t('settings.list.key')}</th>
            <th className="py-2 text-end font-medium">{t('settings.list.sort')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {shown.map((r) => (
            <tr key={r.id} data-list-entry={r.key} data-active={r.active}>
              <td className="py-2.5">
                <span className="flex items-center gap-2">
                  {r.name_en}
                  {!r.active ? <StatusChip tone="neutral">{t('settings.list.archived')}</StatusChip> : null}
                </span>
              </td>
              <td className="py-2.5" dir="rtl">
                {r.name_ar}
              </td>
              <td className="py-2.5 font-data text-muted">{r.key}</td>
              <td className="py-2.5 text-end font-data text-muted">{r.sort}</td>
              <td className="py-2.5 text-end">
                <span className="inline-flex gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => startEdit(r)}
                    aria-label={t('settings.list.edit', { name: name(r) })}
                  >
                    {t('common.edit')}
                  </Button>
                  {r.active ? (
                    <Button size="xs" variant="ghost" onClick={() => void startArchive(r)} data-list-archive>
                      {t('settings.list.archive')}
                    </Button>
                  ) : (
                    <Button size="xs" variant="ghost" onClick={() => void restore(r)}>
                      {t('settings.list.restore')}
                    </Button>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={
          editing === 'new' || editing === null
            ? t('settings.list.new')
            : t('settings.list.edit', { name: name(editing) })
        }
        dirty={draft.name_en !== '' || draft.name_ar !== ''}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!draftOk} loading={busy} onClick={() => void save()} data-list-save>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t('settings.list.key')}>
            {(p) => (
              <Input
                {...p}
                value={draft.key}
                disabled={editing !== 'new'}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                className="font-data"
              />
            )}
          </Field>
          <Field
            label={t('settings.list.nameEn')}
            error={bannedIn(draft.name_en) ? t('settings.list.banned', { word: bannedIn(draft.name_en)! }) : undefined}
          >
            {(p) => (
              <Input {...p} value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} />
            )}
          </Field>
          <Field
            label={t('settings.list.nameAr')}
            error={draft.name_en && !draft.name_ar.trim() ? t('settings.list.arabicRequired') : undefined}
          >
            {(p) => (
              <Input
                {...p}
                dir="rtl"
                lang="ar"
                value={draft.name_ar}
                onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
              />
            )}
          </Field>
          <Field label={t('settings.list.sort')}>
            {(p) => (
              <Input
                {...p}
                type="number"
                value={draft.sort}
                onChange={(e) => setDraft({ ...draft, sort: e.target.value })}
                className="max-w-32 font-data"
              />
            )}
          </Field>
          <Field label={`${t('common.reason')} (${t('common.optional')})`}>
            {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={archiving ? t('settings.list.retireTitle', { name: name(archiving) }) : ''}
        footer={
          <>
            <Button onClick={() => setArchiving(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={usage === null || ((usage ?? 0) > 0 && (!replaceWith || !reason.trim()))}
              onClick={() => void archive()}
              data-list-archive-confirm
            >
              {t('settings.list.archive')}
            </Button>
          </>
        }
      >
        {archiving ? (
          <div className="flex flex-col gap-4">
            {usage !== null ? (
              <p className="font-display text-xl" data-list-usage>
                {t('settings.list.usedIn', { count: usage })}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {(usage ?? 0) > 0
                ? t('settings.list.retireBodyUsed', { count: usage!, name: name(archiving) })
                : t('settings.list.retireBody')}
            </p>
            {(usage ?? 0) > 0 ? (
              <Field label={t('settings.list.replaceWith')}>
                {(p) => (
                  <Select
                    {...p}
                    value={replaceWith}
                    onValueChange={setReplaceWith}
                    options={rows
                      .filter((r) => r.active && r.id !== archiving.id)
                      .map((r) => ({ value: r.id, label: name(r) }))}
                  />
                )}
              </Field>
            ) : null}
            <Field label={(usage ?? 0) > 0 ? t('common.reason') : `${t('common.reason')} (${t('common.optional')})`}>
              {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          </div>
        ) : null}
      </Dialog>
    </section>
  );
}
