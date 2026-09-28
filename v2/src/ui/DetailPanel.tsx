'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from './cn';
import { IconButton } from './IconButton';
import { useMediaQuery } from './useMediaQuery';

/**
 * The detail panel: 480 px on the end side beside the list (which stays interactive); a full page
 * under 900 px. Escape closes it and focus returns to the row that opened it (M93).
 * Above 900 px it is an inline aside; below, a Radix Dialog (focus trap, Escape).
 */
export function DetailPanel({
  open,
  onClose,
  title,
  children,
  closeLabel,
  header,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  closeLabel: string;
  /** Extra header row (tabs, chips) under the title. */
  header?: ReactNode;
  className?: string;
}) {
  const opener = useRef<Element | null>(null);
  const panel = useRef<HTMLElement>(null);
  // Under 900 px the panel is a full page (a dialog); the choice is made here, not by CSS, because a portal escapes a hidden wrapper.
  const narrow = useMediaQuery('(max-width: 899px)');

  useEffect(() => {
    if (open) {
      opener.current = document.activeElement;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && panel.current?.contains(document.activeElement)) {
          e.stopPropagation();
          onClose();
        }
      };
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('keydown', onKey);
        if (opener.current instanceof HTMLElement) opener.current.focus();
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const body = (
    <>
      <header className="flex items-start gap-3 border-b border-border px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl">{title}</h2>
          {header}
        </div>
        <IconButton label={closeLabel} icon={<X />} size="sm" onClick={onClose} data-panel-close />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </>
  );

  if (narrow) {
    return (
      <RD.Root open onOpenChange={(o) => !o && onClose()}>
        <RD.Portal>
          <RD.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-40 flex flex-col bg-raised text-text focus:outline-none"
            data-detail-panel
          >
            <RD.Title className="sr-only">{title}</RD.Title>
            {body}
          </RD.Content>
        </RD.Portal>
      </RD.Root>
    );
  }
  return (
    <aside
      ref={panel}
      aria-label={typeof title === 'string' ? title : undefined}
      tabIndex={-1}
      data-detail-panel
      className={cn('hidden w-[var(--panel-w)] shrink-0 flex-col border-s border-border bg-raised md:flex', className)}
    >
      {body}
    </aside>
  );
}
