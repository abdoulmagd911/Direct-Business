'use client';
import { Check, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { avatarOf } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import type { HistoryRow } from '@/ui/record/history';
import type { KeyFigure } from '@/ui/record/KeyFigures';
import { RailField, RailSection } from '@/ui/record/Rail';
import { RecordPage } from '@/ui/record/RecordPage';
import type { TaskLookups } from '../load';
import { STATUS_TONE, TITLE_MAX, dueState, riyadhDay, statusView } from '../rules';
import type { TaskDetail } from '../types';
import { Checklist } from './Checklist';
import { StatusMenu, statusName, useStatusMove } from './StatusControl';
import { useCommandWords, useNames } from './words';

export type TaskRecordData = { task: TaskDetail; tab: string; history: HistoryRow[] | null; lookups: TaskLookups };

const TABS = ['overview', 'activity', 'related', 'items'] as const;

/**
 * A task's record (V95): the title, its number and where it belongs; its status (a menu of moves — V401) and flags;
 * three key figures; Done and Edit. Tabs Overview · Activity · Related · Action items; the rail holds every property.
 */
export function TaskRecord({ data }: { data: TaskRecordData }) {
  const t = useTranslations();
  const router = useRouter();
  const { task, history, lookups } = data;
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const tab = (TABS as readonly string[]).includes(data.tab) ? data.tab : 'overview';
  const today = riyadhDay(new Date());
  const view = statusView(task);
  const due = dueState(task, today);
  const closed = task.meaning === 'done' || task.meaning === 'cancelled';
  const move = useStatusMove(task, lookups.statuses);
  const [editing, setEditing] = useState(false);
  const status = lookups.statuses.find((s) => s.key === task.status);
  const statusLabel =
    view === 'blocked' ? t('pages.tasks.blocked') : status ? statusName(status, names.locale) : names.status(task);
  const date = (d: string | null) => (d ? formatDate(d, names.locale) : '');
  const people = Object.fromEntries((lookups.org?.people ?? []).map((p) => [p.id, avatarOf(p, names.locale)]));
  const where = task.project_id
    ? names.project(task.project_id)
    : task.partner_id
      ? names.partner(task.partner_id)
      : '';
  const openItems = task.action_items.filter((i) => !i.done_on).length;

  const figures: KeyFigure[] = [
    {
      key: 'items',
      label: t('pages.tasks.tabs.items'),
      value: t('pages.tasks.items.figure', { open: openItems, total: task.action_items.length }),
    },
    { key: 'due', label: t('pages.tasks.fields.due'), value: task.due_on ? date(task.due_on) : '—' },
    {
      key: 'last',
      label: t('pages.tasks.fields.lastActivity'),
      value: task.last_activity_on ? date(task.last_activity_on) : '—',
    },
  ];

  const chips = (
    <>
      <StatusMenu task={task} statuses={lookups.statuses} label={statusLabel} canEdit={task.can_edit} />
      {due === 'overdue' ? <StatusChip tone="danger">{t('status.overdue')}</StatusChip> : null}
      {task.stale ? <StatusChip tone="warning">{t('pages.tasks.flags.stale')}</StatusChip> : null}
      {task.past_work ? <StatusChip tone="neutral">{t('pages.tasks.flags.pastWork')}</StatusChip> : null}
      {task.executive_directive ? (
        <StatusChip tone="info">{names.locale === 'ar' ? task.priority_ar : task.priority_en}</StatusChip>
      ) : null}
    </>
  );
  const actions = task.can_edit ? (
    <>
      {!closed && move.markDone ? (
        <Button
          variant="primary"
          icon={<Check />}
          onClick={() => void move.markDone?.()}
          loading={move.busy}
          data-mark-done
        >
          {t('pages.tasks.markDoneShort')}
        </Button>
      ) : null}
      <Button icon={<Pencil />} onClick={() => setEditing(true)}>
        {t('common.edit')}
      </Button>
      {move.dialogs}
    </>
  ) : null;

  const rail = (
    <RailSection title={t('record.details')}>
      <RailField label={t('pages.tasks.fields.status')}>
        <StatusChip tone={STATUS_TONE[view]}>{statusLabel}</StatusChip>
      </RailField>
      <RailField label={t('pages.tasks.fields.owner')}>{names.person(task.owner_id)}</RailField>
      <RailField label={t('pages.tasks.fields.helpers')} empty={!task.helpers.length} add={<span>—</span>}>
        {task.helpers.map((h) => names.person(h)).join(', ')}
      </RailField>
      <RailField label={t('pages.tasks.fields.due')} empty={!task.due_on} add={<span>—</span>}>
        {date(task.due_on)}
      </RailField>
      <RailField label={t('pages.tasks.fields.start')} empty={!task.start_on} add={<span>—</span>}>
        {date(task.start_on)}
      </RailField>
      <RailField
        label={t('pages.tasks.fields.client')}
        empty={!task.partner_id}
        add={<span>{t('pages.tasks.internalWork')}</span>}
      >
        {names.partner(task.partner_id)}
      </RailField>
      <RailField label={t('pages.tasks.fields.project')} empty={!task.project_id} add={<span>—</span>}>
        {names.project(task.project_id)}
      </RailField>
      <RailField label={t('pages.tasks.fields.type')} empty={!task.type} add={<span>—</span>}>
        {names.locale === 'ar' ? task.type_ar : task.type_en}
      </RailField>
      <RailField label={t('pages.tasks.fields.raised')}>{date(task.happened_on)}</RailField>
      <RailField label={t('pages.tasks.fields.number')}>
        <span className="font-data">{task.number}</span>
      </RailField>
    </RailSection>
  );

  return (
    <>
      <RecordPage
        crumbs={[{ label: t('nav.tasks'), href: '/tasks' }]}
        back={{ href: '/tasks', label: t('record.back') }}
        title={task.title}
        subtitle={[task.number, where].filter(Boolean).join(' · ')}
        chips={chips}
        figures={figures}
        actions={actions}
        tabs={TABS.map((k) => ({
          key: k,
          label: t(`pages.tasks.tabs.${k}`),
          count: k === 'items' ? task.action_items.length : undefined,
        }))}
        tab={tab}
        tabHref={(k) => (k === 'overview' ? `/tasks/${task.number}` : `/tasks/${task.number}?tab=${k}`)}
        rail={rail}
        words={{ tabs: t('record.tabs'), notMeasured: t('common.notMeasured') }}
      >
        {tab === 'overview' ? (
          <div className="flex flex-col gap-6" data-overview>
            {view === 'blocked' ? (
              <div className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3" data-blocked-reason>
                <p className="text-sm font-semibold">
                  {t('pages.tasks.blockedSince', { date: date(task.blocked_on) })}
                </p>
                <p className="break-words text-base">{task.blocked_reason}</p>
              </div>
            ) : null}
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">{t('pages.tasks.fields.notes')}</h2>
              {task.notes ? (
                <p className="whitespace-pre-wrap break-words text-base">{task.notes}</p>
              ) : (
                <p className="text-base text-muted">{t('pages.tasks.noNotes')}</p>
              )}
            </section>
            <section className="flex flex-col gap-2" data-status-history>
              <h2 className="text-lg font-semibold">{t('pages.tasks.statusHistory')}</h2>
              {task.status_history.length ? (
                <ul className="flex flex-col gap-2">
                  {task.status_history.map((c, i) => {
                    const to = lookups.statuses.find((s) => s.key === c.to);
                    return (
                      <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted">{date(c.happened_on)}</span>
                        <span>{names.person(c.by)}</span>
                        <StatusChip tone={STATUS_TONE[c.blocked ? 'blocked' : c.meaning]}>
                          {c.blocked ? t('pages.tasks.blocked') : to ? statusName(to, names.locale) : c.to}
                        </StatusChip>
                        {c.reason ? <span className="break-words text-muted">{c.reason}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-base text-muted">{t('pages.tasks.noStatusChanges')}</p>
              )}
            </section>
          </div>
        ) : null}
        {tab === 'activity' ? (
          history ? (
            history.length ? (
              <ActivityTimeline rows={history} people={people} />
            ) : (
              <DataState kind="empty" message={t('record.noActivity')} />
            )
          ) : (
            <DataState
              kind="failed"
              message={t('state.failed', { what: t('pages.tasks.tabs.activity') })}
              onRetry={() => router.refresh()}
              retryLabel={t('common.tryAgain')}
            />
          )
        ) : null}
        {tab === 'related' ? (
          <div className="flex flex-col gap-4" data-related>
            <RailSection title={t('pages.tasks.tabs.related')}>
              <RailField
                label={t('pages.tasks.fields.client')}
                empty={!task.partner_id}
                add={<span>{t('pages.tasks.internalWork')}</span>}
              >
                {names.partner(task.partner_id)}
              </RailField>
              <RailField label={t('pages.tasks.fields.project')} empty={!task.project_id} add={<span>—</span>}>
                {names.project(task.project_id)}
              </RailField>
              <RailField label={t('pages.tasks.fields.references')} empty={!task.refs.length} add={<span>—</span>}>
                {task.refs
                  .map((r) => `${names.locale === 'ar' && r.system_ar ? r.system_ar : r.system_en} ${r.value}`)
                  .join(', ')}
              </RailField>
            </RailSection>
          </div>
        ) : null}
        {tab === 'items' ? <Checklist task={task} personName={names.person} locale={names.locale} /> : null}
      </RecordPage>
      <EditTask open={editing} onOpenChange={setEditing} task={task} />
    </>
  );
}

/** Edit the task's own words and days (api.task_update, checked against the version it was opened at). */
function EditTask({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: TaskDetail;
}) {
  const t = useTranslations();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.tasks.edit.title', { number: task.number })}
      closeLabel={t('common.close')}
    >
      {open ? <EditForm task={task} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function EditForm({ task, onClose }: { task: TaskDetail; onClose: () => void }) {
  const t = useTranslations();
  const words = useCommandWords();
  const stored = { title: task.title, due_on: task.due_on ?? '', notes: task.notes ?? '' };
  const [f, setF] = useState(stored);
  const [version] = useState(task.version);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const title = f.title.trim();
    if (!title) return setError(t('pages.tasks.add.title_required'));
    if (title.length > TITLE_MAX) return setError(t('pages.tasks.add.title_too_long', { max: TITLE_MAX }));
    // only what changed is sent (the old app's lesson): an untouched field never overwrites someone else's change
    const changes: Record<string, string | null> = {};
    if (title !== stored.title) changes.title = title;
    if (f.due_on !== stored.due_on) changes.due_on = f.due_on || null;
    if (f.notes.trim() !== stored.notes) changes.notes = f.notes.trim() || null;
    if (!Object.keys(changes).length) return onClose();
    setBusy(true);
    await command(
      words(t('pages.tasks.edit.saved', { number: task.number })),
      () =>
        rpc('task_update', { p_id: task.id, p_values: changes as never, p_version: version }) as Promise<{
          request_id?: string | null;
        }>,
      { after: onClose },
    );
    setBusy(false);
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      data-edit-task
    >
      <Field label={t('pages.tasks.fields.title')} error={error}>
        {(p) => <Input {...p} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} name="title" />}
      </Field>
      <Field label={t('pages.tasks.fields.due')}>
        {(p) => (
          <Input
            {...p}
            type="date"
            value={f.due_on}
            onChange={(e) => setF({ ...f, due_on: e.target.value })}
            name="due"
          />
        )}
      </Field>
      <Field label={t('pages.tasks.fields.notes')}>
        {(p) => (
          <Textarea
            {...p}
            rows={5}
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
            name="notes"
          />
        )}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit" loading={busy}>
          {t('common.saveChanges')}
        </Button>
      </div>
    </form>
  );
}
