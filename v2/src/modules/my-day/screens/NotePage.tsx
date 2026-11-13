'use client';
import { MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { formatDate } from '@/core/i18n/format';
import { tradeName, type ListEntry } from '@/modules/partners/types';
import { today, useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { DatePicker } from '@/ui/DatePicker';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input, Textarea } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { rpc } from '@/core/db/rpc';
import { checklistCount, noteTitle } from '../logic';
import { NOTE_VISIBILITIES, type MyNote, type NoteItem, type PartnerRef, type TurnKind } from '../types';
import { KIND_ICON, LinkChip, VisibilityChip } from './NoteBits';
import { PeoplePicker } from './PeoplePicker';
import { PartnerPicker } from './PartnerPicker';
import { ChecklistItemDialog, LogFromNoteDialog, ReminderDialog, TurnIntoMenu } from './TurnDialogs';
import { useMe } from '@/core/auth/me-context';
import { AchievementFromNoteDialog } from '@/modules/perf/screens/AchievementFromNote';
import type { OrgAnswer } from '@/modules/org/types';
import { TITLE_MAX } from '@/modules/tasks/rules';
import { QuickAdd } from '@/modules/tasks/screens/QuickAdd';
import type { NamePick } from '@/modules/tasks/types';
import type { AvatarPerson } from '@/ui/Avatar';
import { DataState } from '@/ui/DataState';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import { Comments, RecordHeaderCounts, type RecordComments } from '@/ui/record/Comments';
import { FilesSection, type RecordFile } from '@/ui/record/FilesSection';
import type { HistoryRow } from '@/ui/record/history';

type Draft = {
  title: string;
  body: string;
  items: NoteItem[];
  visibility: MyNote['visibility'];
  shared_with: string[];
  mentions: string[];
  happened_on: string;
  meeting_partner: PartnerRef | null;
  meeting_on: string;
};

/** A day as the date box carries it up once it reads as one (YYYY-MM-DD). */
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

const draftOf = (n: MyNote, partner: PartnerRef | null): Draft => ({
  title: n.title ?? '',
  body: n.body ?? '',
  items: n.items,
  visibility: n.visibility,
  shared_with: n.shared_with ?? [],
  mentions: n.mentions ?? [],
  happened_on: n.happened_on,
  meeting_partner: partner,
  meeting_on: n.meeting_on ?? '',
});

/**
 * A note's own page (V433; the canvas's "My day / My notes / …"): the title, the words, a checklist's rows or a
 * meeting's points, and beside them who sees it, the organisation and the day; Turn into, Finish meeting for a meeting,
 * and what the note became — each chip opens it. Only its author edits it; a colleague reading a shared note reads.
 * Below the body, in order: Discussion (comments, with the note's file entries in the stream, and the Files section)
 * then History. An idea is a note with capture_kind='idea', so it uses this same screen. A private note stays
 * author-only, including its comments; QuickCapture stays text-only (a file is attached after the note exists).
 */
export function NotePage({
  note,
  author,
  types,
  outcomes,
  taskLookups,
  colleagues = [],
  comments,
  files,
  history,
  people,
  meName,
}: {
  note: MyNote;
  author?: string;
  /** Whom the author may share the note with, by name (G, V524): every other active colleague. */
  colleagues?: { id: string; name: string; team_id?: string | null; is_admin?: boolean }[];
  /** The names a task from this note points at; absent for someone who may not make tasks (no Task in Turn into). */
  taskLookups?: { org: OrgAnswer | null; partners: NamePick[]; projects: NamePick[]; priorities: ListEntry[] };
  types: ListEntry[];
  outcomes: ListEntry[];
  /** The Discussion's comments; null when they could not be read. */
  comments: RecordComments | null;
  /** The note's files (null when they could not be read); the header's files count and the Discussion stream read them. */
  files: RecordFile[] | null;
  /** The note's change log; null when it could not be read. */
  history: HistoryRow[] | null;
  /** Who is who, for the History chips: from api.org(). */
  people: Record<string, AvatarPerson>;
  /** The reader's own display name, for the optimistic comment row. */
  meName: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  // an achievement is logged by its own people: Own or Full on KPIs (V377); anyone else is not offered it
  const kpis = useMe().levels.kpis ?? 'none';
  const canAchieve = kpis === 'own' || kpis === 'full';
  const router = useRouter();
  const partner = note.meeting_partner;
  const fresh = () => draftOf(note, partner);
  const [d, setD] = useState<Draft>(fresh);
  // a newer version (my own save, or a refresh) restarts the form from it; the page and any open dialog stay
  const [seen, setSeen] = useState(note.version);
  if (note.version !== seen) {
    setSeen(note.version);
    setD(fresh());
  }
  const [busy, setBusy] = useState(false);
  const [turning, setTurning] = useState<TurnKind | 'finish' | null>(null);
  const [removing, setRemoving] = useState(false);
  /** FIX-27: "also delete its reminder" — off until ticked, and reset every time the remove dialog opens. */
  const [deleteReminder, setDeleteReminder] = useState(false);
  // The Discussion's own count while it is open, so the header's comments count follows an add or a delete at once.
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(fresh());
  // a note always has the day it happened; a meeting's day may be left empty. A box that was cleared, or holds words
  // that are not a day yet, says so and keeps Save off — before, Save went ahead: the database kept the old day without
  // a word, or refused the half-typed one in its own terms
  const dayBad = !isDay(d.happened_on);
  const meetingBad = d.meeting_on !== '' && !isDay(d.meeting_on);
  const title = noteTitle(note) || t('pages.myDay.note.untitled');
  const Icon = KIND_ICON[note.kind];
  const count = checklistCount({ items: d.items });
  const mine = note.mine;
  // QA-594: the reader is not among the colleagues offered, so a colleague reading a note shared with them is "You"
  const mePerson = useMe().person;
  const me = mePerson.id;
  const nameOf = (id: string) =>
    id === me ? t('pages.myDay.visibility.you') : (colleagues.find((c) => c.id === id)?.name ?? '—');
  const addable = colleagues.filter((c) => !d.shared_with.includes(c.id));
  // Who can see this note: the Mention picker offers only them, and so does the Ask picker (F065) — offering
  // anyone else would only end in a refusal ("That person cannot see this record").
  const canSee = (c: (typeof colleagues)[number]) =>
    d.visibility === 'person'
      ? d.shared_with.includes(c.id)
      : d.visibility === 'team'
        ? (mePerson.team_id !== null && c.team_id === mePerson.team_id) || c.is_admin === true
        : true;
  // A mention only notifies someone who can see the note (the database refuses otherwise), so on a
  // named-colleagues note only colleagues already shared with are offered; on a team note only
  // colleagues on the author's team (or the owner Admin account, who sees team notes) are offered;
  // on workspace notes anyone is. Offering anyone else would only end in a refusal.
  const mentionable = colleagues.filter((c) => !d.mentions.includes(c.id) && canSee(c));

  const save = async () => {
    setBusy(true);
    await command(
      words(t('pages.myDay.note.saved', { kind: note.kind })),
      () =>
        rpc('note_update', {
          p_id: note.id,
          p_version: note.version,
          p_mentions: d.mentions,
          p_values: {
            title: d.title.trim() || null,
            body: d.body.trim() || null,
            items: d.items.filter((i) => i.text.trim()).map((i) => ({ ...i, text: i.text.trim() })),
            visibility: d.visibility,
            shared_with: d.visibility === 'person' ? d.shared_with : null,
            happened_on: d.happened_on,
            meeting_partner_id: d.meeting_partner?.id ?? null,
            meeting_on: d.meeting_on || null,
          },
        }) as Promise<{ request_id?: string | null }>,
    );
    setBusy(false);
  };
  const remove = async (reason: string) => {
    setBusy(true);
    await command(
      words(t('pages.myDay.note.removed')),
      () =>
        rpc('my_notes_remove', {
          p_ids: [note.id],
          p_reason: reason,
          // FIX-27: the reminder goes only when the person ticks the offer — never silently.
          ...(deleteReminder ? { p_delete_reminders: true } : {}),
        }) as Promise<{ request_id?: string | null }>,
      {
        // The note stays open with the Undo in place (D22): the re-read renders the note's "not there" state.
        after: () => router.refresh(),
      },
    );
    setBusy(false);
    setRemoving(false);
  };
  const item = (i: number, patch: Partial<NoteItem>) =>
    setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="flex flex-col gap-5" data-note-page={note.id} data-note-kind={note.kind}>
      <PageHeader
        crumbs={[
          { label: t('nav.my_day'), href: '/my-day' },
          // the list the note sits on: my own notes, or what my team or everyone shares (a note shared with me by name
          // sits with my team's, V524) — never "My notes" for a colleague's note
          mine
            ? { label: t('pages.myDay.blocks.me') }
            : note.visibility === 'workspace'
              ? { label: t('pages.myDay.blocks.workspace'), href: '/my-day?tab=workspace' }
              : { label: t('pages.myDay.blocks.team'), href: '/my-day?tab=team' },
        ]}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <Icon className="size-6 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 truncate">
              <bdi>{title}</bdi>
            </span>
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t(`pages.myDay.kinds.${note.kind}`)}</span>
            <VisibilityChip visibility={note.visibility} />
            {/* who wrote it, for a colleague's note; on my own it said "by" my own name */}
            {author && !mine ? <span>{t('pages.myDay.note.by', { name: author })}</span> : null}
            {note.carried_to ? (
              <span>
                {t('pages.myDay.note.carried', { date: formatDate(note.carried_to, locale, { dateStyle: 'medium' }) })}
              </span>
            ) : null}
          </span>
        }
        actions={
          mine ? (
            <>
              {note.kind === 'meeting' && !note.finished_at ? (
                <Button onClick={() => setTurning('finish')} data-finish-meeting>
                  {t('pages.myDay.finish.label')}
                </Button>
              ) : null}
              <TurnIntoMenu
                onPick={setTurning}
                hide={[...(canAchieve ? [] : (['achievement'] as const)), ...(taskLookups ? [] : (['task'] as const))]}
              />
              <Menu>
                <MenuTrigger asChild>
                  <IconButton label={t('common.actions')} icon={<MoreHorizontal />} data-note-menu />
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Trash2 />} onSelect={() => setRemoving(true)} data-note-remove>
                    {t('pages.myDay.note.remove')}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </>
          ) : null
        }
      />
      <RecordHeaderCounts
        comments={commentCount ?? comments?.comments.length ?? null}
        files={files?.length ?? null}
        href={(f) => (f === 'files' ? '#note-files' : '#note-discussion')}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5">
          <Field label={t('pages.myDay.note.title')}>
            {(p) => (
              <Input
                {...p}
                value={d.title}
                readOnly={!mine}
                autoComplete="off"
                onChange={(e) => setD({ ...d, title: e.target.value })}
                data-note-title
              />
            )}
          </Field>
          <Field label={t('pages.myDay.note.body')}>
            {(p) => (
              <Textarea
                {...p}
                rows={note.kind === 'sticky' ? 6 : 4}
                value={d.body}
                readOnly={!mine}
                onChange={(e) => setD({ ...d, body: e.target.value })}
                data-note-body
              />
            )}
          </Field>
          {note.kind !== 'sticky' ? (
            <fieldset className="flex flex-col gap-2" data-note-items>
              <legend className="mb-1 text-sm font-medium">
                {t('pages.myDay.note.items')}
                {count.total ? (
                  <span className="ms-2 font-data text-xs text-muted">
                    {count.done}/{count.total}
                  </span>
                ) : null}
              </legend>
              {d.items.map((x, i) => (
                <div key={i} className="flex items-center gap-2" data-note-item={i}>
                  <Checkbox
                    checked={x.done}
                    disabled={!mine}
                    onCheckedChange={(v) => item(i, { done: v })}
                    label={t('pages.myDay.note.itemLabel', { n: i + 1 })}
                  />
                  <Input
                    value={x.text}
                    readOnly={!mine}
                    autoComplete="off"
                    aria-label={t('pages.myDay.note.itemLabel', { n: i + 1 })}
                    onChange={(e) => item(i, { text: e.target.value })}
                    className="min-w-0 flex-1"
                  />
                  {mine ? (
                    <IconButton
                      label={t('pages.myDay.note.removeItem', { n: i + 1 })}
                      icon={<X />}
                      size="sm"
                      onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}
                    />
                  ) : null}
                </div>
              ))}
              {mine ? (
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus />}
                    onClick={() => setD({ ...d, items: [...d.items, { text: '', done: false }] })}
                    data-note-add-item
                  >
                    {t('pages.myDay.note.addItem')}
                  </Button>
                </div>
              ) : null}
            </fieldset>
          ) : null}
          {mine ? (
            <div className="flex justify-end gap-2">
              <Button disabled={!dirty || busy} onClick={() => setD(fresh())}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={!dirty || dayBad || meetingBad}
                loading={busy}
                onClick={() => void save()}
                data-note-save
              >
                {t('common.save')}
              </Button>
            </div>
          ) : null}
        </section>
        <aside className="flex flex-col gap-4 rounded-lg border border-border bg-raised p-5" data-note-rail>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{t('pages.myDay.note.details')}</h2>
          <Field label={t('pages.myDay.visibility.label')}>
            {(p) => (
              <Select
                {...p}
                value={d.visibility}
                disabled={!mine}
                // A private note mentions nobody (the database refuses it), so switching to private clears mentions.
                onValueChange={(v) =>
                  setD({ ...d, visibility: v as MyNote['visibility'], mentions: v === 'private' ? [] : d.mentions })
                }
                options={NOTE_VISIBILITIES.map((v) => ({ value: v, label: t(`pages.myDay.visibility.${v}`) }))}
              />
            )}
          </Field>
          {d.visibility === 'person' ? (
            <Field label={t('pages.myDay.visibility.sharedWith')}>
              {(p) => (
                <div className="flex flex-col gap-2" data-shared-with>
                  {d.shared_with.length ? (
                    <ul className="flex flex-col gap-1">
                      {d.shared_with.map((id) => (
                        <li key={id} className="flex items-center justify-between gap-2" data-shared-person={id}>
                          <span className="min-w-0 break-words">{nameOf(id)}</span>
                          {mine ? (
                            <IconButton
                              size="sm"
                              label={t('pages.myDay.visibility.shareRemove', { name: nameOf(id) })}
                              icon={<X />}
                              onClick={() => setD({ ...d, shared_with: d.shared_with.filter((x) => x !== id) })}
                              data-shared-remove={id}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {mine && addable.length ? (
                    <PeoplePicker
                      id={p.id}
                      options={addable}
                      onPick={(v) => setD({ ...d, shared_with: [...d.shared_with, v] })}
                    />
                  ) : null}
                </div>
              )}
            </Field>
          ) : null}
          {d.visibility !== 'private' ? (
            <Field label={t('pages.myDay.note.mentions')}>
              {(p) => (
                <div className="flex flex-col gap-2" data-note-mentions>
                  {d.mentions.length ? (
                    <ul className="flex flex-col gap-1">
                      {d.mentions.map((id) => (
                        <li key={id} className="flex items-center justify-between gap-2" data-mentioned-person={id}>
                          <span className="min-w-0 break-words">{nameOf(id)}</span>
                          {mine ? (
                            <IconButton
                              size="sm"
                              label={t('pages.myDay.visibility.shareRemove', { name: nameOf(id) })}
                              icon={<X />}
                              onClick={() => setD({ ...d, mentions: d.mentions.filter((x) => x !== id) })}
                              data-mention-remove={id}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {mine && mentionable.length ? (
                    <PeoplePicker
                      id={p.id}
                      variant="mention"
                      options={mentionable}
                      onPick={(v) => setD({ ...d, mentions: [...d.mentions, v] })}
                    />
                  ) : null}
                </div>
              )}
            </Field>
          ) : null}
          <Field
            label={t('pages.myDay.note.happenedOn')}
            error={mine && dayBad ? t('pages.myDay.note.pickDay') : undefined}
          >
            {(p) => (
              <DatePicker
                id={p.id}
                describedBy={p['aria-describedby']}
                invalid={p['aria-invalid']}
                value={d.happened_on || undefined}
                max={today()}
                readOnly={!mine}
                onChange={(v) => setD({ ...d, happened_on: v ?? '' })}
                className="font-data"
              />
            )}
          </Field>
          {note.kind === 'meeting' ? (
            <>
              <Field label={t('pages.myDay.note.organisation')}>
                {(p) =>
                  mine ? (
                    <PartnerPicker
                      id={p.id}
                      value={d.meeting_partner}
                      onChange={(meeting_partner) => setD({ ...d, meeting_partner })}
                    />
                  ) : (
                    // a reader sees the organisation's name in the page's language, as on the note's row
                    <span id={p.id}>{d.meeting_partner ? tradeName(d.meeting_partner, locale) : '—'}</span>
                  )
                }
              </Field>
              <Field
                label={t('pages.myDay.note.meetingOn')}
                error={mine && meetingBad ? t('pages.myDay.note.pickDay') : undefined}
              >
                {(p) => (
                  <DatePicker
                    id={p.id}
                    describedBy={p['aria-describedby']}
                    invalid={p['aria-invalid']}
                    value={d.meeting_on || undefined}
                    readOnly={!mine}
                    onChange={(v) => setD({ ...d, meeting_on: v ?? '' })}
                    className="font-data"
                  />
                )}
              </Field>
            </>
          ) : null}
          {note.links.length ? (
            <div className="flex flex-col gap-2" data-note-links>
              <h3 className="text-sm font-medium">{t('pages.myDay.note.turnedInto')}</h3>
              <span className="flex flex-wrap gap-1.5">
                {note.links.map((l) => (
                  <LinkChip key={`${l.entity}-${l.id}`} link={l} />
                ))}
              </span>
            </div>
          ) : null}
        </aside>
      </div>
      <section className="flex flex-col gap-4" id="note-discussion" data-note-discussion>
        <h2 className="text-lg font-semibold">{t('record.discussion')}</h2>
        {comments ? (
          <Comments
            entity="my_note"
            id={note.id}
            data={comments}
            locale={locale}
            personName={meName}
            people={colleagues.filter(canSee).map((c) => ({ id: c.id, name: c.name }))}
            label={t('record.discussion')}
            onCount={setCommentCount}
            files={files}
            onFilesRetry={() => router.refresh()}
          />
        ) : (
          <DataState
            kind="failed"
            message={t('state.failed', { what: t('record.discussion') })}
            onRetry={() => router.refresh()}
            retryLabel={t('common.tryAgain')}
          />
        )}
        <div id="note-files">
          <FilesSection
            entity="my_note"
            recordId={note.id}
            kinds={[{ kind: 'evidence', purpose: 'evidence', label: t('record.files.kinds.evidence') }]}
            files={files}
            mayWrite={note.mine}
            onDone={() => router.refresh()}
            title={t('record.files.title')}
          />
        </div>
      </section>
      <section className="flex flex-col gap-4" data-note-history>
        <h2 className="text-lg font-semibold">{t('record.history')}</h2>
        {history ? (
          history.length ? (
            <ActivityTimeline rows={history} people={people} onChanged={() => router.refresh()} />
          ) : (
            <DataState kind="empty" message={t('record.noActivity')} />
          )
        ) : (
          <DataState
            kind="failed"
            message={t('state.failed', { what: t('record.history') })}
            onRetry={() => router.refresh()}
            retryLabel={t('common.tryAgain')}
          />
        )}
      </section>
      {mine ? (
        <>
          <LogFromNoteDialog
            note={note}
            open={turning === 'activity'}
            onOpenChange={(o) => setTurning(o ? 'activity' : null)}
            types={types}
            outcomes={outcomes}
          />
          <LogFromNoteDialog
            note={note}
            finish
            open={turning === 'finish'}
            onOpenChange={(o) => setTurning(o ? 'finish' : null)}
            types={types}
            outcomes={outcomes}
          />
          <ReminderDialog
            note={note}
            open={turning === 'reminder'}
            onOpenChange={(o) => setTurning(o ? 'reminder' : null)}
          />
          {taskLookups ? (
            <QuickAdd
              open={turning === 'task'}
              onOpenChange={(o) => setTurning(o ? 'task' : null)}
              org={taskLookups.org}
              partners={taskLookups.partners}
              projects={taskLookups.projects}
              priorities={taskLookups.priorities}
              initial={{
                title: noteTitle(note).slice(0, TITLE_MAX),
                partnerId: taskLookups.partners.some((p) => p.id === note.meeting_partner?.id)
                  ? note.meeting_partner?.id
                  : undefined,
              }}
              fromNote={{ id: note.id, hasItems: note.items.some((i) => i.text.trim() !== '') }}
            />
          ) : null}
          <ChecklistItemDialog
            note={note}
            open={turning === 'action_item'}
            onOpenChange={(o) => setTurning(o ? 'action_item' : null)}
          />
          <AchievementFromNoteDialog
            note={note}
            open={turning === 'achievement'}
            onOpenChange={(o) => setTurning(o ? 'achievement' : null)}
            people={colleagues}
          />
          <ReasonDialog
            open={removing}
            onOpenChange={(o) => {
              if (o) setDeleteReminder(false);
              setRemoving(o);
            }}
            title={t('pages.myDay.note.removeTitle', { name: title })}
            body={t('pages.myDay.note.removeBody')}
            destructive
            onSave={(reason) => remove(reason)}
            words={{
              reason: t('common.reason'),
              save: t('common.remove'),
              cancel: t('common.cancel'),
              reasonRequired: t('settings.form.reasonRequired'),
            }}
          >
            {note.has_pending_reminder ? (
              <Checkbox
                checked={deleteReminder}
                onCheckedChange={setDeleteReminder}
                label={t('pages.myDay.note.deleteReminderToo')}
              />
            ) : undefined}
          </ReasonDialog>
        </>
      ) : null}
    </div>
  );
}
