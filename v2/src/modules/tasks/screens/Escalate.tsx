'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { escalateTargets, escalateValues } from '../rules';
import type { TaskDetail } from '../types';
import { useCommandWords } from './words';

/**
 * Escalate (V401): tell someone else about this task, with a note. They are told at once, follow the task from then on,
 * and the note is the task's timeline entry. Whoever may change the task escalates it; the door checks the person can
 * see it.
 */
export function Escalate({
  open,
  onOpenChange,
  task,
  org,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Pick<TaskDetail, 'id' | 'number'>;
  org: OrgAnswer | null;
}) {
  const t = useTranslations();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.tasks.escalate.title', { number: task.number })}
      closeLabel={t('common.close')}
      size="sm"
    >
      {open ? <EscalateForm task={task} org={org} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function EscalateForm({
  task,
  org,
  onClose,
}: {
  task: Pick<TaskDetail, 'id' | 'number'>;
  org: OrgAnswer | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const me = useMe();
  const words = useCommandWords();
  const locale = useLocale() as 'en' | 'ar';
  const [to, setTo] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [toError, setToError] = useState<string | undefined>();
  const [noteError, setNoteError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const people = escalateTargets(org?.people ?? [], me.person.id)
    .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const send = async () => {
    const r = escalateValues({ to, note }, me.person.id);
    if ('error' in r) {
      const said = t(`pages.tasks.escalate.${r.error}`);
      if (r.error === 'note_required') setNoteError(said);
      else setToError(said);
      return;
    }
    const name = people.find((p) => p.value === r.values.p_to)?.label ?? '';
    setBusy(true);
    await command(
      words(t('pages.tasks.escalate.done', { name })),
      () =>
        rpc('escalate', { p_entity: 'task', p_id: task.id, ...r.values }) as Promise<{ request_id?: string | null }>,
      { after: onClose },
    );
    setBusy(false);
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      data-escalate
    >
      <Field label={t('pages.tasks.escalate.to')} error={toError}>
        {(p) => (
          <Select
            id={p.id}
            value={to ?? ''}
            placeholder={t('pages.tasks.escalate.to_required')}
            onValueChange={(v) => {
              setToError(undefined);
              setTo(v);
            }}
            options={people}
          />
        )}
      </Field>
      <Field label={t('pages.tasks.escalate.note')} error={noteError}>
        {(p) => (
          <Textarea
            {...p}
            rows={4}
            value={note}
            onChange={(e) => {
              setNoteError(undefined);
              setNote(e.target.value);
            }}
            name="note"
          />
        )}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit" loading={busy}>
          {t('pages.tasks.escalate.send')}
        </Button>
      </div>
    </form>
  );
}
