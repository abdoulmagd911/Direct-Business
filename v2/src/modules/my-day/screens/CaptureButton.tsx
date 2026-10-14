'use client';
import { StickyNote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/ui/Button';
import { openQuickCapture } from '../quick-capture';

/**
 * My day's one way to capture (V633): a button that opens the same Quick capture sheet as Create → Capture and the
 * phone + — Note, Idea, Checklist, Reminder, Only me unless chosen otherwise. "/" anywhere on My day opens it too.
 */
export function CaptureButton() {
  const t = useTranslations();
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
  return (
    <section data-capture>
      <Button
        variant="primary"
        icon={<StickyNote />}
        onClick={openQuickCapture}
        className="w-full sm:w-auto"
        data-capture-open
      >
        {t('pages.myDay.capture.label')}
      </Button>
    </section>
  );
}
