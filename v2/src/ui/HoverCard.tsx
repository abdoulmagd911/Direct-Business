'use client';
import * as RP from '@radix-ui/react-popover';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * A hover card (V61, §2.5): opens after a short rest on the trigger, or on focus, and closes when the pointer leaves
 * both; the content is read once, when it first opens, through `load`. The trigger stays whatever it is (a link, a
 * chip), so the card never steals a click.
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
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(true);
      if (!asked.current) {
        asked.current = true;
        load()
          .then((d) => {
            setData(d);
            setState('ready');
          })
          .catch(() => setState('failed'));
      }
    }, openDelayMs);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  return (
    <RP.Root open={open} onOpenChange={setOpen}>
      <RP.Trigger asChild onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}>
        {children}
      </RP.Trigger>
      <RP.Portal>
        <RP.Content
          side="bottom"
          align="start"
          sideOffset={6}
          onPointerEnter={show}
          onPointerLeave={hide}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'z-50 w-[320px] rounded-lg border border-border bg-raised p-3 text-sm text-text shadow-2',
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
