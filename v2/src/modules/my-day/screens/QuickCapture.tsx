'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { useWords, today } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { IconButton } from '@/ui/IconButton';
import { Input, Textarea } from '@/ui/Input';
import {
  CAPTURE_KINDS,
  QUICK_CAPTURE_EVENT,
  quickCaptureArgs,
  riyadhInstant,
  tomorrowMorning,
  type CaptureKind,
} from '../quick-capture';
import { VISIBILITIES, type Visibility } from '../types';

const pill = (on: boolean) =>
  cn(
    'inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus',
    on ? 'border-accent bg-accent-soft text-text' : 'border-border bg-raised text-muted hover:text-text',
  );

/**
 * Quick capture (productivity stage 1): one sheet, from any page — the Create menu, the phone + and Ctrl K open it. A
 * bottom sheet on a phone, a card on a wide screen. Note, Idea, Checklist or Reminder (a Reminder asks "when");
 * Only me is the default (V454). One tap files it and leaves the person exactly where they were.
 */
export function QuickCapture() {
  const t = useTranslations();
  const words = useWords();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CaptureKind>('note');
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const show = () => {
      setKind('note');
      setText('');
      setVisibility('private');
      setWhen(tomorrowMorning(today()));
      setOpen(true);
    };
    window.addEventListener(QUICK_CAPTURE_EVENT, show);
    return () => window.removeEventListener(QUICK_CAPTURE_EVENT, show);
  }, []);

  const args = quickCaptureArgs(kind, text, { visibility, day: today(), remindAt: riyadhInstant(when) });
  const save = async () => {
    if (!args) return;
    setBusy(true);
    await command(
      words(t('pages.myDay.quick.saved', { kind: t(`pages.myDay.quick.kinds.${kind}`) })),
      () =>
        rpc('note_capture', { p_kind: args.kind, p_values: args.values as never }) as Promise<{
          request_id?: string | null;
        }>,
      { after: () => setOpen(false) },
    );
    setBusy(false);
  };

  return (
    <RD.Root open={open} onOpenChange={setOpen}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RD.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-[560px] flex-col gap-3 overflow-y-auto rounded-t-lg border border-border bg-raised p-4 text-text shadow-2 focus:outline-none sm:bottom-auto sm:top-[12vh] sm:rounded-lg"
          data-quick-capture
        >
          <div className="flex items-center justify-between gap-3">
            <RD.Title className="text-lg font-semibold">{t('pages.myDay.quick.title')}</RD.Title>
            <RD.Close asChild>
              <IconButton label={t('common.close')} icon={<X />} />
            </RD.Close>
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.myDay.quick.kind')}>
            {CAPTURE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                className={pill(kind === k)}
                onClick={() => setKind(k)}
                data-quick-kind={k}
              >
                {t(`pages.myDay.quick.kinds.${k}`)}
              </button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={kind === 'checklist' ? 5 : 3}
            placeholder={t(`pages.myDay.quick.placeholder.${kind}`)}
            aria-label={t('pages.myDay.quick.text')}
            autoFocus
            data-quick-text
          />
          {kind === 'reminder' ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t('pages.myDay.quick.when')}
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} data-quick-when />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.myDay.visibility.label')}>
            {VISIBILITIES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={visibility === v}
                className={pill(visibility === v)}
                onClick={() => setVisibility(v)}
                data-quick-visibility={v}
              >
                {t(`pages.myDay.visibility.${v}`)}
              </button>
            ))}
          </div>
          <Button variant="primary" disabled={!args} loading={busy} onClick={() => void save()} data-quick-save>
            {t('pages.myDay.quick.save')}
          </Button>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
