'use client';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { formatDate } from '@/core/i18n/format';
import { nameOf, tradeName, type ListEntry } from '@/modules/partners/types';
import { today, useWords } from '@/modules/partners/screens/record/words';
import { BUILT } from '@/ui/shell/CreateMenu';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea, TimeInput } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { Select } from '@/ui/Select';
import { rpc } from '@/core/db/rpc';
import { liveKinds, noteText, noteTitle, TURN_READY } from '../logic';
import type { MyNote, TurnKind } from '../types';
import { PartnerPicker } from './PartnerPicker';
import { TaskPicker, type TaskRef } from './TaskPicker';

/** A logged meeting or call is a call or a meeting (V433); the other activity types are logged on the record itself. */
const CALL_OR_MEETING = ['call', 'meeting'];

/**
 * Turn into (V433): a logged meeting or call and a reminder now. A task, an action item and an achievement join when their
 * own flag is set (TURN_READY — the achievement's is, V381); a kind still waiting is left out, never greyed (GC-1, cut 3).
 */
export function TurnIntoMenu({ onPick, hide = [] }: { onPick: (k: TurnKind) => void; hide?: TurnKind[] }) {
  const t = useTranslations();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="primary" data-turn-into>
          {t('pages.myDay.turn.label')}
          <ChevronDown aria-hidden="true" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {liveKinds(new Set([...BUILT, ...TURN_READY]))
          .filter((k) => !hide.includes(k))
          .map((k) => (
            <MenuItem key={k} onSelect={() => onPick(k)} data-turn-kind={k}>
              {t(`pages.myDay.turn.kinds.${k}`)}
            </MenuItem>
          ))}
      </MenuContent>
    </Menu>
  );
}

/**
 * Log a meeting or call from a note (V433, one request: the activity through api.activity_log and the two-way link).
 * Finish meeting is the same form for a meeting note: the type is Meeting and the note's points go with it; its action
 * items become tasks once Tasks lands (P5-2), said, never faked.
 */
export function LogFromNoteDialog({
  note,
  open,
  onOpenChange,
  types,
  outcomes,
  finish = false,
}: {
  note: MyNote;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  types: ListEntry[];
  outcomes: ListEntry[];
  finish?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const fresh = () => ({
    partner: note.meeting_partner,
    type: finish || note.kind === 'meeting' ? 'meeting' : 'call',
    outcome: '',
    on: note.meeting_on ?? note.happened_on,
    body: noteText(note),
  });
  const [f, setF] = useState(fresh);
  const [busy, setBusy] = useState(false);
  const choices = types.filter((x) => CALL_OR_MEETING.includes(x.key));
  const type = types.find((x) => x.key === f.type);
  const own = outcomes.filter((o) => o.activity_type_id === type?.id);
  // Finish meeting holds the meeting unless another outcome is chosen (api.note_finish_meeting)
  const ok = !!f.partner && !!f.type && (finish || own.length === 0 || !!f.outcome) && !!f.on;
  const save = async () => {
    if (!f.partner) return;
    setBusy(true);
    const name = tradeName(f.partner, locale);
    const values = {
      partner_id: f.partner.id,
      ...(finish ? {} : { type: f.type }),
      ...(f.outcome ? { outcome: f.outcome } : {}),
      happened_on: f.on,
      ...(f.body.trim() ? { body: f.body.trim() } : {}),
    };
    await command(
      words(
        finish
          ? t('pages.myDay.finish.done', { name })
          : t('pages.myDay.turn.logged', { type: nameOf(type, locale), name }),
      ),
      () =>
        (finish
          ? rpc('note_finish_meeting', { p_note: note.id, p_values: values })
          : rpc('note_turn_into', { p_note: note.id, p_kind: 'activity', p_values: values })) as Promise<{
          request_id?: string | null;
        }>,
      {
        after: () => {
          onOpenChange(false);
          setF(fresh());
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={finish ? t('pages.myDay.finish.title') : t('pages.myDay.turn.activityTitle')}
      description={noteTitle(note) || undefined}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-log-from-note-save>
            {finish ? t('pages.myDay.finish.save') : t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-log-from-note={finish ? 'finish' : 'activity'}>
        <Field label={t('pages.myDay.turn.organisation')} className="sm:col-span-2">
          {(p) => <PartnerPicker id={p.id} value={f.partner} onChange={(partner) => setF({ ...f, partner })} />}
        </Field>
        <Field label={t('pages.myDay.turn.type')}>
          {(p) => (
            <Select
              {...p}
              value={f.type}
              disabled={finish}
              onValueChange={(v) => setF({ ...f, type: v, outcome: '' })}
              options={choices.map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        <Field label={t('pages.myDay.turn.outcome')}>
          {(p) => (
            <Select
              {...p}
              value={f.outcome}
              onValueChange={(v) => setF({ ...f, outcome: v })}
              disabled={!own.length}
              placeholder={own.length ? undefined : t('common.none')}
              options={own.map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        <Field label={t('pages.myDay.note.happenedOn')}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={f.on}
              max={today()}
              onChange={(e) => setF({ ...f, on: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={t('pages.myDay.turn.line')} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}
        </Field>
      </div>
    </Dialog>
  );
}

const tomorrowAtNine = () => {
  const d = new Date(`${today()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return { day: d.toISOString().slice(0, 10), time: '09:00' };
};

/** A reminder from a note (V455: the five-minute job sends it once at its time, Riyadh's clock). */
export function ReminderDialog({
  note,
  open,
  onOpenChange,
}: {
  note: MyNote;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const fresh = () => ({ ...tomorrowAtNine(), text: noteTitle(note) });
  const [f, setF] = useState(fresh);
  const [busy, setBusy] = useState(false);
  // the time box holds what was typed; f.time keeps the last readable time, so whether the box reads as a time is held here
  const [timeOk, setTimeOk] = useState(true);
  const ok = !!f.day && timeOk && !!f.text.trim();
  const missing = !f.day ? 'day' : !timeOk ? 'time' : !f.text.trim() ? 'text' : null;
  const save = async () => {
    setBusy(true);
    // the time is Riyadh's (UTC+3, no daylight saving): the stored instant is the same wherever the browser is
    const at = `${f.day}T${f.time}:00+03:00`;
    await command(
      words(
        t('pages.myDay.turn.reminded', { when: formatDate(at, locale, { dateStyle: 'medium', timeStyle: 'short' }) }),
      ),
      () =>
        rpc('note_turn_into', {
          p_note: note.id,
          p_kind: 'reminder',
          p_values: { remind_at: at, text: f.text.trim() },
        }) as Promise<{ request_id?: string | null }>,
      {
        after: () => {
          onOpenChange(false);
          setF(fresh());
          setTimeOk(true);
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.myDay.turn.reminderTitle')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {/* V654 (6): a greyed Save says in one line what is missing, beside it and in view on a phone */}
          {missing ? (
            <p className="w-full text-sm text-muted sm:w-auto sm:flex-1" role="status" data-reminder-why>
              {t(`pages.myDay.turn.reminderMissing.${missing}`)}
            </p>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-reminder-save>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-reminder-form>
        <div className="flex flex-wrap gap-3" data-reminder-when>
          <Field label={t('pages.myDay.quick.day')} className="min-w-0 flex-1">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={f.day}
                onChange={(e) => e.target.value && setF({ ...f, day: e.target.value })}
                data-reminder-day
              />
            )}
          </Field>
          <Field label={t('pages.myDay.quick.time')} className="min-w-0 flex-1">
            {(p) => (
              <TimeInput
                {...p}
                value={f.time}
                onChange={(time) => setF({ ...f, time })}
                onReadable={setTimeOk}
                data-reminder-time
              />
            )}
          </Field>
        </div>
        <Field label={t('pages.myDay.turn.text')}>
          {(p) => <Input {...p} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />}
        </Field>
      </div>
    </Dialog>
  );
}

/**
 * An item on a task's checklist from a note (V647, V433): the person searches the task by title or number, the item's text
 * is the note's first words, and the item and the note stay linked both ways (api.note_turn_into 'action_item'). A task
 * the person cannot change is refused by the database in words; nothing is added.
 */
export function ChecklistItemDialog({
  note,
  open,
  onOpenChange,
}: {
  note: MyNote;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const words = useWords();
  const [task, setTask] = useState<TaskRef | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!task) return;
    setBusy(true);
    await command(
      words(t('pages.myDay.turn.itemAdded', { number: task.number })),
      () =>
        rpc('note_turn_into', { p_note: note.id, p_kind: 'action_item', p_values: { task_id: task.id } }) as Promise<{
          request_id?: string | null;
        }>,
      {
        after: () => {
          onOpenChange(false);
          setTask(null);
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTask(null);
        onOpenChange(o);
      }}
      title={t('pages.myDay.turn.itemTitle')}
      description={noteTitle(note) || undefined}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!task}
            loading={busy}
            onClick={() => void save()}
            data-checklist-item-save
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-checklist-item-form>
        <Field label={t('pages.myDay.turn.task')}>
          {(p) => <TaskPicker id={p.id} value={task} onChange={setTask} />}
        </Field>
      </div>
    </Dialog>
  );
}
