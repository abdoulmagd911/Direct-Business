'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { errorKey } from '@/core/db/words';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { Textarea } from './Input';

/**
 * A change that must carry its reason (access, people, teams — V125, V132): the title names the change, the body says
 * what it does in data terms, the reason is required, Save runs it. Nothing else — the change is described, not explained.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  body,
  children,
  onSave,
  words,
  saveDisabled = false,
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  onSave: (reason: string) => Promise<void>;
  words: { reason: string; save: string; cancel: string; reasonRequired: string };
  saveDisabled?: boolean;
  destructive?: boolean;
}) {
  const t = useTranslations();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = reason.trim().length > 0 && !saveDisabled;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason('');
          setTouched(false);
          setError(null);
        }
        onOpenChange(o);
      }}
      title={title}
      dirty={reason.length > 0}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{words.cancel}</Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={!ok}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onSave(reason.trim());
                setReason('');
                setTouched(false);
                onOpenChange(false);
              } catch (e) {
                // the save failed: say so in the dialog and keep it open with the reason intact — before, the
                // throw escaped silently, the dialog stayed open, busy was released, and nothing was said
                // anywhere (F131 family). The words are the same refusal words command() uses.
                const { key, detail } = errorKey(e, t.has);
                setError(t(key, { detail }));
              } finally {
                setBusy(false);
              }
            }}
            data-reason-save
          >
            {words.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {body ? <p className="text-sm text-muted">{body}</p> : null}
        {children}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Field label={words.reason} error={touched && !reason.trim() ? words.reasonRequired : undefined}>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              data-reason
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}
