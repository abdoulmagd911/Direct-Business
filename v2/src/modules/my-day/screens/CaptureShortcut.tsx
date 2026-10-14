'use client';
import { useEffect } from 'react';
import { openQuickCapture } from '../quick-capture';

/**
 * "/" anywhere on My day opens the Quick capture sheet. There is no Capture button on the page (daily use 11): the one
 * add control is Create on a PC and the + on a phone, and Create → Capture opens this same sheet.
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
