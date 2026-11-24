'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Dragging a card between the board's columns (Landing 33, B5), by pointer events — one path for a mouse, a pen and
 * a finger. A mouse drags a card from anywhere on it once it has moved 6 px (a plain click still opens the task); a
 * finger drags from the card's grip, which gives up the browser's own scrolling (`touch-action: none`), so a swipe
 * anywhere else on the board still scrolls it. While a card is carried, the column under the pointer is marked, the
 * board scrolls sideways near its edges, and Escape puts the card back. Letting go over another column hands the
 * board the card and the column; nothing is moved here — the board asks the same move the status pill would.
 *
 * Landing 47: a column takes a card anywhere in its LANE — the strip of the board above and below it, not only the
 * column's own box. A short column (an empty one above all) is a few lines tall beside a long one, and a card carried
 * straight across from lower down passed under it and was not taken. And the board's sideways scroll near an edge
 * goes by the clock, not by the screen's refresh rate (a 120 Hz phone scrolled twice as fast as a 60 Hz one), slower
 * at the strip's inner side than at the board's very edge, so a column can be stopped on.
 */
export type DragState = { id: string; x: number; y: number; over: string | null; label: string } | null;

const START_PX = 6;
export const EDGE_PX = 56;
/** The sideways scroll at the board's very edge, in px a second (what 14 px a frame was on a 60 Hz screen). */
export const SCROLL_PX_S = 840;

export type Box = { left: number; right: number; top: number; bottom: number };

/**
 * The column whose lane holds the point: inside the board, the column the point is level with — whether the point
 * is on the column's own box or above or below it. Null outside the board and in the gap between two columns.
 */
export function laneAt(x: number, y: number, board: Box, columns: readonly { key: string; box: Box }[]): string | null {
  if (x < board.left || x > board.right || y < board.top || y > board.bottom) return null;
  for (const c of columns) if (x >= c.box.left && x <= c.box.right) return c.key;
  return null;
}

/**
 * How far the board scrolls sideways for a pointer at `x` over `ms` milliseconds: nothing outside the two edge
 * strips; inside one, from about a third of the full speed at the strip's inner side to the full speed at the edge.
 * Negative is towards the left edge. A long gap between two frames counts as 50 ms at most, so the board never jumps.
 */
export function edgeScroll(x: number, left: number, right: number, ms: number): number {
  const into = x < left + EDGE_PX ? left + EDGE_PX - x : x > right - EDGE_PX ? x - (right - EDGE_PX) : 0;
  if (into <= 0) return 0;
  const depth = Math.min(1, into / EDGE_PX);
  const px = (SCROLL_PX_S * (0.35 + 0.65 * depth) * Math.min(Math.max(ms, 0), 50)) / 1000;
  return x < left + EDGE_PX ? -px : px;
}

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
    if (col instanceof HTMLElement) return col.dataset.boardKey ?? null;
    // not on a column's own box: the column whose lane the pointer is in (a short column under a long one's card)
    const f = frame.current;
    if (!f) return null;
    const columns = Array.from(f.querySelectorAll<HTMLElement>('[data-board-column]')).map((c) => ({
      key: c.dataset.boardKey ?? '',
      box: c.getBoundingClientRect(),
    }));
    return laneAt(x, y, f.getBoundingClientRect(), columns) || null;
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
    let then = performance.now();
    // the part of a pixel not yet scrolled: a browser keeps whole pixels, and a slow frame's step can be under one
    let owed = 0;
    const tick = (now: number) => {
      const f = frame.current;
      if (!f || !live.current?.on) return;
      const r = f.getBoundingClientRect();
      const { x: px, y: py } = last.current;
      const before = f.scrollLeft;
      const step = edgeScroll(px, r.left, r.right, now - then);
      then = now;
      owed = step === 0 ? 0 : owed + step;
      const whole = Math.trunc(owed);
      if (whole !== 0) {
        f.scrollLeft += whole;
        owed -= whole;
      }
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
