'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
  type CaptureKind,
} from '../quick-capture';
import { VISIBILITIES, type Visibility } from '../types';
import { MORNING, TIME_CHIPS, WHEN_CHOICES, resolveWhen, whenLine, whenOptions, type WhenChoice } from '../when';

const pill = (on: boolean) =>
  cn(
    'inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus',
    on ? 'border-accent bg-accent-soft text-text' : 'border-border bg-raised text-muted hover:text-text',
  );

/**
 * Quick capture (productivity stage 1): one sheet, from any page — the Create menu, the phone + and Ctrl K open it. A
 * bottom sheet on a phone, a card on a wide screen. Note, Idea, Checklist or Reminder; a Reminder asks "When" with
 * chips (Stage 2): Later today · Tomorrow · Next week · Pick a day, Tomorrow chosen, and one line saying the result in
 * Riyadh time (D20). Only me is the default (V454). One tap files it and leaves the person exactly where they were.
 */
export function QuickCapture() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CaptureKind>('note');
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [opts, setOpts] = useState(() => whenOptions(new Date()));
  const [choice, setChoice] = useState<WhenChoice>('tomorrow');
  const [pick, setPick] = useState({ day: '', time: MORNING });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const show = () => {
      setKind('note');
      setText('');
      setVisibility('private');
      setOpts(whenOptions(new Date()));
      setChoice('tomorrow');
      setOpen(true);
    };
    window.addEventListener(QUICK_CAPTURE_EVENT, show);
    return () => window.removeEventListener(QUICK_CAPTURE_EVENT, show);
  }, []);

  const when = resolveWhen(choice, opts, pick);
  // "Pick a day" starts from what was chosen, so the line under the chips does not jump
  const choose = (c: WhenChoice) => {
    if (c === 'pick') {
      const [day = '', time = MORNING] = when.split('T');
      setPick({ day, time });
    }
    setChoice(c);
  };
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
            <fieldset className="flex flex-col gap-2" data-quick-when>
              <legend className="mb-1.5 text-sm font-medium">{t('pages.myDay.quick.when')}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.myDay.quick.when')}>
                {WHEN_CHOICES.filter((c) => c !== 'later' || opts.later).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={choice === c}
                    className={pill(choice === c)}
                    onClick={() => choose(c)}
                    data-quick-when-choice={c}
                  >
                    {t(`pages.myDay.quick.whenChoices.${c}`)}
                  </button>
                ))}
              </div>
              {choice === 'pick' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {t('pages.myDay.quick.day')}
                      <Input
                        type="date"
                        value={pick.day}
                        min={opts.day}
                        onChange={(e) => setPick({ ...pick, day: e.target.value })}
                        data-quick-day
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {t('pages.myDay.quick.time')}
                      <Input
                        type="time"
                        value={pick.time}
                        onChange={(e) => setPick({ ...pick, time: e.target.value })}
                        data-quick-time
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.myDay.quick.time')}>
                    {TIME_CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={pick.time === c}
                        className={cn(pill(pick.time === c), 'font-data')}
                        onClick={() => setPick({ ...pick, time: c })}
                        data-quick-time-chip={c}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="font-data text-sm text-muted" aria-live="polite" data-quick-when-line>
                {whenLine(when, locale)}
              </p>
            </fieldset>
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
