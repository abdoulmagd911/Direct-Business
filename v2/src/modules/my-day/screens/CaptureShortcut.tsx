'use client';
import { useEffect } from 'react';
import { openQuickCapture } from '../quick-capture';

/**
 * "/" anywhere on My day opens the Quick capture sheet — the same sheet as Create → Capture, the phone's + and, from
 * 640 px up, the banner's Capture button (Landing 31, the 15 Nov board; a phone keeps the + as its one add control).
 * This piece draws nothing itself.
 */
export function CaptureShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        openQuickCapture();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return null;
}
