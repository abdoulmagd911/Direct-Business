'use client';
import { MoreHorizontal, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { formatDate } from '@/core/i18n/format';
import type { ListEntry } from '@/modules/partners/types';
import { today, useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { Confirm } from '@/ui/Confirm';
import { Field } from '@/ui/Field';
import { IconButton } from '@/ui/IconButton';
import { Input, Textarea } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { rpc } from '@/core/db/rpc';
import { checklistCount, noteTitle } from '../logic';
import { VISIBILITIES, type MyNote, type NoteItem, type PartnerRef, type TurnKind } from '../types';
import { KIND_ICON, LinkChip, VisibilityChip } from './NoteBits';
import { PartnerPicker } from './PartnerPicker';
import { LogFromNoteDialog, ReminderDialog, TurnIntoMenu } from './TurnDialogs';
import { useMe } from '@/core/auth/me-context';
import { AchievementFromNoteDialog } from '@/modules/perf/screens/AchievementFromNote';
import type { OrgAnswer } from '@/modules/org/types';
import { TITLE_MAX } from '@/modules/tasks/rules';
import { QuickAdd } from '@/modules/tasks/screens/QuickAdd';
import type { NamePick } from '@/modules/tasks/types';

type Draft = {
  title: string;
  body: string;
  items: NoteItem[];
  visibility: MyNote['visibility'];
  happened_on: string;
  meeting_partner: PartnerRef | null;
  meeting_on: string;
};

const draftOf = (n: MyNote, partner: PartnerRef | null): Draft => ({
  title: n.title ?? '',
  body: n.body ?? '',
  items: n.items,
  visibility: n.visibility,
  happened_on: n.happened_on,
  meeting_partner: partner,
  meeting_on: n.meeting_on ?? '',
});

/**
 * A note's own page (V433; the canvas's "My day / My notes / …"): the title, the words, a checklist's rows or a
 * meeting's points, and beside them who sees it, the organisation and the day; Turn into, Finish meeting for a meeting,
 * and what the note became — each chip opens it. Only its author edits it; a colleague reading a shared note reads.
 */
export function NotePage({
  note,
  author,
  types,
  outcomes,
  taskLookups,
}: {
  note: MyNote;
  author?: string;
  /** The names a task from this note points at; absent for someone who may not make tasks (no Task in Turn into). */
  taskLookups?: { org: OrgAnswer | null; partners: NamePick[]; projects: NamePick[] };
  types: ListEntry[];
  outcomes: ListEntry[];
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
  const dirty = JSON.stringify(d) !== JSON.stringify(fresh());
  const title = noteTitle(note) || t('pages.myDay.note.untitled');
  const Icon = KIND_ICON[note.kind];
  const count = checklistCount({ items: d.items });
  const mine = note.mine;

  const save = async () => {
    setBusy(true);
    await command(
      words(t('pages.myDay.note.saved')),
      () =>
        rpc('note_update', {
          p_id: note.id,
          p_version: note.version,
          p_values: {
            title: d.title.trim() || null,
            body: d.body.trim() || null,
            items: d.items.filter((i) => i.text.trim()).map((i) => ({ ...i, text: i.text.trim() })),
            visibility: d.visibility,
            happened_on: d.happened_on,
            meeting_partner_id: d.meeting_partner?.id ?? null,
            meeting_on: d.meeting_on || null,
          },
        }) as Promise<{ request_id?: string | null }>,
    );
    setBusy(false);
  };
  const remove = async () => {
    setBusy(true);
    await command(
      words(t('pages.myDay.note.removed')),
      () => rpc('my_notes_remove', { p_ids: [note.id] }) as Promise<{ request_id?: string | null }>,
      {
        after: () => router.push('/my-day'),
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
        crumbs={[{ label: t('nav.my_day'), href: '/my-day' }, { label: t('pages.myDay.blocks.me') }]}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <Icon className="size-6 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 truncate">{title}</span>
          </span>
        }
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t(`pages.myDay.kinds.${note.kind}`)}</span>
            <VisibilityChip visibility={note.visibility} />
            {author ? <span>{t('pages.myDay.note.by', { name: author })}</span> : null}
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
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
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
              <Button variant="primary" disabled={!dirty} loading={busy} onClick={() => void save()} data-note-save>
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
                onValueChange={(v) => setD({ ...d, visibility: v as MyNote['visibility'] })}
                options={VISIBILITIES.map((v) => ({ value: v, label: t(`pages.myDay.visibility.${v}`) }))}
              />
            )}
          </Field>
          <Field label={t('pages.myDay.note.happenedOn')}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={d.happened_on}
                max={today()}
                readOnly={!mine}
                onChange={(e) => setD({ ...d, happened_on: e.target.value })}
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
                    <span id={p.id}>{d.meeting_partner?.trade_name_en ?? '—'}</span>
                  )
                }
              </Field>
              <Field label={t('pages.myDay.note.meetingOn')}>
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    value={d.meeting_on}
                    readOnly={!mine}
                    onChange={(e) => setD({ ...d, meeting_on: e.target.value })}
                    className="font-data"
                  />
                )}
              </Field>
            </>
          ) : null}
          <div className="flex flex-col gap-2" data-note-links>
            <h3 className="text-sm font-medium">{t('pages.myDay.note.turnedInto')}</h3>
            {note.links.length ? (
              <span className="flex flex-wrap gap-1.5">
                {note.links.map((l) => (
                  <LinkChip key={`${l.entity}-${l.id}`} link={l} />
                ))}
              </span>
            ) : (
              <span className="text-sm text-muted">—</span>
            )}
          </div>
        </aside>
      </div>
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
              initial={{
                title: noteTitle(note).slice(0, TITLE_MAX),
                partnerId: taskLookups.partners.some((p) => p.id === note.meeting_partner?.id)
                  ? note.meeting_partner?.id
                  : undefined,
              }}
              fromNote={{ id: note.id, hasItems: note.items.some((i) => i.text.trim() !== '') }}
            />
          ) : null}
          <AchievementFromNoteDialog
            note={note}
            open={turning === 'achievement'}
            onOpenChange={(o) => setTurning(o ? 'achievement' : null)}
          />
          <Confirm
            open={removing}
            onOpenChange={setRemoving}
            title={t('pages.myDay.note.removeTitle', { name: title })}
            body={t('pages.myDay.note.removeBody')}
            cancelLabel={t('common.cancel')}
            confirmLabel={t('common.remove')}
            onConfirm={() => void remove()}
            busy={busy}
          />
        </>
      ) : null}
    </div>
  );
}
