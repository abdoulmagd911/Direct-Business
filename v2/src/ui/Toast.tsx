'use client';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Toasts: bottom-end, 5 s, past tense ("Task created"), Undo where the command is undoable (§2.4).
 * No coloured side stripe; the icon and the word carry the outcome.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      dir="auto"
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
            'ms-auto shrink-0 self-center h-8 rounded-md border border-border-strong bg-raised px-3 text-sm font-medium text-text hover:bg-surface',
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

export type ToastUndo = { label: string; onUndo: () => void | Promise<void> };

export const toast = {
  /** A command succeeded. Pass `undo` when the command is undoable; the button is "Undo". */
  done(title: string, opts: { description?: string; undo?: ToastUndo } = {}) {
    return sonnerToast.success(title, {
      description: opts.description,
      action: opts.undo ? { label: opts.undo.label, onClick: () => void opts.undo!.onUndo() } : undefined,
    });
  },
  /** A command was refused or failed: the reason in words, never a code. */
  failed(title: string, description?: string) {
    return sonnerToast.error(title, { description, duration: 8000 });
  },
  dismiss: sonnerToast.dismiss,
};
