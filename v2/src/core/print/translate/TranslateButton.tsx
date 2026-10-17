'use client';

import { Languages } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/ui/Button';
import { translateOnDevice, translatorState, type Language, type TranslatorState } from './onDevice';

/**
 * The Translate helper (V76, V403, V302), mounted by the report line editor (P6-2): staff write a line in Arabic or
 * English and the other language is drafted for them. Where the browser cannot translate `from` → `to` on the device
 * the button is not drawn at all — no disabled button, no explanation (V11). The draft goes back to the screen, which
 * marks the field Draft until the editor corrects or confirms it (`report.line.text_ar_draft`, spec §3.9).
 */
export function useOnDeviceTranslator(from: Language, to: Language, scope?: object) {
  const [state, setState] = useState<TranslatorState | 'checking'>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void translatorState(from, to, scope).then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, [from, to, scope]);

  const translate = useCallback(
    async (text: string): Promise<string> => {
      setBusy(true);
      try {
        const out = await translateOnDevice(text, { from, to, scope, onProgress: (share) => setProgress(share) });
        setState('available');
        return out;
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [from, to, scope],
  );

  return { visible: state !== 'checking' && state !== 'unavailable', busy, progress, translate };
}

export interface TranslateButtonProps {
  /** The text to translate. The button hides itself while it is empty. */
  source: string;
  /** The language `source` is written in, and the one to draft. */
  from: Language;
  to: Language;
  /** Receives the draft. */
  onDraft: (draft: string) => void;
  /** Receives a failure (a cancelled download, a model error), for the screen's own toast. */
  onError?: (error: unknown) => void;
  /** The button's words, from the screen's catalog (e.g. `report.translate_to_arabic`). */
  label: string;
  /** For tests: where to look for the Translator (defaults to the page). */
  scope?: object;
}

export function TranslateButton({ source, from, to, onDraft, onError, label, scope }: TranslateButtonProps) {
  const { visible, busy, progress, translate } = useOnDeviceTranslator(from, to, scope);
  if (!visible || !source.trim()) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<Languages aria-hidden="true" />}
      loading={busy}
      data-progress={progress ?? undefined}
      onClick={() => {
        translate(source).then(onDraft, (e: unknown) => onError?.(e));
      }}
    >
      {label}
    </Button>
  );
}
