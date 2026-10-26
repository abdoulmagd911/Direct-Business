'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useLayoutEffect, useRef, useState } from 'react';
import { command } from '@/core/commands/command';
import { useMe } from '@/core/auth/me-context';
import { rpc } from '@/core/db/rpc';
import { lastActivityTypeKey, readLastActivityType, writeLastActivityType } from '@/core/prefs/last-activity-type';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { nameOf, type ListEntry } from '../../types';
import { today, useWords } from './words';

/**
 * The dialog's title line: the name wraps over at most three lines with a "More" tap (V653, ruling of 23 Oct — a dialog
 * title is not a picker row), and "Change" stays at the end of the line, on a phone as on a PC.
 */
function TitleLine({ text, onChange }: { text: string; onChange?: () => void }) {
  const t = useTranslations();
  const box = useRef<HTMLSpanElement>(null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && !open) setMore(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <span className="flex items-baseline gap-3">
      <span className="min-w-0 flex-1">
        <span ref={box} className={open ? 'break-words' : 'line-clamp-3 break-words'} data-activity-title>
          {text}
        </span>
        {more || open ? (
          <span className="flex justify-start">
            <Button
              variant="link"
              className="justify-start px-0 text-sm font-normal"
              onClick={() => setOpen(!open)}
              data-activity-title-more
            >
              {open ? t('partners.activity.titleLess') : t('partners.activity.titleMore')}
            </Button>
          </span>
        ) : null}
      </span>
      {onChange ? (
        <Button variant="link" className="shrink-0 text-sm font-normal" onClick={onChange} data-activity-change>
          {t('partners.activity.change')}
        </Button>
      ) : null}
    </span>
  );
}

/**
 * Log activity (V150, V401, V406): call · meeting · demo · visit · note, the outcome from that type's own list (required
 * where the type has one), the day it happened (V400: today by default, any past day), the line, and an optional next
 * step with its day — "demo set" needs the demo's day. One request; the next step becomes a task in P5-1.
 * The type opens on the one this person used last, Call the first time (22 Oct), so Save never waits on an empty type.
 * From the + the title names the organisation and "Change" goes back to the question (partnerName, onChangeWho).
 */
export function LogActivityDialog({
  open,
  onOpenChange,
  partnerId,
  types,
  outcomes,
  onDone,
  partnerName,
  onChangeWho,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  types: ListEntry[];
  outcomes: ListEntry[];
  onDone: () => void;
  /** The organisation by name: the title and the toast say where the activity lands. */
  partnerName?: string;
  /** Shows "Change" under the title; it takes the person back to "Who was it with?". */
  onChangeWho?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const storeKey = lastActivityTypeKey(useMe().person.id);
  const fresh = () => {
    const last = readLastActivityType(storeKey);
    const type = [last, 'call'].find((k) => k && types.some((x) => x.key === k)) ?? types[0]?.key ?? '';
    return { type, outcome: '', on: today(), body: '', next: '', nextOn: '' };
  };
  const [f, setF] = useState(fresh);
  const [busy, setBusy] = useState(false);
  const type = types.find((x) => x.key === f.type);
  const own = outcomes.filter((o) => o.activity_type_id === type?.id);
  const outcome = own.find((o) => o.key === f.outcome);
  const demoSet = outcome?.meaning === 'demo_set';
  const ok =
    !!f.type &&
    (own.length === 0 || !!f.outcome) &&
    !!f.on &&
    !!f.body.trim() &&
    (!f.next || !!f.nextOn) &&
    (!demoSet || !!f.nextOn);
  // What is still missing, in the words of the boxes themselves — one line under the form while Save is off
  const missing = [
    !f.type && t('partners.activity.need.type'),
    !!f.type && own.length > 0 && !f.outcome && t('partners.activity.need.outcome'),
    !f.on && t('partners.activity.need.on'),
    ((!!f.next && !f.nextOn) || (demoSet && !f.nextOn)) && t('partners.activity.need.nextOn'),
  ].filter((x): x is string => !!x);
  // Save says in one line what is still missing: the boxes to choose, then the line to write (22–23 Oct)
  const why = [
    missing.length
      ? t('partners.activity.need.line', {
          list: new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(missing),
        })
      : '',
    f.body.trim() ? '' : t('partners.activity.need.body'),
  ]
    .filter(Boolean)
    .join(' · ');
  const save = async () => {
    setBusy(true);
    await command(
      words(
        partnerName
          ? t('partners.activity.loggedFor', { type: nameOf(type, locale), name: partnerName })
          : t('partners.activity.logged', { type: nameOf(type, locale) }),
      ),
      () =>
        rpc('activity_log', {
          p_partner: partnerId,
          p_type: f.type,
          p_outcome: f.outcome || undefined,
          p_happened_on: f.on,
          p_body: f.body.trim() || undefined,
          p_next_step: f.next.trim() || undefined,
          p_next_step_on: f.nextOn || undefined,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          writeLastActivityType(storeKey, f.type);
          onOpenChange(false);
          setF({ ...fresh(), type: f.type });
          onDone();
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <TitleLine
          text={partnerName ? t('partners.activity.logFor', { name: partnerName }) : t('partners.activity.log')}
          onChange={onChangeWho}
        />
      }
      closeLabel={t('common.close')}
      dirty={!!f.body || !!f.outcome || !!f.next || !!f.nextOn}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {!ok && why ? (
            <p className="w-full text-sm text-muted sm:w-auto sm:flex-1" role="status" data-activity-why>
              {why}
            </p>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-activity-save>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2" data-activity-form>
        <Field label={t('partners.activity.type')}>
          {(p) => (
            <Select
              {...p}
              value={f.type}
              onValueChange={(v) => setF({ ...f, type: v, outcome: '' })}
              options={types.map((x) => ({ value: x.key, label: nameOf(x, locale) }))}
            />
          )}
        </Field>
        <Field label={own.length ? t('partners.activity.outcome') : t('partners.activity.outcomeOptional')}>
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
        <Field label={t('partners.activity.happenedOn')}>
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
        <Field label={t('partners.activity.line')} className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}
        </Field>
        <Field label={demoSet ? t('partners.activity.demoDay') : t('partners.activity.nextStepOn')}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={f.nextOn}
              min={f.on}
              onChange={(e) => setF({ ...f, nextOn: e.target.value })}
              className="font-data"
            />
          )}
        </Field>
        <Field label={t('partners.activity.nextStep')}>
          {(p) => <Input {...p} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />}
        </Field>
      </div>
    </Dialog>
  );
}

/** A note on the record (V150): comments, updates and meeting notes, dated the day they happened. */
export function AddNoteDialog({
  open,
  onOpenChange,
  partnerId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  onDone: () => void;
}) {
  const t = useTranslations();
  const words = useWords();
  const [f, setF] = useState({ kind: 'comment', body: '', on: today() });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await command(
      words(t('partners.note.added')),
      () =>
        rpc('note_add', {
          p_entity: 'partner',
          p_id: partnerId,
          p_kind: f.kind,
          p_body: f.body.trim(),
          p_happened_on: f.on,
        }) as Promise<{ request_id?: string | null } | null>,
      {
        after: () => {
          onOpenChange(false);
          setF({ kind: 'comment', body: '', on: today() });
          onDone();
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('partners.note.add')}
      size="sm"
      closeLabel={t('common.close')}
      dirty={!!f.body}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {!f.body.trim() ? (
            <p className="w-full text-sm text-muted sm:w-auto sm:flex-1" role="status" data-note-why>
              {t('partners.note.need')}
            </p>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!f.body.trim()} loading={busy} onClick={() => void save()} data-note-save>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('partners.note.kind')}>
          {(p) => (
            <Select
              {...p}
              value={f.kind}
              onValueChange={(v) => setF({ ...f, kind: v })}
              options={(['comment', 'update', 'meeting_note'] as const).map((k) => ({
                value: k,
                label: t(`partners.note.kinds.${k}`),
              }))}
            />
          )}
        </Field>
        <Field label={t('partners.activity.happenedOn')}>
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
        <Field label={t('partners.note.body')}>
          {(p) => (
            <Textarea {...p} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} autoFocus />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
