'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';

/**
 * Dialog. Radix gives focus trapping, Escape and focus return (M93). Each dialog OWNS its form state:
 * put the form (react-hook-form's useForm) inside `children`, which only mounts while open — closing
 * unmounts it, so nothing leaks between dialogs (§0 "each dialog owns its own form state").
 * `dirty` keeps Escape and the backdrop from closing a half-filled form; the Cancel button always can.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  dirty = false,
  size = 'md',
  closeLabel = 'Close',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Optional one-line description read by screen readers (not shown as a hint). */
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dirty?: boolean;
  size?: 'sm' | 'md' | 'lg';
  closeLabel?: string;
}) {
  const descId = useId();
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (open) opener.current = document.activeElement;
  }, [open]);
  const width = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' }[size];
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in" />
        <RD.Content
          aria-describedby={description ? descId : undefined}
          onEscapeKeyDown={(e) => {
            if (dirty) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (dirty) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (opener.current instanceof HTMLElement) opener.current.focus();
          }}
          className={cn(
            'fixed inset-x-4 top-[10vh] z-50 mx-auto flex max-h-[80vh] w-auto flex-col overflow-hidden rounded-lg border border-border bg-raised text-text shadow-2 focus:outline-none',
            width,
          )}
        >
          <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <RD.Title className="min-w-0 flex-1 font-display text-lg font-semibold">{title}</RD.Title>
            <RD.Close asChild>
              <IconButton label={closeLabel} icon={<X />} size="sm" />
            </RD.Close>
          </header>
          {description ? (
            <RD.Description id={descId} className="sr-only">
              {description}
            </RD.Description>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <footer className="flex justify-end gap-2 border-t border-border bg-surface px-5 py-3">{footer}</footer>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export const DialogClose = RD.Close;
