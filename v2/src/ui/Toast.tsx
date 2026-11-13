'use client';
import { useLocale } from 'next-intl';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Toasts: bottom-end, 5 s, past tense ("Task created"), Undo where the command is undoable (§2.4).
 * A toast with Undo to press stays 10 s, twice as long as a plain done toast (F-B1-05: the file-removal Undo
 * vanished before it could be read).
 * No coloured side stripe; the icon and the word carry the outcome. The toaster's side is physical, so the end
 * side is named per language: bottom-right in English, bottom-left in Arabic.
 */
export function Toaster() {
  const rtl = useLocale() === 'ar';
  return (
    <Sonner
      position={rtl ? 'bottom-left' : 'bottom-right'}
      dir={rtl ? 'rtl' : 'ltr'}
      duration={5000}
      gap={8}
      offset={20}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[360px] max-w-[calc(100vw-32px)] items-start gap-2.5 rounded-md border border-border bg-raised p-3 text-text shadow-2 font-ui text-sm',
          title: 'font-semibold',
          description: 'text-muted',
          actionButton:
            'ms-auto shrink-0 self-center h-8 max-sm:h-11 rounded-md border border-border-strong bg-raised px-3 text-sm font-medium text-text hover:bg-surface',
          icon: 'mt-0.5 shrink-0',
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-4 text-success" />,
        error: <XCircle className="size-4 text-danger" />,
      }}
    />
  );
}

type ToastUndo = { label: string; onUndo: () => void | Promise<void> };

export const toast = {
  /** A command succeeded. Pass `undo` when the command is undoable; the button is "Undo". */
  done(title: string, opts: { description?: string; undo?: ToastUndo; id?: string | number } = {}) {
    return sonnerToast.success(title, {
      id: opts.id,
      description: opts.description,
      // a toast with Undo stays twice as long: the choice needs reading time (F-B1-05)
      duration: opts.undo ? 10000 : undefined,
      action: opts.undo ? { label: opts.undo.label, onClick: () => void opts.undo!.onUndo() } : undefined,
    });
  },
  /** A command was refused or failed: the reason in words, never a code. */
  failed(title: string, description?: string, id?: string | number) {
    return sonnerToast.error(title, { description, duration: 8000, id });
  },
  /** Something is under way (an Undo that takes a moment): a message at once, which the result then replaces. */
  working(title: string) {
    return sonnerToast.loading(title);
  },
};
