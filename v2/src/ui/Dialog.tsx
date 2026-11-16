'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';

/**
 * Dialog. Radix gives focus trapping, Escape and focus return (M93). Each dialog OWNS its form state:
 * put the form (react-hook-form's useForm) inside `children`, which only mounts while open — closing
 * unmounts it, so nothing leaks between dialogs (§0 "each dialog owns its own form state").
 * `dirty` keeps Escape and the backdrop from closing a half-filled form; the Cancel button always can.
 * The X is named in the language on screen (the catalog's Close) unless the caller names it.
 * Its height follows the visible screen (`dvh`, not `vh`: a phone's address bar takes from the visible height, so a
 * `vh` box ran under it) and gives way to the on-screen keyboard (`--kb`, set by the shell): the body scrolls and the
 * footer's buttons stay above the keyboard.
 * The look (V21): 20 px corners, the menu shadow; it fades in, grows from 96% and rises 8 px in 240 ms and leaves in
 * 160 ms, the scrim fading with it (globals.css `motion-dialog`, `motion-scrim`).
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
  closeLabel,
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
  const t = useTranslations('common');
  const descId = useId();
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (open) opener.current = document.activeElement;
  }, [open]);
  const width = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' }[size];
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="motion-scrim fixed inset-0 z-40 bg-scrim" />
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
            'motion-dialog fixed inset-x-4 top-[10dvh] z-50 mx-auto flex max-h-[calc(80dvh-var(--kb,0px))] w-auto flex-col overflow-hidden rounded-xl border border-border bg-raised text-text shadow-2 focus:outline-none',
            width,
          )}
        >
          <header className="flex items-center gap-3 pb-2 pe-4 ps-6 pt-4 max-sm:pe-3 max-sm:ps-4">
            <RD.Title className="min-w-0 flex-1 break-words font-display text-xl font-semibold leading-7 text-strong">
              {title}
            </RD.Title>
            <RD.Close asChild>
              <IconButton label={closeLabel ?? t('close')} icon={<X />} size="sm" />
            </RD.Close>
          </header>
          {description ? (
            <RD.Description id={descId} className="sr-only">
              {description}
            </RD.Description>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-2 max-sm:px-4">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4 max-sm:px-4">
              {footer}
            </footer>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
