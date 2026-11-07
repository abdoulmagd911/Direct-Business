'use client';
import { AlarmClockPlus, Check, Megaphone, Pencil, Trash2, Trophy, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { clip, formatDate } from '@/core/i18n/format';
import { avatarOf } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import { OpenAskChips, RecordHeaderCounts } from '@/ui/record/Comments';
import { FilesSection, type RecordFile } from '@/ui/record/FilesSection';
import { openQuickCapture } from '@/modules/my-day/quick-capture';
import { FollowUpChips } from '@/ui/record/FollowUp';
import type { HistoryRow } from '@/ui/record/history';
import type { KeyFigure } from '@/ui/record/KeyFigures';
import { RailField, RailSection } from '@/ui/record/Rail';
import { RecordPage } from '@/ui/record/RecordPage';
import type { TaskLookups } from '../load';
import { STATUS_TONE, TITLE_MAX, achievementStrip, dueState, riyadhDay, statusView, taskIsTestOwned } from '../rules';
import type { TaskComments as Comments, TaskDetail } from '../types';
import { Checklist } from './Checklist';
import { Delegate } from './Delegate';
import { TaskComments } from './TaskComments';
import { Escalate } from './Escalate';
import { StarMark, StarToggle } from './StarToggle';
import { DATE_MAX } from './DueDayPicker';
import { StatusMenu, statusName, useStatusMove } from './StatusControl';
import { HelpersField, OwnerPicker } from './TaskPeople';
import { useCommandWords, useNames } from './words';

export type TaskRecordData = {
  task: TaskDetail;
  tab: string;
  /** The Discussion filter the record opened with ('files' from the header's files count). */
  filter?: string;
  history: HistoryRow[] | null;
  /** The comments (V657); null when they could not be read. */
  comments: Comments | null;
  /** The task's files (null when they could not be read); the header's files count and the Discussion stream read them. */
  files: RecordFile[] | null;
  lookups: TaskLookups;
};

const TABS = ['overview', 'discussion', 'history', 'items'] as const;
/** The old tab addresses still land on the right tab: ?tab=comments is the Discussion, ?tab=activity is the History. */
const TAB_ALIASES: Record<string, string> = { comments: 'discussion', activity: 'history' };

/**
 * A task's record (V95): the title, its number and where it belongs; its status (a menu of moves — V401) and flags;
 * three key figures; Done and Edit. Tabs Overview · Discussion · History · Action items; the rail holds every property.
 * Related lives in Overview as a section (Phase 4, the one layout: at most one record-specific tab — Items).
 */
export function TaskRecord({ data }: { data: TaskRecordData }) {
  const t = useTranslations();
  const router = useRouter();
  const me = useMe();
  const { task, history, comments, files, lookups } = data;
  const names = useNames(lookups.org, lookups.partners, lookups.projects);
  const tab = (TABS as readonly string[]).includes(TAB_ALIASES[data.tab] ?? data.tab)
    ? (TAB_ALIASES[data.tab] ?? data.tab)
    : 'overview';
  const discussionFilter =
    data.filter === 'files' || data.filter === 'questions' ? (data.filter as 'files' | 'questions') : undefined;
  const today = riyadhDay(new Date());
  const view = statusView(task);
  const due = dueState(task, today);
  const closed = task.meaning === 'done' || task.meaning === 'cancelled';
  const move = useStatusMove(task, lookups.statuses);
  // Details' pickers (V287): helpers by whoever may edit the task, the owner by whoever gives work (`tasks.assign`)
  const mayHelp = task.can_edit && !closed;
  const mayAssign = mayHelp && me.capabilities.includes('tasks.assign');
  const [editing, setEditing] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [removing, setRemoving] = useState(false);
  // how many of my follow-ups the chip row shows: with one there, an empty Notes says "No other notes"
  const [followUps, setFollowUps] = useState(0);
  // the Comments tab's own count while it is open, so the tab's number follows an add or a delete at once
  const [commentCount, setCommentCount] = useState<number | null>(null);
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
  // Action items have their own tab (with its count), so no figure repeats them; Due is a figure, not a Details line
  const figures: KeyFigure[] = [
    { key: 'due', label: t('pages.tasks.fields.due'), value: task.due_on ? date(task.due_on) : '—' },
    {
      key: 'last',
      label: t('pages.tasks.fields.lastActivity'),
      value: task.last_activity_on ? date(task.last_activity_on) : '—',
    },
  ];

  const chips = (
    <>
      {/* the importance star (Phase 1): a 44 px tap for whoever may change the task, a plain mark for one who
          only helps — the row now carries it (work.task_row 'starred'). */}
      {task.can_edit ? (
        <StarToggle id={task.id} door="task_star" starred={task.starred} title={task.title} number={task.number} />
      ) : (
        <StarMark starred={task.starred} />
      )}
      <StatusMenu task={task} statuses={lookups.statuses} label={statusLabel} canEdit={task.can_edit} />
      {due === 'overdue' ? <StatusChip tone="danger">{t('status.overdue')}</StatusChip> : null}
      {task.stale ? <StatusChip tone="warning">{t('pages.tasks.flags.stale')}</StatusChip> : null}
      {task.escalated ? <StatusChip tone="warning">{t('pages.tasks.escalate.flag')}</StatusChip> : null}
      {task.past_work ? <StatusChip tone="neutral">{t('pages.tasks.flags.pastWork')}</StatusChip> : null}
      {task.executive_directive ? (
        <StatusChip tone="info">{names.locale === 'ar' ? task.priority_ar : task.priority_en}</StatusChip>
      ) : null}
      <FollowUpChips entity="task" id={task.id} onCount={setFollowUps} />
      <OpenAskChips
        items={(comments?.comments ?? []).filter((c) => c.question_open)}
        personName={names.person}
        href={`/tasks/${task.number}?tab=discussion`}
      />
      <RecordHeaderCounts
        comments={commentCount ?? comments?.comments.length ?? null}
        files={files?.length ?? null}
        href={(f) => `/tasks/${task.number}?tab=discussion${f === 'files' ? '&filter=files' : ''}`}
      />
    </>
  );
  // Mark done stays the one main action (V630). Done and Edit are the visible buttons; Follow up, Delegate,
  // Remove and Log achievement sit behind one ⋯ menu that exists on desktop and on phone (Phase 0.1).
  // Need help (Phase 5, Escalate renamed in place) is a labelled button for whoever may change an open task, its
  // one line of what it does as its title (E, 26 Oct): no longer in the ⋯ menu.
  const follow = { entity: 'task' as const, id: task.id, label: `${task.number} · ${task.title}` };
  const escalatable = task.can_edit && !closed;
  // Log achievement is offered on a done task only, to whoever may log achievements (the kpis level, as the
  // Done toast used to check); it opens the same form address the strip uses (Phase 1).
  const canLog = ['own', 'full'].includes(me.levels.kpis ?? 'none');
  // The persistent strip (Phase 1, CUJ 7): a done, nudge-eligible task closed after this build ships shows it
  // until its achievement is logged or it is dismissed; a dismissed one shows its Undo line instead.
  const strip = canLog ? achievementStrip(task) : 'hide';
  const logAchievementUrl = `/kpis/achievements/new?title=${encodeURIComponent(clip(task.title, 300))}&task=${task.id}`;
  // Remove is test-only: the task's owner or creator is a TEST user. The server refuses
  // anything else, so this only hides the control on real tasks; it never decides access.
  const words = useCommandWords();
  const mayRemove = task.can_edit && taskIsTestOwned(task, lookups.org?.people ?? []);
  const reasonWords = {
    reason: t('pages.tasks.dialogs.reason'),
    save: t('pages.tasks.actions.save'),
    cancel: t('pages.tasks.actions.cancel'),
    reasonRequired: t('pages.tasks.dialogs.reasonRequired'),
  };
  const remove = async (why: string) => {
    await command(
      words(t('removed')),
      () =>
        rpc('test_tasks_remove', { p_ids: [task.id], p_reason: why }) as Promise<{
          request_id?: string | null;
        }>,
      { after: () => router.push('/tasks') },
    );
  };
  // Dismiss the task from the achievement nudge, or bring it back (Phase 1): one request, Undo offered.
  const dismissStrip = async (dismissed: boolean) => {
    await command(
      words(t(dismissed ? 'pages.tasks.achievementStrip.dismissedDone' : 'pages.tasks.achievementStrip.restoredDone')),
      () =>
        rpc('task_nudge_dismiss', { p_id: task.id, p_dismissed: dismissed }) as Promise<{
          request_id?: string | null;
        }>,
    );
  };
  // Acknowledge the flag (Phase 5): only the manager the task was flagged to sees this; it clears the flag and
  // tells the person who flagged it. One request, Undo offered.
  const acknowledge = async () => {
    await command(
      words(t('pages.tasks.escalate.acknowledged')),
      () => rpc('escalate_acknowledge', { p_id: task.id }) as Promise<{ request_id?: string | null }>,
    );
  };
  const actions = (
    <>
      {task.can_edit && !closed && move.markDone ? (
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
      {/* On a phone the row holds Done, Need help and the ⋯: Edit goes behind the dots (V641, V633), since four
          buttons do not fit one row at 375 px and the dots would sit alone on a second one. */}
      {task.can_edit ? (
        <Button icon={<Pencil />} className="max-sm:hidden" onClick={() => setEditing(true)} data-edit-task-open>
          {t('common.edit')}
        </Button>
      ) : null}
      {escalatable ? (
        <Button
          icon={<Megaphone />}
          title={t('pages.tasks.escalate.what')}
          onClick={() => setEscalating(true)}
          data-escalate-open
        >
          {t('pages.tasks.escalate.open')}
        </Button>
      ) : null}
      {task.escalated && me.person.id === task.escalated_to ? (
        <Button icon={<Check />} onClick={() => void acknowledge()} data-escalate-acknowledge>
          {t('pages.tasks.escalate.acknowledge')}
        </Button>
      ) : null}
      <Menu>
        <MenuTrigger asChild>
          <Button aria-label={t('common.more')} data-task-more>
            ⋯
          </Button>
        </MenuTrigger>
        <MenuContent>
          {task.can_edit ? (
            <MenuItem icon={<Pencil />} className="sm:hidden" onSelect={() => setEditing(true)} data-menu-edit>
              {t('common.edit')}
            </MenuItem>
          ) : null}
          <MenuItem icon={<AlarmClockPlus />} onSelect={() => openQuickCapture({ about: follow })} data-menu-follow-up>
            {t('record.followUp')}
          </MenuItem>
          {mayAssign ? (
            <MenuItem icon={<UserPlus />} onSelect={() => setDelegating(true)} data-menu-delegate>
              {t('pages.tasks.delegate.open')}
            </MenuItem>
          ) : null}
          {task.meaning === 'done' && canLog ? (
            <MenuItem icon={<Trophy />} onSelect={() => router.push(logAchievementUrl)} data-menu-log-achievement>
              {t('pages.achievements.offerAction')}
            </MenuItem>
          ) : null}
          {mayRemove ? (
            <MenuItem icon={<Trash2 />} onSelect={() => setRemoving(true)} data-menu-remove>
              {t('common.remove')}
            </MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
      {task.can_edit ? move.dialogs : null}
      {mayRemove ? (
        <ReasonDialog
          open={removing}
          onOpenChange={setRemoving}
          title={t('pages.tasks.dialogs.remove')}
          destructive
          words={reasonWords}
          onSave={async (why) => {
            await remove(why);
            setRemoving(false);
          }}
        />
      ) : null}
    </>
  );

  const rail = (
    <RailSection title={t('record.details')}>
      <RailField label={t('pages.tasks.fields.status')}>
        <StatusChip tone={STATUS_TONE[view]}>{statusLabel}</StatusChip>
      </RailField>
      <RailField label={t('pages.tasks.fields.owner')}>
        {mayAssign ? (
          <OwnerPicker task={task} people={lookups.org?.people ?? []} locale={names.locale} />
        ) : (
          names.person(task.owner_id)
        )}
      </RailField>
      <RailField label={t('pages.tasks.fields.helpers')} empty={!mayHelp && !task.helpers.length} add={<span>—</span>}>
        {mayHelp ? (
          <HelpersField task={task} people={lookups.org?.people ?? []} locale={names.locale} />
        ) : (
          task.helpers.map((h) => names.person(h)).join(', ')
        )}
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
          count:
            k === 'items'
              ? task.action_items.length
              : k === 'discussion'
                ? (commentCount ?? comments?.comments.length ?? undefined)
                : undefined,
        }))}
        tab={tab}
        tabHref={(k) => (k === 'overview' ? `/tasks/${task.number}` : `/tasks/${task.number}?tab=${k}`)}
        rail={rail}
        words={{ tabs: t('record.tabs'), notMeasured: t('common.notMeasured') }}
      >
        {tab === 'overview' ? (
          <div className="flex flex-col gap-6" data-overview>
            {strip === 'show' ? (
              <div
                className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-raised px-4 py-3"
                data-achievement-strip
              >
                <p className="min-w-0 flex-1 text-base">{t('pages.tasks.achievementStrip.text')}</p>
                <Button variant="primary" onClick={() => router.push(logAchievementUrl)} data-strip-log>
                  {t('pages.achievements.offerAction')}
                </Button>
                <Button variant="ghost" onClick={() => void dismissStrip(true)} data-strip-dismiss>
                  {t('pages.tasks.achievementStrip.not')}
                </Button>
              </div>
            ) : null}
            {strip === 'dismissed' ? (
              <div
                className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-4 py-3"
                data-achievement-strip-dismissed
              >
                <p className="min-w-0 flex-1 text-base text-muted">{t('pages.tasks.achievementStrip.dismissed')}</p>
                <Button variant="ghost" onClick={() => void dismissStrip(false)} data-strip-restore>
                  {t('pages.tasks.achievementStrip.undo')}
                </Button>
              </div>
            ) : null}
            {view === 'blocked' ? (
              <div className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3" data-blocked-reason>
                <p className="text-sm font-semibold">
                  {t('pages.tasks.blockedSince', { date: date(task.blocked_on) })}
                </p>
                <p className="break-words text-base">{task.blocked_reason}</p>
              </div>
            ) : null}
            {task.meaning === 'cancelled' && task.cancelled_reason ? (
              <div className="rounded-md border border-border bg-surface px-4 py-3" data-cancelled-reason>
                <p className="text-sm font-semibold">{t('pages.tasks.board.cancelledLabel')}</p>
                <p className="break-words text-base">{task.cancelled_reason}</p>
              </div>
            ) : null}
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">{t('pages.tasks.fields.notes')}</h2>
              {task.notes ? (
                <p className="whitespace-pre-wrap break-words text-base">{task.notes}</p>
              ) : (
                <p className="text-base text-muted" data-no-notes>
                  {t(followUps ? 'pages.tasks.noOtherNotes' : 'pages.tasks.noNotes')}
                </p>
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
            {/* Related lives here now (Phase 4, the one layout): its own tab is gone. */}
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
          </div>
        ) : null}
        {tab === 'discussion' ? (
          <div className="flex flex-col gap-6" data-discussion>
            {comments ? (
              <TaskComments
                task={task}
                data={comments}
                personName={names.person}
                locale={names.locale}
                people={(lookups.org?.people ?? []).map((p) => ({ id: p.id, name: names.person(p.id) }))}
                onCount={setCommentCount}
                files={files}
                onFilesRetry={() => router.refresh()}
                initialFilter={discussionFilter}
              />
            ) : (
              <DataState
                kind="failed"
                message={t('state.failed', { what: t('pages.tasks.tabs.discussion') })}
                onRetry={() => router.refresh()}
                retryLabel={t('common.tryAgain')}
              />
            )}
            <FilesSection
              entity="task"
              recordId={task.id}
              kinds={[{ kind: 'evidence', purpose: 'evidence', label: t('record.files.kinds.evidence') }]}
              files={files}
              mayWrite={task.can_edit}
              onDone={() => router.refresh()}
              title={t('record.files.title')}
            />
          </div>
        ) : null}
        {tab === 'history' ? (
          history ? (
            history.length ? (
              <ActivityTimeline
                rows={history}
                people={people}
                describe={(field, v) => {
                  // the task's own ids in words (B): its status, client and project by name, never an id
                  if (typeof v !== 'string' || !v) return null;
                  if (field === 'status_id') {
                    const s = lookups.statuses.find((x) => x.id === v);
                    return s ? (names.locale === 'ar' ? s.name_ar : s.name_en) : null;
                  }
                  if (field === 'partner_id') return names.partner(v) || null;
                  if (field === 'project_id') return names.project(v) || null;
                  return null;
                }}
              />
            ) : (
              <DataState kind="empty" message={t('record.noActivity')} />
            )
          ) : (
            <DataState
              kind="failed"
              message={t('state.failed', { what: t('pages.tasks.tabs.history') })}
              onRetry={() => router.refresh()}
              retryLabel={t('common.tryAgain')}
            />
          )
        ) : null}
        {tab === 'items' ? <Checklist task={task} personName={names.person} locale={names.locale} /> : null}
      </RecordPage>
      <EditTask open={editing} onOpenChange={setEditing} task={task} />
      <Escalate open={escalating} onOpenChange={setEscalating} task={task} org={lookups.org} />
      <Delegate open={delegating} onOpenChange={setDelegating} task={task} org={lookups.org} />
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
      // No dirty flag here on purpose: making the dialog always dirty also blocked Escape, which the
      // phone-actions test (and a user closing a clean edit) relies on. Clearing the due date is done
      // by the dialog's own Clear button next to the field, not by the browser picker's Clear.
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
          <div className="flex items-center gap-2">
            <Input
              {...p}
              type="date"
              max={DATE_MAX}
              value={f.due_on}
              onChange={(e) => setF({ ...f, due_on: e.target.value })}
              name="due"
              className="min-w-0 flex-1"
            />
            {f.due_on ? (
              <Button type="button" variant="ghost" onClick={() => setF({ ...f, due_on: '' })} data-edit-due-clear>
                {t('pages.tasks.add.dueClear')}
              </Button>
            ) : null}
          </div>
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
