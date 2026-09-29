'use client';
import * as RA from '@radix-ui/react-alert-dialog';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

/**
 * The app's own confirm box (D19): every remove asks first, names the item, and Cancel has focus
 * so Enter never destroys anything. Escape cancels and focus returns to the opener (Radix).
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onConfirm,
  destructive = true,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Must name the item, e.g. t('confirm.title', { item: 'INV-T-0001' }). */
  title: ReactNode;
  body?: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  busy?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (open) opener.current = document.activeElement;
  }, [open]);
  return (
    <RA.Root open={open} onOpenChange={onOpenChange}>
      <RA.Portal>
        <RA.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RA.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (opener.current instanceof HTMLElement) opener.current.focus();
          }}
          className="fixed inset-x-4 top-[20vh] z-50 mx-auto flex w-auto max-w-[440px] flex-col gap-4 rounded-lg border border-border bg-raised p-5 text-text shadow-2 focus:outline-none"
        >
          <RA.Title className="font-display text-lg font-semibold">{title}</RA.Title>
          {body ? (
            <RA.Description className="text-base text-muted">{body}</RA.Description>
          ) : (
            <RA.Description className="sr-only">{title}</RA.Description>
          )}
          <div className="flex justify-end gap-2">
            <RA.Cancel asChild>
              <Button ref={cancelRef} variant="secondary" data-confirm-cancel>
                {cancelLabel}
              </Button>
            </RA.Cancel>
            <RA.Action asChild>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                loading={busy}
                data-confirm-action
                onClick={(e) => {
                  e.preventDefault();
                  void Promise.resolve(onConfirm()).then(() => onOpenChange(false));
                }}
              >
                {confirmLabel}
              </Button>
            </RA.Action>
          </div>
        </RA.Content>
      </RA.Portal>
    </RA.Root>
  );
}
