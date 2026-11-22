'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Dragging a card between the board's columns (Landing 33, B5), by pointer events — one path for a mouse, a pen and
 * a finger. A mouse drags a card from anywhere on it once it has moved 6 px (a plain click still opens the task); a
 * finger drags from the card's grip, which gives up the browser's own scrolling (`touch-action: none`), so a swipe
 * anywhere else on the board still scrolls it. While a card is carried, the column under the pointer is marked, the
 * board scrolls sideways near its edges, and Escape puts the card back. Letting go over another column hands the
 * board the card and the column; nothing is moved here — the board asks the same move the status pill would.
 */
export type DragState = { id: string; x: number; y: number; over: string | null; label: string } | null;

const START_PX = 6;
const EDGE_PX = 56;
const SCROLL_PX = 14;

export function useBoardDrag(onDrop: (cardId: string, columnKey: string) => void) {
  const [drag, setDrag] = useState<DragState>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  // what the pointer is doing between down and up; a ref, so moves do not re-render until a drag has begun
  const live = useRef<{
    id: string;
    label: string;
    pointer: number;
    x0: number;
    y0: number;
    on: boolean;
    from: string | null;
    el: HTMLElement;
  } | null>(null);
  const justDragged = useRef(false);
  const timer = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  const columnAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    const col = el instanceof Element ? el.closest('[data-board-column]') : null;
    return col instanceof HTMLElement ? (col.dataset.boardKey ?? null) : null;
  };

  const stop = useCallback(() => {
    if (timer.current !== null) window.cancelAnimationFrame(timer.current);
    timer.current = null;
    if (frame.current) frame.current.style.scrollSnapType = '';
    const l = live.current;
    if (l) {
      try {
        l.el.releasePointerCapture(l.pointer);
      } catch {
        // already released
      }
    }
    live.current = null;
    setDrag(null);
  }, []);

  const begin = (l: NonNullable<typeof live.current>, x: number, y: number) => {
    l.on = true;
    if (frame.current) frame.current.style.scrollSnapType = 'none';
    try {
      l.el.setPointerCapture(l.pointer);
    } catch {
      // a pointer that cannot be captured still drags while it stays over the page
    }
    // near the board's edges it scrolls sideways, so a column off the screen can be reached
    const tick = () => {
      const f = frame.current;
      if (!f || !live.current?.on) return;
      const r = f.getBoundingClientRect();
      const { x: px, y: py } = last.current;
      const before = f.scrollLeft;
      if (px < r.left + EDGE_PX) f.scrollLeft -= SCROLL_PX;
      else if (px > r.right - EDGE_PX) f.scrollLeft += SCROLL_PX;
      if (f.scrollLeft !== before) setDrag((d) => (d ? { ...d, over: columnAt(px, py) } : d));
      timer.current = window.requestAnimationFrame(tick);
    };
    timer.current = window.requestAnimationFrame(tick);
    setDrag({ id: l.id, x, y, over: columnAt(x, y), label: l.label });
  };

  /** On a card (a mouse or a pen) and on its grip (any pointer, `immediate`). */
  const down =
    (card: { id: string; label: string; column: string }, immediate = false) =>
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || live.current) return;
      if (!immediate && e.pointerType === 'touch') return;
      // the status pill, and anything else that is a control of its own, is not a drag
      if (!immediate && e.target instanceof Element && e.target.closest('button, [role="menu"], [data-no-drag]'))
        return;
      const l = {
        id: card.id,
        label: card.label,
        pointer: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        on: false,
        from: card.column,
        el: e.currentTarget,
      };
      live.current = l;
      last.current = { x: e.clientX, y: e.clientY };
      if (immediate) {
        e.preventDefault();
        begin(l, e.clientX, e.clientY);
      }
    };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const l = live.current;
      if (!l || e.pointerId !== l.pointer) return;
      last.current = { x: e.clientX, y: e.clientY };
      if (!l.on) {
        if (Math.hypot(e.clientX - l.x0, e.clientY - l.y0) < START_PX) return;
        begin(l, e.clientX, e.clientY);
        return;
      }
      e.preventDefault();
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: columnAt(e.clientX, e.clientY) } : d));
    };
    const up = (e: PointerEvent) => {
      const l = live.current;
      if (!l || e.pointerId !== l.pointer) return;
      const was = l.on;
      const over = was ? columnAt(e.clientX, e.clientY) : null;
      const { id, from } = l;
      stop();
      if (!was) return;
      // the click that follows a drag must not open the task
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      if (over && over !== from) onDrop(id, over);
    };
    const cancel = (e: PointerEvent) => {
      if (live.current && e.pointerId === live.current.pointer) stop();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && live.current?.on) stop();
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      if (timer.current !== null) window.cancelAnimationFrame(timer.current);
    };
    // `begin` and `columnAt` read only refs and the document
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDrop, stop]);

  /** Swallow the click a finished drag leaves on the card's link. */
  const clickCapture = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (justDragged.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return { drag, frame, down, clickCapture };
}
