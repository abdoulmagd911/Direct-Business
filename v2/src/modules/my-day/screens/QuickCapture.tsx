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
import { Textarea } from '@/ui/Input';
import {
  CAPTURE_KINDS,
  QUICK_CAPTURE_EVENT,
  quickCaptureArgs,
  type CaptureAbout,
  type CaptureKind,
  type OpenOptions,
} from '../quick-capture';
import { VISIBILITIES, type Visibility } from '../types';
import { instantOf, tomorrow, whenFor, type When, type WhenKey } from '../when';
import { WhenPicker } from './WhenPicker';

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
  const [whenKey, setWhenKey] = useState<WhenKey>('tomorrow');
  const [pick, setPick] = useState<When>({ day: '', time: '09:00' });
  const [about, setAbout] = useState<CaptureAbout | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const show = (e: Event) => {
      const opts = ((e as CustomEvent).detail ?? {}) as OpenOptions;
      const at = new Date();
      setNow(at);
      setAbout(opts.about ?? null);
      setKind(opts.about ? 'reminder' : (opts.kind ?? 'note'));
      setText(opts.text ?? '');
      setVisibility('private');
      setWhenKey('tomorrow');
      setPick(tomorrow(at));
      setOpen(true);
    };
    window.addEventListener(QUICK_CAPTURE_EVENT, show);
    return () => window.removeEventListener(QUICK_CAPTURE_EVENT, show);
  }, []);

  // A Reminder is told at its time; a Follow up is the same Reminder, private and tied to its record (#238)
  const chosen = whenFor(whenKey, now, pick);
  // A neutral title, never the record's name: the note can be shared and the record shows only through `about`, which is
  // filtered per reader (QA-560).
  const words_ = about && !text.trim() ? t('pages.myDay.quick.followUpTitle') : text;
  const args = quickCaptureArgs(kind, words_, {
    visibility: about ? 'private' : visibility,
    day: today(),
    remindAt: chosen ? instantOf(chosen) : undefined,
    about: about ? { entity: about.entity, id: about.id } : undefined,
  });
  const save = async () => {
    if (!args) return;
    setBusy(true);
    await command(
      words(
        about
          ? t('pages.myDay.quick.followUpSaved')
          : t('pages.myDay.quick.saved', { kind: t(`pages.myDay.quick.kinds.${kind}`) }),
      ),
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
            <RD.Title className="text-lg font-semibold">
              {about ? t('pages.myDay.quick.followUp') : t('pages.myDay.quick.title')}
            </RD.Title>
            <RD.Close asChild>
              <IconButton label={t('common.close')} icon={<X />} />
            </RD.Close>
          </div>
          {about ? (
            <p
              className="min-w-0 break-words rounded-md border border-border bg-surface px-3 py-2 text-sm"
              data-quick-about
            >
              <span className="text-muted">{t('pages.myDay.quick.followUpFor')} </span>
              <span className="font-medium">{about.label}</span>
            </p>
          ) : (
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
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={about ? 2 : kind === 'checklist' ? 5 : 3}
            placeholder={
              about ? t('pages.myDay.quick.followUpPlaceholder') : t(`pages.myDay.quick.placeholder.${kind}`)
            }
            aria-label={t('pages.myDay.quick.text')}
            autoFocus
            data-quick-text
          />
          {kind === 'reminder' ? (
            <WhenPicker value={whenKey} onChange={setWhenKey} pick={pick} onPick={setPick} now={now} />
          ) : null}
          {about ? null : (
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
          )}
          <Button variant="primary" disabled={!args} loading={busy} onClick={() => void save()} data-quick-save>
            {about ? t('pages.myDay.quick.followUp') : t('pages.myDay.quick.save')}
          </Button>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
