'use client';
import { useEffect } from 'react';

/**
 * How much of the page's foot the on-screen keyboard covers, in px: the page's own height (the layout viewport, which a
 * phone's keyboard does not shorten) less what is visible above the keyboard. 0 with no keyboard, and 0 while the page
 * is zoomed in (a zoom also makes the visible part smaller).
 */
export function keyboardInset(layoutHeight: number, vv: { height: number; offsetTop: number; scale: number }): number {
  if (vv.scale > 1.01) return 0;
  return Math.max(0, Math.round(layoutHeight - vv.height - vv.offsetTop));
}

/**
 * Keeps `--kb` on <html> at the height the phone's on-screen keyboard covers. A phone's browser lays the keyboard over
 * the page without making the page shorter, so a dialog placed by the screen's height kept its footer — Save — under
 * the keyboard while the person typed. The dialogs and Ctrl K end above `--kb`; with no keyboard it is 0.
 * Rendered once by the shell.
 */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--kb', `${keyboardInset(root.clientHeight, vv)}px`);
    set();
    vv.addEventListener('resize', set);
    vv.addEventListener('scroll', set);
    return () => {
      vv.removeEventListener('resize', set);
      vv.removeEventListener('scroll', set);
      root.style.removeProperty('--kb');
    };
  }, []);
  return null;
}
