'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { nameOf, type ListEntry } from '../../types';
import { today, useWords } from './words';

/**
 * Log activity (V150, V401, V406): call · meeting · demo · visit · note, the outcome from that type's own list (required
 * where the type has one), the day it happened (V400: today by default, any past day), the line, and an optional next
 * step with its day — "demo set" needs the demo's day. One request; the next step becomes a task in P5-1.
 */
export function LogActivityDialog({
  open,
  onOpenChange,
  partnerId,
  types,
  outcomes,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partnerId: string;
  types: ListEntry[];
  outcomes: ListEntry[];
  onDone: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const [f, setF] = useState({ type: '', outcome: '', on: today(), body: '', next: '', nextOn: '' });
  const [busy, setBusy] = useState(false);
  const type = types.find((x) => x.key === f.type);
  const own = outcomes.filter((o) => o.activity_type_id === type?.id);
  const outcome = own.find((o) => o.key === f.outcome);
  const demoSet = outcome?.meaning === 'demo_set';
  const ok =
    !!f.type && (own.length === 0 || !!f.outcome) && !!f.on && (!f.next || !!f.nextOn) && (!demoSet || !!f.nextOn);
  const save = async () => {
    setBusy(true);
    await command(
      words(t('partners.activity.logged', { type: nameOf(type, locale) })),
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
          onOpenChange(false);
          setF({ type: '', outcome: '', on: today(), body: '', next: '', nextOn: '' });
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
      title={t('partners.activity.log')}
      closeLabel={t('common.close')}
      dirty={!!f.type || !!f.body}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void save()} data-activity-save>
            {t('common.save')}
          </Button>
        </>
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
        <Field label={t('partners.activity.outcome')}>
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
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!f.body.trim()} loading={busy} onClick={() => void save()} data-note-save>
            {t('common.save')}
          </Button>
        </>
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
