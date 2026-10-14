'use client';
import { useCallback, useEffect, useState } from 'react';

export type ScrollMore = 'start' | 'end' | 'both' | undefined;

/** Which sides of a sideways-scrolling row still have content out of view (logical sides: in Arabic the start is on the right). */
export function scrollMoreOf(el: Pick<HTMLElement, 'scrollLeft' | 'scrollWidth' | 'clientWidth'>): ScrollMore {
  const from = Math.abs(el.scrollLeft);
  const start = from > 1;
  const end = from + el.clientWidth < el.scrollWidth - 1;
  return start && end ? 'both' : start ? 'start' : end ? 'end' : undefined;
}

/**
 * A row that scrolls sideways with no scroll bar or arrows shows that there is more by a fade at the edge that still
 * has some (W-daily 12; the fade is the `data-scroll-more` rule in globals.css). Spread the result on the row.
 */
export function useScrollMore() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [more, setMore] = useState<ScrollMore>(undefined);
  const ref = useCallback((node: HTMLElement | null) => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    const measure = () => setMore(scrollMoreOf(el));
    const watch = new ResizeObserver(measure); // also answers once when it starts watching
    watch.observe(el);
    for (const child of Array.from(el.children)) watch.observe(child);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      watch.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [el]);
  return { ref, 'data-scroll-more': more };
}
