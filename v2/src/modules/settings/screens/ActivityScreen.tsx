'use client';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Me } from '@/core/auth/me';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { modules } from '@/core/registry';
import { avatarOf, nameOf, type OrgAnswer } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import type { HistoryRow } from '@/ui/record/history';
import { Select } from '@/ui/Select';
import { PageFrame } from '@/ui/shell/AppShell';
import { Tabs } from '@/ui/Tabs';
import type { SettingsAnswer } from '../schema';
import { RecentlyDeleted, type DeletedRow } from './RecentlyDeleted';

export type SignInRow = {
  id: string;
  at: string;
  person_id: string | null;
  email: string;
  result: string;
  user_agent: string | null;
};

const TABS = ['changes', 'settings', 'signIns', 'deleted'] as const;

export type { DeletedRow } from './RecentlyDeleted';

/**
 * Activity (V97: its own page): the whole change log with filters (who, what, since) and Undo; the settings log with
 * Revert (V97: the previous value comes back as a new dated row, outside the Undo window); the sign-in log. Filters
 * live in the URL, so a view can be shared.
 */
export function ActivityScreen({
  me,
  tab,
  org,
  rows,
  signIns,
  deleted,
  filters,
}: {
  me: Me;
  tab: string;
  org: OrgAnswer;
  rows: HistoryRow[];
  signIns: SignInRow[];
  deleted: DeletedRow[];
  filters: { actor: string; entity: string; since: string; person: string };
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const current = (TABS as readonly string[]).includes(tab) ? tab : 'changes';
  const people = Object.fromEntries(org.people.map((p) => [p.id, avatarOf(p, locale)]));
  const entities: { key: string; label: string }[] = [];
  for (const m of modules)
    for (const e of m.entities ?? []) entities.push({ key: e.key, label: t.has(e.label) ? t(e.label) : e.key });
  const setFilter = (patch: Partial<typeof filters>) => {
    const q = new URLSearchParams({ tab: current });
    const next = { ...filters, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    router.push(`${pathname}?${q}`);
  };
  const [reverting, setReverting] = useState<HistoryRow | null>(null);
  const revert = async (reason: string) => {
    if (!reverting) return;
    const change = reverting.changes.find((c) => c.entity === 'setting' && c.action === 'insert');
    if (!change?.id) return;
    await run(
      {
        done: t('activity.reverted'),
        undo: t('common.undo'),
        undone: t('activity.undone'),
        has: (k) => t.has(k),
        failed: (k, d) => t(k, { detail: d }),
      },
      async () => {
        // The row this request wrote (api.settings_log carries each change's before and after — V97), then the value
        // that stood before it for the same key and department: a same-day change replaced the row that stood before
        // it (soft-removed in the same request — V131), and that row's value is what Revert brings back; else the
        // earlier dated row; else the default.
        const written = (change.after ?? {}) as { key?: string; department_id?: string | null; valid_from?: string };
        if (!written.key) throw new Error('common.not_found');
        const removed = reverting.changes.find((c) => c.entity === 'setting' && c.action === 'remove');
        const replaced = (removed?.before as { value?: unknown } | undefined)?.value;
        let previous: unknown = replaced;
        if (previous === undefined) {
          const group = modules.flatMap((m) => m.settings ?? []).find((s) => s.key === written.key)?.group;
          if (!group) throw new Error('setting.unknown');
          const answer = (await rpc('settings', { p_group: group } as never)) as unknown as SettingsAnswer;
          const def = answer.settings.find((s) => s.key === written.key)!;
          const earlier = def.rows
            .filter(
              (r) =>
                (r.department_id ?? null) === (written.department_id ?? null) &&
                r.valid_from < (written.valid_from ?? ''),
            )
            .sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];
          previous = earlier ? earlier.value : def.default;
        }
        return (await rpc('setting_set', {
          p_key: written.key,
          p_department: (written.department_id ?? null) as unknown as string,
          p_value: previous as never,
          p_reason: reason,
        })) as { request_id?: string | null } | null;
      },
      () => {
        setReverting(null);
        router.refresh();
      },
    );
  };
  const settingRows = rows.filter((r) => r.changes.some((c) => c.entity === 'setting'));
  return (
    <PageFrame className="[&>*]:max-w-[1100px]">
      <PageHeader title={t('nav.activity')} />
      <Tabs
        label={t('nav.activity')}
        value={current}
        tabs={TABS.map((k) => ({ value: k, label: t(`activity.tabs.${k}`), href: `/activity?tab=${k}` }))}
      />
      {current === 'deleted' ? null : current !== 'signIns' ? (
        <div className="grid gap-3 sm:grid-cols-3" data-activity-filters>
          <Field label={t('activity.filters.who')}>
            {(p) => (
              <Select
                {...p}
                value={filters.actor}
                onValueChange={(v) => setFilter({ actor: v })}
                placeholder={t('activity.filters.anyone')}
                options={org.people.map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
              />
            )}
          </Field>
          {current === 'changes' ? (
            <Field label={t('activity.filters.what')}>
              {(p) => (
                <Select
                  {...p}
                  value={filters.entity}
                  onValueChange={(v) => setFilter({ entity: v })}
                  placeholder={t('activity.filters.anything')}
                  options={entities
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((e) => ({ value: e.key, label: e.label }))}
                />
              )}
            </Field>
          ) : null}
          <Field label={t('activity.filters.since')}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={filters.since}
                onChange={(e) => setFilter({ since: e.target.value })}
                className="font-data"
              />
            )}
          </Field>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('activity.filters.who')}>
            {(p) => (
              <Select
                {...p}
                value={filters.person || me.person.id}
                onValueChange={(v) => setFilter({ person: v })}
                options={org.people.map((x) => ({ value: x.id, label: nameOf(x, locale) }))}
              />
            )}
          </Field>
        </div>
      )}
      {current === 'changes' ? (
        <section className="rounded-lg border border-border bg-raised px-5 py-2" data-activity-changes>
          <ActivityTimeline rows={rows} people={people} initial={50} onChanged={() => router.refresh()} />
        </section>
      ) : null}
      {current === 'settings' ? (
        <section className="rounded-lg border border-border bg-raised" data-activity-settings>
          {settingRows.length ? (
            <ul className="divide-y divide-border">
              {settingRows.map((r) => {
                const c =
                  r.changes.find((x) => x.entity === 'setting' && x.action === 'insert') ??
                  r.changes.find((x) => x.entity === 'setting');
                return (
                  <li
                    key={r.request_id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {r.label_key && t.has(`activity.labels.${r.label_key}`)
                          ? t(`activity.labels.${r.label_key}`)
                          : t('activity.actions.request')}
                        {c?.fields.length ? (
                          <span className="ms-2 font-data text-xs text-muted">{c.fields.join(', ')}</span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted">
                        {r.actor_id && people[r.actor_id]
                          ? people[r.actor_id]!.displayName
                          : t(`activity.kinds.${r.kind}`)}{' '}
                        · {formatDate(new Date(r.at), locale, { dateStyle: 'medium', timeStyle: 'short' })}
                        {r.reason ? ` · ${r.reason}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {r.undone ? <StatusChip tone="neutral">{t('activity.undoneChip')}</StatusChip> : null}
                      {c?.action === 'insert' ? (
                        <Button size="xs" onClick={() => setReverting(r)} data-setting-revert>
                          {t('activity.revert')}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <DataState kind="empty" message={t('activity.none')} />
          )}
        </section>
      ) : null}
      {current === 'signIns' ? (
        <section className="overflow-x-auto rounded-lg border border-border bg-raised" data-activity-sign-ins>
          {signIns.length ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{t('activity.signIn.at')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('activity.signIn.email')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('activity.signIn.result')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('activity.signIn.device')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {signIns.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-data text-xs">
                      {formatDate(new Date(s.at), locale, { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-2 font-data text-xs">{s.email}</td>
                    <td className="px-4 py-2">
                      <StatusChip tone={s.result === 'ok' || s.result === 'code_sent' ? 'success' : 'warning'}>
                        {t.has(`activity.signIn.results.${s.result}`)
                          ? t(`activity.signIn.results.${s.result}`)
                          : s.result}
                      </StatusChip>
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-2 text-xs text-muted">{s.user_agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <DataState kind="empty" message={t('activity.none')} />
          )}
        </section>
      ) : null}
      {current === 'deleted' ? <RecentlyDeleted rows={deleted} people={people} /> : null}
      <ReasonDialog
        open={reverting !== null}
        onOpenChange={(o) => !o && setReverting(null)}
        title={t('activity.revertTitle', {
          setting: reverting?.changes.find((c) => c.entity === 'setting')?.fields.join(', ') ?? '',
        })}
        body={t('activity.revertBody', { setting: t('entity.setting') })}
        onSave={revert}
        words={{
          reason: t('common.reason'),
          save: t('activity.revert'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
    </PageFrame>
  );
}
