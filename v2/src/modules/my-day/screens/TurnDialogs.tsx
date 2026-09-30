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
import { Input, Textarea } from '@/ui/Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/ui/Menu';
import { Select } from '@/ui/Select';
import { door } from '../doors';
import { noteText, noteTitle, turnLive } from '../logic';
import { TURN_KINDS, type MyNote, type PartnerRef, type TurnKind } from '../types';
import { PartnerPicker } from './PartnerPicker';

/** A logged meeting or call is a call or a meeting (V433); the other activity types are logged on the record itself. */
const CALL_OR_MEETING = ['call', 'meeting'];

/**
 * Turn into (V433): every kind in its place, the ones whose door has not landed greyed with "not yet" — a task and an
 * action item with Tasks (P5-2), an achievement with the KPIs page (P5-6).
 */
export function TurnIntoMenu({ onPick }: { onPick: (k: TurnKind) => void }) {
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
        {TURN_KINDS.map((k) => {
          const live = turnLive(k, BUILT);
          return (
            <MenuItem key={k} disabled={!live} onSelect={() => onPick(k)} data-turn-kind={k} data-turn-live={live}>
              <span className="flex-1">{t(`pages.myDay.turn.kinds.${k}`)}</span>
              {live ? null : <span className="text-xs text-muted">{t('pages.myDay.turn.notYet')}</span>}
            </MenuItem>
          );
        })}
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
    partner: note.meeting_partner as PartnerRef | null,
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
  const ok = !!f.partner && !!f.type && (own.length === 0 || !!f.outcome) && !!f.on;
  const save = async () => {
    if (!f.partner) return;
    setBusy(true);
    const name = tradeName(f.partner, locale);
    const values = {
      partner: f.partner.id,
      type: f.type,
      outcome: f.outcome || null,
      happened_on: f.on,
      body: f.body.trim() || null,
    };
    await command(
      words(
        finish
          ? t('pages.myDay.finish.done', { name })
          : t('pages.myDay.turn.logged', { type: nameOf(type, locale), name }),
      ),
      () =>
        finish
          ? door('note_finish_meeting', { p_note: note.id, p_values: values })
          : door('note_turn_into', { p_note: note.id, p_kind: 'activity', p_values: values }),
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
        {finish ? (
          <p className="text-sm text-muted sm:col-span-2" data-finish-tasks>
            {t('pages.myDay.finish.tasks')} · {t('pages.myDay.finish.tasksNotYet')}
          </p>
        ) : null}
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
  return `${d.toISOString().slice(0, 10)}T09:00`;
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
  const fresh = () => ({ at: tomorrowAtNine(), text: noteTitle(note) });
  const [f, setF] = useState(fresh);
  const [busy, setBusy] = useState(false);
  const ok = !!f.at && !!f.text.trim();
  const save = async () => {
    setBusy(true);
    // the time is Riyadh's (UTC+3, no daylight saving): the stored instant is the same wherever the browser is
    const at = `${f.at}:00+03:00`;
    await command(
      words(
        t('pages.myDay.turn.reminded', { when: formatDate(at, locale, { dateStyle: 'medium', timeStyle: 'short' }) }),
      ),
      () =>
        door('note_turn_into', {
          p_note: note.id,
          p_kind: 'reminder',
          p_values: { remind_at: at, text: f.text.trim() },
        }),
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
      title={t('pages.myDay.turn.reminderTitle')}
      size="sm"
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-reminder-save>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-reminder-form>
        <Field label={t('pages.myDay.turn.when')}>
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              value={f.at}
              onChange={(e) => setF({ ...f, at: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={t('pages.myDay.turn.text')}>
          {(p) => <Input {...p} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />}
        </Field>
      </div>
    </Dialog>
  );
}
