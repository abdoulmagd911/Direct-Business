'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Textarea } from '@/ui/Input';
import type { TaskDetail } from '../types';
import { useCommandWords } from './words';

/**
 * Need help (Phase 5 — Escalate renamed in place): tell the task owner's direct manager about this task, with a
 * note. The manager is told at once, follows the task from then on, and the task is flagged until they acknowledge
 * it. It does not change ownership, status, or priority. Whoever may change the task flags it; the door checks the
 * manager can see it, and resolves the manager itself when none is named.
 */
export function Escalate({
  open,
  onOpenChange,
  task,
  org,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: Pick<TaskDetail, 'id' | 'number' | 'owner_id'>;
  org: OrgAnswer | null;
}) {
  const t = useTranslations();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.tasks.escalate.title', { number: task.number })}
      description={t('pages.tasks.escalate.what')}
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
  task: Pick<TaskDetail, 'id' | 'number' | 'owner_id'>;
  org: OrgAnswer | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const words = useCommandWords();
  const locale = useLocale() as 'en' | 'ar';
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  // the owner's direct manager is the one told — no picker; the dialog shows who that is
  const owner = org?.people.find((p) => p.id === task.owner_id);
  const manager = owner?.manager_id ? org?.people.find((p) => p.id === owner.manager_id) : undefined;
  const managerName = manager ? nameOf(manager, locale) : null;

  const send = async () => {
    const trimmed = note.trim();
    if (!trimmed) return setNoteError(t('pages.tasks.escalate.note_required'));
    if (!manager) return;
    setBusy(true);
    await command(
      words(t('pages.tasks.escalate.done', { name: managerName ?? '' })),
      () =>
        rpc('escalate', { p_entity: 'task', p_id: task.id, p_to: manager.id, p_note: trimmed }) as Promise<{
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
        void send();
      }}
      data-escalate
    >
      <p className="text-base">
        {managerName ? t('pages.tasks.escalate.notify', { name: managerName }) : t('pages.tasks.escalate.noManager')}
      </p>
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
        <Button variant="primary" type="submit" loading={busy} disabled={!manager}>
          {t('pages.tasks.escalate.send')}
        </Button>
      </div>
    </form>
  );
}
