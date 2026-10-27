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
            'flex w-[360px] max-w-[calc(100vw-32px)] items-start gap-2.5 rounded-md border border-border bg-raised p-3 text-text shadow-2 font-ui text-sm has-[[data-cancel]]:flex-wrap has-[[data-cancel]]:[&_[data-content]]:basis-[calc(100%-2rem)]',
          title: 'font-semibold',
          description: 'text-muted',
          actionButton:
            'ms-auto shrink-0 self-center h-8 max-sm:h-11 rounded-md border border-border-strong bg-raised px-3 text-sm font-medium text-text hover:bg-surface',
          cancelButton:
            'shrink-0 self-center h-8 max-sm:h-11 rounded-md border border-border-strong bg-raised px-3 text-sm font-medium text-text hover:bg-surface ms-8',
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
export type ToastExtra = { label: string; onClick: () => void };

/** The message that now offers Undo, so the next one can take its place. */
let lastUndo: string | number | undefined;

export const toast = {
  /** A command succeeded. Pass `undo` when the command is undoable; the button is "Undo". */
  done(title: string, opts: { description?: string; undo?: ToastUndo; extra?: ToastExtra; id?: string | number } = {}) {
    // only the newest message offers Undo: an older one left behind could be pressed by mistake (a phone stacks them)
    if (opts.undo && lastUndo !== undefined) sonnerToast.dismiss(lastUndo);
    const shown = sonnerToast.success(title, {
      id: opts.id,
      description: opts.description,
      action: opts.undo ? { label: opts.undo.label, onClick: () => void opts.undo!.onUndo() } : undefined,
      // a second thing to do with what just happened (Done → Log as achievement): a button beside Undo, and a way out
      ...(opts.extra ? { cancel: { label: opts.extra.label, onClick: opts.extra.onClick }, closeButton: true } : {}),
    });
    if (opts.undo) lastUndo = shown;
    return shown;
  },
  /** A command was refused or failed: the reason in words, never a code. */
  failed(title: string, description?: string, id?: string | number) {
    return sonnerToast.error(title, { description, duration: 8000, id });
  },
  /** Something is under way (an Undo that takes a moment): a message at once, which the result then replaces. */
  working(title: string) {
    return sonnerToast.loading(title);
  },
  dismiss: sonnerToast.dismiss,
};
