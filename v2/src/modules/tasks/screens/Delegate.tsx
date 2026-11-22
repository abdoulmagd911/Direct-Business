'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { command } from '@/core/commands/run';
import { rpc } from '@/core/db/rpc';
import { formatNumber } from '@/core/i18n/format';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { delegateTargets, HAND_OVER_REASON_MAX, handOverValues } from '../rules';
import type { TaskDetail } from '../types';
import { useCommandWords } from './words';

/**
 * Hand over (Landing 33, B3 — it was "Delegate", Phase 1 CUJ 5): the Responsible gives their own task to someone
 * else, with a reason. They become the Responsible and are told at once; the reason is kept in the task's hand-over
 * history; the one who handed it over follows the task from then on. Only the Responsible hands a task over (O-3) —
 * the menu offers it to nobody else, and the door refuses.
 *
 * The reason is required every time, 120 characters at most. With no reason the field turns red and says so, the
 * button stays live, and nothing is handed over.
 */
export function Delegate({
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
      title={t('pages.tasks.delegate.title', { number: task.number })}
      description={t('pages.tasks.delegate.what')}
      closeLabel={t('common.close')}
      size="sm"
    >
      {open ? <DelegateForm task={task} org={org} onClose={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function DelegateForm({
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
  const [reason, setReason] = useState('');
  const [toError, setToError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const people = delegateTargets(org?.people ?? [], me.person.id)
    .map((p) => ({ value: p.id, label: nameOf(p, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const send = async () => {
    const r = handOverValues({ to, reason }, me.person.id);
    if ('error' in r) {
      const said = t(`pages.tasks.delegate.${r.error}`, { max: HAND_OVER_REASON_MAX });
      if (r.error === 'reason_required' || r.error === 'reason_too_long') setReasonError(said);
      else setToError(said);
      return;
    }
    const name = people.find((p) => p.value === r.values.p_to)?.label ?? '';
    setBusy(true);
    await command(
      words(t('pages.tasks.delegate.done', { name })),
      () => rpc('task_delegate', { p_id: task.id, ...r.values }) as Promise<{ request_id?: string | null }>,
      { after: onClose },
    );
    setBusy(false);
  };

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      data-delegate
    >
      <Field label={t('pages.tasks.delegate.to')} error={toError}>
        {(p) => (
          <Select
            id={p.id}
            value={to ?? ''}
            placeholder={t('pages.tasks.delegate.to_required')}
            onValueChange={(v) => {
              setToError(undefined);
              setTo(v);
            }}
            options={people}
          />
        )}
      </Field>
      <Field label={t('pages.tasks.delegate.reason')} error={reasonError}>
        {(p) => (
          <Textarea
            {...p}
            rows={3}
            maxLength={HAND_OVER_REASON_MAX}
            value={reason}
            onChange={(e) => {
              setReasonError(undefined);
              setReason(e.target.value);
            }}
            name="reason"
          />
        )}
      </Field>
      <p className="-mt-2 text-sm text-muted" data-reason-count>
        {t('pages.tasks.delegate.reasonCount', {
          count: formatNumber(reason.trim().length, locale),
          max: formatNumber(HAND_OVER_REASON_MAX, locale),
        })}
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" type="submit" loading={busy} data-hand-over-send>
          {t('pages.tasks.delegate.send')}
        </Button>
      </div>
    </form>
  );
}
