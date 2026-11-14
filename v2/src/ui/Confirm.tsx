'use client';
import * as RA from '@radix-ui/react-alert-dialog';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

/**
 * The app's own confirm box (D19): every remove asks first, names the item, and Cancel has focus
 * so Enter never destroys anything. Escape cancels and focus returns to the opener (Radix). A question that destroys
 * nothing (Mark done?) may put focus on the confirming button instead (`focus="confirm"`), so Enter confirms.
 * The confirming button runs once: a second tap while the first is still on its way does nothing (a double tap on a
 * phone sent the same removal twice — one "Removed" toast and one refusal), and it shows it is working meanwhile.
 * The box is never taller than the visible screen; a long name scrolls inside it.
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  body,
  extra,
  cancelLabel,
  confirmLabel,
  onConfirm,
  destructive = true,
  busy = false,
  focus = 'cancel',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Must name the item, e.g. t('confirm.title', { item: 'INV-T-0001' }). */
  title: ReactNode;
  body?: ReactNode;
  /** FIX-27: an extra choice inside the confirm, between the body and the buttons (e.g. "delete its reminder too"). */
  extra?: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  busy?: boolean;
  focus?: 'cancel' | 'confirm';
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  // the confirm in flight: a ref, so a second tap in the same moment (before a render) is refused too
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (open) opener.current = document.activeElement;
  }, [open]);
  const confirm = () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    void Promise.resolve()
      .then(() => onConfirm())
      .then(
        () => onOpenChange(false),
        // the box stays open, so the person can try again or cancel; a command() says its own refusal
        (e: unknown) => console.error(e),
      )
      .finally(() => {
        running.current = false;
        setPending(false);
      });
  };
  return (
    <RA.Root open={open} onOpenChange={onOpenChange}>
      <RA.Portal>
        <RA.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RA.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (focus === 'confirm' ? confirmRef : cancelRef).current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (opener.current instanceof HTMLElement) opener.current.focus();
          }}
          className="fixed inset-x-4 top-[20dvh] z-50 mx-auto flex max-h-[76dvh] w-auto max-w-[440px] flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-raised p-5 text-text shadow-2 focus:outline-none"
        >
          <RA.Title className="font-display text-lg font-semibold">{title}</RA.Title>
          {body ? (
            <RA.Description className="text-base text-muted">{body}</RA.Description>
          ) : (
            <RA.Description className="sr-only">{title}</RA.Description>
          )}
          {extra ? <div className="flex flex-col gap-2">{extra}</div> : null}
          <div className="flex justify-end gap-2">
            <RA.Cancel asChild>
              <Button ref={cancelRef} variant="secondary" data-confirm-cancel>
                {cancelLabel}
              </Button>
            </RA.Cancel>
            <RA.Action asChild>
              <Button
                ref={confirmRef}
                variant={destructive ? 'danger' : 'primary'}
                loading={busy || pending}
                data-confirm-action
                onClick={(e) => {
                  e.preventDefault();
                  confirm();
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
