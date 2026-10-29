'use client';
import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * A box that scrolls sideways and says so (QA-593): when its content is wider than the box and there is more to see in
 * the direction of reading, a soft edge with a chevron sits at the end of the box (the right in English, the left in
 * Arabic) and goes away at the last column. A table that cannot be a card on a phone is kept in one of these; the box
 * itself is the scroller, `className` goes on the box, `data-scroll-cue` marks the edge while it shows.
 */
export function ScrollCue({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & Record<`data-${string}`, string | undefined>) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    // right-to-left boxes count scrollLeft from zero downwards: the distance travelled is its size either way
    const travelled = Math.abs(el.scrollLeft);
    setMore(el.scrollWidth > el.clientWidth + 1 && travelled + el.clientWidth < el.scrollWidth - 1);
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    if (el.firstElementChild) watch.observe(el.firstElementChild);
    return () => watch.disconnect();
  }, [measure]);
  return (
    <div className={cn('relative', className)} {...rest}>
      <div ref={box} onScroll={measure} className="overflow-x-auto">
        {children}
      </div>
      {more ? (
        <span
          aria-hidden="true"
          data-scroll-cue
          className="pointer-events-none absolute inset-y-0 end-0 flex w-10 items-center justify-end rounded-e-lg bg-linear-to-l from-raised via-raised/80 to-transparent pe-1 text-muted rtl:bg-linear-to-r"
        >
          <ChevronRight className="size-5 rtl:rotate-180" />
        </span>
      ) : null}
    </div>
  );
}
