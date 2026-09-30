'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { command } from '@/core/commands/command';
import { formatDate } from '@/core/i18n/format';
import { useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import { door } from '../doors';
import { nextWorkingDay, noteRoute, noteTitle, openCaptures, wrapUpChoices } from '../logic';
import type { MyNote, WrapChoice } from '../types';
import { KIND_ICON } from './NoteBits';

const choiceClass = (on: boolean) =>
  cn(
    'inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus',
    on ? 'border-accent bg-accent-soft text-text' : 'border-border bg-raised text-muted hover:text-text',
  );

/**
 * Wrap up today (V433): the day's open captures, each carried over to the next working day (the default — Sunday after
 * a Thursday, keeping the day it happened) or done; Turn into opens the note. One request for the lot; nothing is deleted.
 */
export function WrapUpDialog({
  notes,
  day,
  open,
  onOpenChange,
}: {
  notes: MyNote[];
  day: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const open_ = openCaptures(notes, day);
  const [choices, setChoices] = useState<Record<string, WrapChoice | undefined>>({});
  const [busy, setBusy] = useState(false);
  const choiceOf = (id: string): WrapChoice => choices[id] ?? 'carry';
  const next = formatDate(nextWorkingDay(day), locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const save = async () => {
    setBusy(true);
    const all = Object.fromEntries(open_.map((n) => [n.id, choiceOf(n.id)]));
    await command(
      words(t('pages.myDay.wrap.saved')),
      () => door('note_wrap_up', { p_day: day, p_choices: wrapUpChoices(all) }),
      {
        after: () => {
          onOpenChange(false);
          setChoices({});
        },
      },
    );
    setBusy(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.myDay.wrap.title')}
      description={formatDate(day, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!open_.length} loading={busy} onClick={() => void save()} data-wrap-save>
            {t('pages.myDay.wrap.save')}
          </Button>
        </>
      }
    >
      {open_.length ? (
        <div className="flex flex-col gap-3" data-wrap-up>
          <h3 className="text-sm font-semibold">{t('pages.myDay.wrap.open', { count: open_.length })}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {open_.map((n) => {
              const Icon = KIND_ICON[n.kind];
              const c = choiceOf(n.id);
              return (
                <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3" data-wrap-note={n.id}>
                  <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-[1_1_12rem] truncate">
                    {noteTitle(n) || t('pages.myDay.note.untitled')}
                  </span>
                  <span className="flex flex-wrap gap-2" role="radiogroup" aria-label={noteTitle(n)}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={c === 'carry'}
                      className={choiceClass(c === 'carry')}
                      onClick={() => setChoices({ ...choices, [n.id]: 'carry' })}
                      data-wrap-choice="carry"
                    >
                      {t('pages.myDay.wrap.carry', { date: next })}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={c === 'done'}
                      className={choiceClass(c === 'done')}
                      onClick={() => setChoices({ ...choices, [n.id]: 'done' })}
                      data-wrap-choice="done"
                    >
                      {t('pages.myDay.wrap.done')}
                    </button>
                    <Link
                      href={noteRoute(n.id)}
                      onClick={() => onOpenChange(false)}
                      className={choiceClass(false)}
                      data-wrap-turn
                    >
                      {t('pages.myDay.wrap.turn')}
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <DataState kind="empty" message={t('pages.myDay.wrap.none')} />
      )}
    </Dialog>
  );
}
