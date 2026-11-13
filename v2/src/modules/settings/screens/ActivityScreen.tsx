'use client';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Me } from '@/core/auth/me';
import { run } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { deviceLabel } from '@/core/auth/device-label';
import { formatDate } from '@/core/i18n/format';
import { modules } from '@/core/registry';
import { avatarOf, describeWith, nameOf, summarizeWith, type OrgAnswer } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { DatePicker } from '@/ui/DatePicker';
import { ScrollCue } from '@/ui/ScrollCue';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Field } from '@/ui/Field';
import { PageHeader } from '@/ui/PageHeader';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import { fieldLabel, makeValueWords, plainWords, settingLabel, settingValueWords } from '@/ui/record/diff-words';
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

/** One What-filter option per displayed word (F-B1-07): "Achievement" is three record types, "Comment" two and
 * "Targets" three, and the picker offered the word three times over. One option keeps every key it stands for —
 * its value names them all, so the read still shows each one's rows. */
export function whatFilterOptions(entries: { key: string; label: string }[]): { value: string; label: string }[] {
  const byLabel = new Map<string, string[]>();
  for (const e of entries) {
    const keys = byLabel.get(e.label) ?? [];
    if (!keys.includes(e.key)) keys.push(e.key);
    byLabel.set(e.label, keys);
  }
  return [...byLabel.entries()]
    .map(([label, keys]) => ({ value: keys.join(','), label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** The rows of one request merged with older pages, by request, newest first (F-B4-04): a page never repeats a
 * request already read, however the cursor fell. */
export function mergeActivityRows(rows: HistoryRow[], page: HistoryRow[]): HistoryRow[] {
  const seen = new Set(rows.map((r) => r.request_id));
  return [...rows, ...page.filter((r) => !seen.has(r.request_id))];
}

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
  priorities,
  total,
  sinceIso,
}: {
  me: Me;
  tab: string;
  org: OrgAnswer;
  rows: HistoryRow[];
  signIns: SignInRow[];
  deleted: DeletedRow[];
  filters: { actor: string; entity: string; since: string; person: string };
  /** The priority list, for the History diff (F119, D36(a)): a priority id reads as its name, never as an id. */
  priorities: { id: string; name_en: string; name_ar: string | null }[];
  /** How many requests the Changes feed holds in all (the true total, F-B4-04): "Show all" names it. */
  total?: number;
  /** The Since filter as the instant the page's read used, so "Show earlier" asks for the same slice. */
  sinceIso?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const current = (TABS as readonly string[]).includes(tab) ? tab : 'changes';
  const people = Object.fromEntries(org.people.map((p) => [p.id, avatarOf(p, locale)]));
  const orgDescribe = describeWith(org, locale);
  const describe = (field: string, value: unknown) => {
    // a lookup id in words, never the id itself: the priority's name for its id (F119, D36(a))
    if (field === 'priority_id' && typeof value === 'string' && value) {
      const p = priorities.find((x) => x.id === value);
      return p ? (locale === 'ar' && p.name_ar ? p.name_ar : p.name_en) : null;
    }
    return orgDescribe(field, value);
  };
  const summarize = summarizeWith(org, locale, (name) => t('activity.reportsTo', { name }));
  const valueWords = makeValueWords({ t, locale, describe, people });
  const entities: { key: string; label: string }[] = [];
  for (const m of modules)
    for (const e of m.entities ?? []) entities.push({ key: e.key, label: t.has(e.label) ? t(e.label) : e.key });
  // The Settings log names the setting, not its columns (F-B5-13(c), O1): a setting change carries the setting
  // row itself, so its key reads by its wording and its value before → after in words. The value that stood
  // before is the replaced row's, soft-removed in the same request (V131) — the insert itself carries none.
  const settingEntry = (r: HistoryRow) => {
    const insert = r.changes.find((x) => x.entity === 'setting' && x.action === 'insert');
    const removed = r.changes.find((x) => x.entity === 'setting' && x.action === 'remove');
    const c = insert ?? removed ?? r.changes.find((x) => x.entity === 'setting');
    if (!c) return null;
    const rec = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    const after = rec(c.after);
    const before = rec(c.before) ?? rec(removed?.before);
    const key = typeof after?.key === 'string' ? after.key : typeof before?.key === 'string' ? before.key : null;
    if (!key) return null;
    const name = settingLabel(t, key) ?? plainWords(key);
    const hasValue = before?.value !== undefined || after?.value !== undefined;
    return {
      key,
      name,
      valueText: hasValue
        ? `${settingValueWords(t, key, before?.value, valueWords)} → ${settingValueWords(t, key, after?.value, valueWords)}`
        : null,
    };
  };
  // Older pages of the Changes feed, read in the browser (F-B4-04): the page's read caps at 500, and "Show
  // earlier" walks back from the oldest row read, by (at, id) so no request on the boundary is skipped. A
  // filter change drops the extra pages — they belong to the old slice. A refresh keeps them: the merge drops
  // any request the fresh first page already holds.
  const filterKey = [current, filters.actor, filters.entity, filters.since].join('|');
  const [extraRows, setExtraRows] = useState<HistoryRow[]>([]);
  const [extraKey, setExtraKey] = useState(filterKey);
  if (extraKey !== filterKey) {
    setExtraKey(filterKey);
    setExtraRows([]);
  }
  const allRows = mergeActivityRows(rows, extraRows);
  const hasEarlier = total !== undefined && allRows.length < total;
  const loadEarlier = async () => {
    const last = allRows[allRows.length - 1];
    if (!last || !hasEarlier) return;
    const page = (await rpc('activity', {
      p_actor: filters.actor || undefined,
      p_entities: filters.entity
        ? filters.entity
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
      p_since: sinceIso ?? undefined,
      p_before: last.at,
      p_before_id: last.request_id,
      p_limit: 500,
    })) as unknown as HistoryRow[];
    setExtraRows((prev) => mergeActivityRows(prev, page));
  };
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
  // The Settings log is every request that touched a Settings page (api.settings_log — V210): a person, a team, a list
  // entry, access — not only a setting's value. Only those survived here, so the log said "No changes yet" over a
  // month of people and list changes. Its Who and Since apply here too: the log's read takes neither.
  const riyadhDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const settingRows = rows.filter(
    (r) =>
      (!filters.actor || r.actor_id === filters.actor) &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(filters.since) || riyadhDay(r.at) >= filters.since),
  );
  // a change that is not a setting's value is named by what changed: "Person changed: Left on", "Allowed email added"
  const entityLabels = Object.fromEntries(entities.map((e) => [e.key, e.label]));
  const changeTitle = (r: HistoryRow) => {
    const c = r.changes[0];
    if (!c || !t.has(`activity.actions.${c.action}`)) return t('activity.actions.request');
    const what = entityLabels[c.entity ?? ''] ?? plainWords(c.entity ?? '');
    return t(`activity.actions.${c.action}`, { what, fields: c.fields.map((f) => fieldLabel(t, f)).join(', ') });
  };
  // Revert writes the setting again (api.setting_set needs Full on the setting's page — admins only, V97): offered to
  // whoever can, never to a head or manager who reads the log and would be refused; and not on a change already undone
  // (its value no longer stands — Revert would write the value that stands now).
  const canRevert = (r: HistoryRow) => {
    if (r.undone) return false;
    const after = r.changes.find((c) => c.entity === 'setting' && c.action === 'insert')?.after as
      { key?: string } | undefined;
    const group = modules.flatMap((m) => m.settings ?? []).find((s) => s.key === after?.key)?.group;
    return !!group && me.levels[group] === 'full';
  };
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
                  options={whatFilterOptions(entities)}
                />
              )}
            </Field>
          ) : null}
          <Field label={t('activity.filters.since')}>
            {(p) => (
              <DatePicker
                id={p.id}
                describedBy={p['aria-describedby']}
                invalid={p['aria-invalid']}
                value={filters.since || undefined}
                // a whole day (or a cleared box) filters; the box keeps half-typed text itself — each keystroke was
                // a new address and a page load
                onChange={(v) => {
                  if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) setFilter({ since: v ?? '' });
                }}
                // no Today chip above the box: it pushed the box below the Who and What pickers beside it
                chips="none"
                className="font-data"
              />
            )}
          </Field>
        </div>
      ) : (me.levels['settings.org'] ?? 'none') !== 'none' ? (
        // whose sign-ins: anyone's for People & access · View (api.sign_in_log); everyone else sees their own, and is
        // offered no picker of names the database would refuse
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
      ) : null}
      {current === 'changes' ? (
        <section className="rounded-lg border border-border bg-raised px-5 py-2" data-activity-changes>
          <ActivityTimeline
            rows={allRows}
            people={people}
            initial={50}
            onChanged={() => router.refresh()}
            describe={describe}
            summarize={summarize}
            undoEvery
            totalCount={total}
            hasEarlier={hasEarlier}
            onLoadEarlier={loadEarlier}
          />
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
                const entry = settingEntry(r);
                return (
                  <li
                    key={r.request_id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {/* a setting by its name and its value before → after; any other change by what changed */}
                      <span className="font-medium [overflow-wrap:anywhere]" data-setting-log-title>
                        {entry ? (
                          <>
                            {entry.name}
                            {entry.valueText ? (
                              <span className="ms-2 font-data text-xs font-normal text-muted">{entry.valueText}</span>
                            ) : null}
                          </>
                        ) : (
                          changeTitle(r)
                        )}
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
                      {c?.action === 'insert' && canRevert(r) ? (
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
        <ScrollCue className="rounded-lg border border-border bg-raised" data-activity-sign-ins>
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
                    <td className="max-w-[320px] truncate px-4 py-2 text-xs text-muted" title={s.user_agent ?? ''}>
                      {deviceLabel(s.user_agent) ?? s.user_agent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <DataState kind="empty" message={t('activity.none')} />
          )}
        </ScrollCue>
      ) : null}
      {current === 'deleted' ? <RecentlyDeleted rows={deleted} people={people} /> : null}
      <ReasonDialog
        open={reverting !== null}
        onOpenChange={(o) => !o && setReverting(null)}
        title={t('activity.revertTitle', {
          setting: reverting ? (settingEntry(reverting)?.name ?? '') : '',
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
