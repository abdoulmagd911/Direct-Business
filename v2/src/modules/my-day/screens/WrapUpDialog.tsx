'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { Dialog } from '@/ui/Dialog';
import {
  nextWorkingDay,
  wrapGroups,
  wrapItems,
  wrapLabel,
  wrapPayload,
  wrapRecover,
  wrapSummary,
  WRAP_CHOICES,
  type WrapChoice,
  type WrapItem,
} from '../logic';
import type { MyDayAnswer } from '../types';
import { tomorrowDayNameOf } from '../when';

const choiceClass = (on: boolean) =>
  cn(
    'inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus',
    on ? 'border-accent bg-accent-soft text-text' : 'border-border bg-raised text-muted hover:text-text',
  );

/**
 * Wrap up v2 (productivity stage 1): today's tasks and captures, grouped by kind, each with three choices — Done,
 * Tomorrow or Drop. Nothing is chosen until the person chooses; a row left alone stays as it is. One Save moves the
 * chosen rows through api.wrap_up as one request with one Undo. Nothing is deleted: Drop cancels a task and closes a note.
 */
export function WrapUpDialog({
  day,
  open,
  onOpenChange,
}: {
  day: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const words = useWords();
  const [items, setItems] = useState<WrapItem[] | null>(null);
  const [states, setStates] = useState<Record<string, WrapChoice | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<WrapItem[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    rpc('my_day', { p_scope: 'me', p_limit: 200 })
      .then((a) => {
        const answer = a as unknown as MyDayAnswer;
        if (live) setItems(wrapItems(answer.tasks ?? [], answer.notes));
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
      setItems(null);
    };
  }, [open]);
  // tapping the chosen word again takes the choice back: the row is left alone
  const choose = (id: string, c: WrapChoice) => setStates({ ...states, [id]: states[id] === c ? undefined : c });
  // on a Thursday, a Friday and a Saturday the next working day is not tomorrow: the choice is called by its day
  const tomorrowName = tomorrowDayNameOf(day, locale);
  const shortDay = (d: string) =>
    formatDate(d, locale, { weekday: 'short', day: 'numeric', month: 'short', year: undefined });
  const tomorrowDate = shortDay(nextWorkingDay(day));
  const save = async () => {
    if (!items?.length || !wrapPayload(items, states).length) return;
    setBusy(true);
    setGone([]);
    const sent = await command(
      words(t('pages.myDay.wrap.saved')),
      () => rpc('wrap_up', { p_items: wrapPayload(items, states) as never }) as Promise<{ request_id?: string | null }>,
      {
        after: () => {
          onOpenChange(false);
          setStates({});
        },
      },
    );
    if (!sent) {
      // refused as a whole (an item changed under the dialog): read the rows again, name what left, keep every other choice
      try {
        const answer = (await rpc('my_day', { p_scope: 'me', p_limit: 200 })) as unknown as MyDayAnswer;
        const fresh = wrapItems(answer.tasks ?? [], answer.notes);
        const back = wrapRecover(items, fresh);
        setGone(back.gone);
        setItems(back.items);
      } catch {
        // the refusal toast has said it; the rows stay as they were
      }
    }
    setBusy(false);
  };
  const sum = wrapSummary(items ?? [], states);
  const parts = (
    [
      ['tomorrow', tomorrowName ? 'partToDay' : 'partTomorrow'],
      ['drop', 'partDrop'],
      ['done', 'partDone'],
    ] as const
  )
    .filter(([k]) => sum[k] > 0)
    .map(([k, word]) => t(`pages.myDay.wrap.${word}`, { count: sum[k], day: tomorrowName ?? '' }))
    .join(', ');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.myDay.wrap.title')}
      description={formatDate(day, locale, { weekday: 'long', day: 'numeric', month: 'short' })}
      closeLabel={t('common.close')}
      footer={
        // QA-570: the save button is drawn only when there is something to save; an empty day shows the message and Close
        items?.length ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {/* V654 (6): a greyed Save says in one line what is missing, beside it and in view on a phone (QA-595) */}
            {!parts ? (
              <p className="w-full text-sm text-muted sm:w-auto sm:flex-1" role="status" data-wrap-why>
                {t('pages.myDay.wrap.chooseOne')}
              </p>
            ) : null}
            <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={busy} disabled={!parts} onClick={() => void save()} data-wrap-save>
              {parts ? t('pages.myDay.wrap.saveWith', { parts }) : t('common.save')}
            </Button>
          </div>
        ) : (
          <Button onClick={() => onOpenChange(false)} data-wrap-close>
            {items === null ? t('common.cancel') : t('common.close')}
          </Button>
        )
      }
    >
      {gone.length ? (
        <p role="alert" className="mb-3 rounded-md border border-border bg-surface p-3 text-sm" data-wrap-gone>
          {t('pages.myDay.wrap.gone', { items: gone.map((i) => `“${wrapLabel(i)}”`).join(', ') })}
        </p>
      ) : null}
      {items === null ? (
        <DataState kind="loading" />
      ) : items.length ? (
        <div className="flex flex-col gap-3" data-wrap-up>
          <h3 className="text-sm font-semibold">{t('pages.myDay.wrap.summary', { count: items.length })}</h3>
          {wrapGroups(items).map((g) => (
            <section
              key={g.word}
              className="flex flex-col"
              data-wrap-group={g.word}
              aria-labelledby={`wrap-group-${g.word}`}
            >
              <h4 id={`wrap-group-${g.word}`} className="text-xs font-semibold uppercase text-muted">
                {t(g.word === 'task' ? 'pages.myDay.wrap.task' : `pages.myDay.quick.kinds.${g.word}`)}
              </h4>
              <ul className="flex flex-col divide-y divide-border">
                {g.items.map((i) => {
                  const chosen = states[i.id];
                  return (
                    <li key={i.id} className="flex flex-col gap-2 py-3" data-wrap-item={i.id} data-wrap-kind={i.kind}>
                      <div className="flex items-baseline gap-2">
                        <Link
                          href={i.route}
                          onClick={() => onOpenChange(false)}
                          className="min-w-0 flex-1 break-words hover:underline"
                          data-wrap-turn
                        >
                          {i.title || t('pages.myDay.note.untitled')}
                        </Link>
                      </div>
                      {/* Tomorrow is the wider column: its day is written under it and stays on one line at 375 px */}
                      <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-2" role="radiogroup" aria-label={i.title}>
                        {WRAP_CHOICES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            role="radio"
                            aria-checked={chosen === c}
                            className={cn(
                              choiceClass(chosen === c),
                              'min-w-0 flex-col justify-center gap-0.5 px-2 text-center',
                            )}
                            onClick={() => choose(i.id, c)}
                            data-wrap-choice={c}
                          >
                            <span>{(c === 'tomorrow' ? tomorrowName : null) ?? t(`pages.myDay.wrap.${c}`)}</span>
                            {c === 'tomorrow' ? (
                              <span
                                className="text-xs font-normal whitespace-nowrap text-muted tabular"
                                data-wrap-lands-on="tomorrow"
                              >
                                {tomorrowDate}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <DataState kind="empty" message={t('pages.myDay.wrap.none')} />
      )}
    </Dialog>
  );
}
