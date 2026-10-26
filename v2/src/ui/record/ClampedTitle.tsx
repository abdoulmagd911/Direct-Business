'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';

/**
 * The record's name over three lines at most, then a "more" tap that opens the rest (V653, V654). The tap shows only
 * when the name really is cut, so a short name has none; once opened it stays open and offers "less".
 */
export function ClampedTitle({
  children,
  className,
  words,
}: {
  children: ReactNode;
  className?: string;
  words: { more: string; less: string };
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (!open) setCut(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);
  return (
    <>
      <h1 ref={ref} className={cn(open ? '' : 'line-clamp-3', className)} data-record-title>
        {children}
      </h1>
      {cut || open ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-record-title-more
          className="inline-flex min-h-6 w-fit items-center text-sm font-medium text-link hover:underline focus-visible:outline-2 focus-visible:outline-focus max-sm:min-h-11"
        >
          {open ? words.less : words.more}
        </button>
      ) : null}
    </>
  );
}
