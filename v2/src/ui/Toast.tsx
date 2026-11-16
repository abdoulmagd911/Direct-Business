'use client';
import { useLocale } from 'next-intl';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Toasts: bottom-end, 5 s, past tense ("Task created"), Undo where the command is undoable (§2.4).
 * A toast with Undo to press stays 10 s, twice as long as a plain done toast (F-B1-05: the file-removal Undo
 * vanished before it could be read).
 * The look (V21): the toast is the inverse pair (dark on a light theme, light on a dark one), 14 px corners; it rises
 * 8 px into place in 200 ms and leaves in 160 ms (globals.css).
 * No coloured side stripe; the icon and the word carry the outcome. The toaster's side is physical, so the end
 * side is named per language: bottom-right in English, bottom-left in Arabic. On a phone, a refusal raised while a
 * sheet or a dialog is open comes from the top (`placed` below): a sheet's own buttons sit at the foot of the screen,
 * and a refusal toast there covered the very button the person needed (Quick capture, the More sheet).
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
            'flex w-[360px] max-w-[calc(100vw-32px)] flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-inverse py-3 pe-3 ps-4 text-on-inverse shadow-2 font-ui text-base font-medium',
          title: 'font-medium',
          content: 'min-w-0 flex-1',
          description: 'text-sm font-normal opacity-80',
          actionButton:
            'ms-auto shrink-0 self-center h-8 max-sm:h-11 rounded-pill border border-current/40 bg-transparent px-3.5 text-sm font-semibold text-on-inverse hover:bg-[color-mix(in_srgb,currentColor_14%,transparent)]',
          icon: 'shrink-0',
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-[18px]" />,
        error: <XCircle className="size-[18px]" />,
      }}
    />
  );
}

/**
 * Where a refusal goes, decided once, when it is raised: on a phone while a dialog or a sheet holds the screen (Radix
 * marks the body `data-scroll-locked` while one is open), from the top — the person is still in the sheet and needs
 * its buttons; otherwise at the toaster's foot. A toast never moves after that, and one already on the screen (an
 * update by its id, "Undoing…" becoming a refusal) keeps its place. Done and working toasts always join the one stack
 * at the foot: the newest is the one in front, and only one Undo is in front at a time. Moving the whole toaster
 * instead, as it first did, rebuilt every toast on the screen each time a dialog opened or closed: each one jumped to
 * the other end and began its 10 s again, so after "Delete?" an older toast's Undo still sat in front of the new one;
 * and placing done toasts at the top too showed two Undo buttons at once, at the two ends (13 Nov).
 */
function placed<T extends { id?: string | number }>(opts: T): T & { position?: 'top-center' } {
  if (typeof document === 'undefined') return opts;
  if (opts.id !== undefined && sonnerToast.getToasts().some((t) => t.id === opts.id)) return opts;
  const held = document.body.hasAttribute('data-scroll-locked');
  return held && window.matchMedia('(max-width: 639px)').matches ? { ...opts, position: 'top-center' } : opts;
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
    return sonnerToast.error(title, placed({ description, duration: 8000, id }));
  },
  /** Something is under way (an Undo that takes a moment): a message at once, which the result then replaces. */
  working(title: string) {
    return sonnerToast.loading(title);
  },
  /** Takes every toast away — Quick capture clears what was just done when it opens, so a toast never covers its sheet. */
  dismiss: sonnerToast.dismiss,
};
