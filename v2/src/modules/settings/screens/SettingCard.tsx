'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { valid, type SettingDefRow, type SettingRow } from '../schema';
import { SchemaEditor, SchemaValue } from './SchemaEditor';

export type Department = { id: string; name_en: string; name_ar: string | null };

/** api.setting_preview's answer (V97): a rolled-back dry run of the change. */
type ServerPreview = {
  valid_from: string;
  value_before: unknown;
  value_after: unknown;
  replaces_same_day: boolean;
  previewed: boolean;
};

/**
 * One setting (V97, V131): today's value for all departments, the departments that keep their own, and Change — a
 * dialog with the new value drawn from the setting's schema, the department it applies to, the effective date where
 * the setting takes one, the reason (required), and the preview of what changes before Save. Saving is one request
 * with Undo; a department goes back to the shared value with Back to the value for all departments.
 */
export function SettingCard({
  def,
  departments,
  canEdit,
  today,
}: {
  def: SettingDefRow;
  departments: Department[];
  canEdit: boolean;
  /** Riyadh's date on the SERVER (YYYY-MM-DD): the day a change applies from is never the browser's clock (PRF-139). */
  today: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string>('all');
  const [value, setValue] = useState<unknown>(def.value);
  const [from, setFrom] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<(ServerPreview & { of: string }) | null>(null);
  const label = t.has(def.label_key) ? t(def.label_key) : def.key;
  const deptName = (id: string | null) => {
    const d = departments.find((x) => x.id === id);
    return d ? (locale === 'ar' && d.name_ar ? d.name_ar : d.name_en) : t('settings.setting.companyWide');
  };
  const deptRows = def.rows.filter((r) => r.department_id);
  const companyRow = def.rows.find((r) => !r.department_id);
  const words = {
    done: t('settings.setting.saved'),
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k: string) => t.has(k),
    failed: (k: string, d: string) => t(k, { detail: d }),
  };
  const openDialog = () => {
    setScope('all');
    setValue(def.value);
    setFrom(today);
    setReason('');
    setOpen(true);
  };
  const fromValue = scope === 'all' ? def.value : (deptRows.find((r) => r.department_id === scope)?.value ?? def.value);
  const changed = JSON.stringify(fromValue) !== JSON.stringify(value);
  const ok = changed && valid(def.schema, value) && reason.trim().length > 0 && (!def.effective_dated || !!from);
  // The preview is the database's own dry run (api.setting_preview — V97): it applies the change and rolls it back,
  // answering with the value that stands before and after on the day it would apply, and whether a same-day change
  // is replaced. Until it answers (or when it refuses), the dialog shows what the screen already knows.
  const previewable = open && changed && valid(def.schema, value) && (!def.effective_dated || !!from);
  const valueJson = JSON.stringify(value);
  const asked = `${scope}|${from}|${valueJson}`;
  useEffect(() => {
    if (!previewable) return;
    let live = true;
    rpc('setting_preview', {
      p_key: def.key,
      p_department: (scope === 'all' ? null : scope) as unknown as string,
      p_value: JSON.parse(valueJson) as never,
      p_valid_from: def.effective_dated ? from : undefined,
    })
      .then((answer) => live && setAnswered({ ...(answer as unknown as ServerPreview), of: asked }))
      .catch(() => live && setAnswered(null));
    return () => {
      live = false;
    };
  }, [previewable, asked, def.key, def.effective_dated, scope, valueJson, from]);
  // Only the answer to the change as it stands now is shown; an older answer, or none yet, leaves the screen's own.
  const previewed = previewable && answered?.of === asked ? answered : null;
  const save = async () => {
    setBusy(true);
    await run(
      words,
      () =>
        rpc('setting_set', {
          p_key: def.key,
          p_department: (scope === 'all' ? null : scope) as unknown as string,
          p_value: value as never,
          p_valid_from: def.effective_dated ? from : undefined,
          p_reason: reason.trim(),
        }) as Promise<{ request_id?: string | null } | null>,
      () => {
        setOpen(false);
        router.refresh();
      },
    );
    setBusy(false);
  };
  const clear = async (row: SettingRow) => {
    await run(
      { ...words, done: t('settings.setting.cleared') },
      () =>
        rpc('setting_clear', {
          p_key: def.key,
          p_department: row.department_id!,
          p_reason: t('settings.setting.clear'),
        } as never) as Promise<{ request_id?: string | null } | null>,
      () => router.refresh(),
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5" data-setting={def.key}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-base font-semibold">{label}</h3>
          <p className="font-display text-xl" data-setting-value>
            <SchemaValue settingKey={def.key} value={def.value} />
          </p>
          <p className="text-xs text-muted">
            {companyRow && companyRow.reason !== 'default'
              ? `${t('settings.setting.appliesFrom')} ${formatDate(new Date(companyRow.valid_from), locale, { dateStyle: 'medium' })}${companyRow.reason ? ` · ${companyRow.reason}` : ''}`
              : t('settings.setting.default')}
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={openDialog} data-setting-change>
            {t('settings.setting.change')}
          </Button>
        ) : null}
      </div>
      {deptRows.length ? (
        <ul className="flex flex-col gap-2 border-t border-border pt-3">
          {deptRows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <StatusChip tone="neutral">{deptName(r.department_id)}</StatusChip>
                <span className="font-medium">
                  <SchemaValue settingKey={def.key} value={r.value} />
                </span>
                <span className="text-xs text-muted">
                  {formatDate(new Date(r.valid_from), locale, { dateStyle: 'medium' })}
                </span>
              </span>
              {canEdit ? (
                <Button size="xs" variant="ghost" onClick={() => void clear(r)}>
                  {t('settings.setting.clear')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('settings.setting.edit', { setting: label })}
        dirty={changed || reason.length > 0}
        size="md"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-setting-save>
              {t('settings.setting.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t('settings.setting.department')}>
            {(p) => (
              <Select
                {...p}
                value={scope}
                onValueChange={(v) => {
                  setScope(v);
                  setValue(v === 'all' ? def.value : (deptRows.find((r) => r.department_id === v)?.value ?? def.value));
                }}
                options={[
                  { value: 'all', label: t('settings.setting.companyWide') },
                  ...departments.map((d) => ({
                    value: d.id,
                    label: locale === 'ar' && d.name_ar ? d.name_ar : d.name_en,
                  })),
                ]}
              />
            )}
          </Field>
          <Field label={t('settings.setting.newValue')}>
            {(p) => (
              <SchemaEditor
                {...p}
                settingKey={def.key}
                schema={def.schema}
                value={value}
                onChange={setValue}
                label={label}
              />
            )}
          </Field>
          {def.effective_dated ? (
            <Field label={t('settings.setting.appliesFrom')}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="max-w-52 font-data"
                />
              )}
            </Field>
          ) : null}
          <Field
            label={t('settings.setting.reason')}
            error={reason.length > 0 && !reason.trim() ? t('settings.form.reasonRequired') : undefined}
          >
            {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <dl
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md bg-surface p-3 text-sm"
            data-setting-preview
            data-previewed={previewed?.previewed ? 'server' : undefined}
          >
            <dt className="text-muted">{t('settings.setting.preview.from')}</dt>
            <dd className="font-medium">
              <SchemaValue settingKey={def.key} value={previewed ? previewed.value_before : fromValue} />
            </dd>
            <dt className="text-muted">{t('settings.setting.preview.to')}</dt>
            <dd className="font-medium">
              {previewed ? (
                <SchemaValue settingKey={def.key} value={previewed.value_after} />
              ) : valid(def.schema, value) ? (
                <SchemaValue settingKey={def.key} value={value} />
              ) : (
                '—'
              )}
            </dd>
            <dt className="text-muted">{t('settings.setting.appliesFrom')}</dt>
            <dd>
              {(previewed ? previewed.valid_from : def.effective_dated ? from : today) !== today
                ? t('settings.setting.preview.fromDate', {
                    date: formatDate(new Date(previewed ? previewed.valid_from : from), locale, {
                      dateStyle: 'medium',
                    }),
                  })
                : t('settings.setting.preview.fromToday')}
              {previewed?.replaces_same_day ? ` · ${t('settings.setting.preview.replacesSameDay')}` : ''}
            </dd>
            {scope === 'all' && deptRows.length ? (
              <>
                <dt className="text-muted">{t('settings.setting.department')}</dt>
                <dd>{t('settings.setting.preview.departments', { count: deptRows.length })}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </Dialog>
    </section>
  );
}
