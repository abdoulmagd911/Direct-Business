'use client';
import { useState, type ReactNode } from 'react';
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
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const ok = reason.trim().length > 0 && !saveDisabled;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason('');
          setTouched(false);
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
              try {
                await onSave(reason.trim());
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
