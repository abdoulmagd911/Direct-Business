'use client';
import * as RP from '@radix-ui/react-popover';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * A hover card (V61, §2.5): opens after a short rest of the mouse on the trigger, or when the keyboard brings focus to
 * it, and closes when the pointer leaves both; the content is read once, through `load`. The trigger stays whatever it
 * is (a link, a chip).
 *
 * Landing 34 — the card never takes a click and never sits there empty:
 *  - it opens only once its content has been read. Before, it opened at once on "Loading" and stayed so for as long
 *    as the read took (seconds on a slow day), over the very row that had just been clicked;
 *  - a press on the trigger closes it and calls off one that was about to open: the press is the link's alone. Before,
 *    the click's own focus opened the card (focus counted as hover), so a click on a name drew a "Loading" card
 *    while the record was on its way;
 *  - a finger never opens it. Touch has no hover: a tap goes straight to the record. Only a mouse pointer resting on
 *    the trigger, or keyboard focus (`:focus-visible`), opens the card;
 *  - the trigger is the card's anchor, not a popover trigger, so nothing but the rest or the focus can open it.
 */
export function HoverCard<T>({
  children,
  load,
  render,
  className,
  openDelayMs = 350,
}: {
  children: ReactNode;
  load: () => Promise<T>;
  render: (data: T | null, state: 'loading' | 'ready' | 'failed') => ReactNode;
  className?: string;
  openDelayMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef(false);
  /** The read has answered (or failed): there is something to show. */
  const settled = useRef(false);
  /** The pointer is resting on the trigger or the card (or the keyboard is on the trigger): the card is wanted. */
  const wanted = useRef(false);
  const ask = () => {
    if (asked.current) return;
    asked.current = true;
    const land = (next: 'ready' | 'failed') => {
      settled.current = true;
      setState(next);
      // the read landed while the pointer is still resting there: now the card opens, with its content
      if (wanted.current) setOpen(true);
    };
    load()
      .then((d) => {
        setData(d);
        land('ready');
      })
      .catch(() => land('failed'));
  };
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      wanted.current = true;
      ask();
      if (settled.current) setOpen(true);
    }, openDelayMs);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    wanted.current = false;
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  /** A press on the trigger: the card goes, and one about to open is called off. */
  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    wanted.current = false;
    setOpen(false);
  };
  return (
    <RP.Root open={open} onOpenChange={(o) => (o ? undefined : dismiss())}>
      <RP.Anchor
        asChild
        onPointerEnter={(e) => (hoverOpens(e.pointerType) ? show() : undefined)}
        onPointerLeave={hide}
        onFocus={(e) => (keyboardFocus(e.currentTarget) ? show() : undefined)}
        onBlur={hide}
        onPointerDown={dismiss}
        onClick={dismiss}
        data-hover-trigger
      >
        {children}
      </RP.Anchor>
      <RP.Portal>
        <RP.Content
          side="bottom"
          align="start"
          sideOffset={6}
          onPointerEnter={() => {
            wanted.current = true;
            if (timer.current) clearTimeout(timer.current);
          }}
          onPointerLeave={hide}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'motion-menu z-50 w-[320px] max-w-[calc(100vw-32px)] origin-[var(--radix-popover-content-transform-origin)] rounded-lg border border-border bg-raised p-4 text-sm text-text shadow-2',
            className,
          )}
          data-hover-card
        >
          {render(data, state)}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}

/** Focus the keyboard brought (`:focus-visible`) — not the focus a click or a tap leaves behind on a link. */
function keyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}

/** Which pointers a rest of opens the card: a mouse. A finger or a pen has no hover — its touch is a press. */
export function hoverOpens(pointerType: string): boolean {
  return pointerType === 'mouse';
}
