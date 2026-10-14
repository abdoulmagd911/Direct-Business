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
  wrapItems,
  wrapLabel,
  wrapPayload,
  wrapRecover,
  wrapSummary,
  WRAP_DEFAULT,
  type WrapItem,
  type WrapMove,
  type WrapState,
} from '../logic';
import type { MyDayAnswer } from '../types';

const choiceClass = (on: boolean) =>
  cn(
    'inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus',
    on ? 'border-accent bg-accent-soft text-text' : 'border-border bg-raised text-muted hover:text-text',
  );

const MOVES: { move: WrapMove; word: 'tomorrow' | 'nextWeek' | 'drop' }[] = [
  { move: 'tomorrow', word: 'tomorrow' },
  { move: 'next_week', word: 'nextWeek' },
  { move: 'drop', word: 'drop' },
];

/**
 * Wrap up v2 (productivity stage 1): today's tasks and captures, each Done or Not done. A Not done row has one tap for
 * Tomorrow (already chosen), Next week or Drop; one Save moves the lot through api.wrap_up as one request with one Undo.
 * Nothing is deleted: Drop cancels a task and closes a note.
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
  const [states, setStates] = useState<Record<string, WrapState | undefined>>({});
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
  const stateOf = (id: string) => states[id] ?? WRAP_DEFAULT;
  const set = (id: string, s: Partial<WrapState>) => setStates({ ...states, [id]: { ...stateOf(id), ...s } });
  const tomorrow = formatDate(nextWorkingDay(day), locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const save = async () => {
    if (!items?.length) return;
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
      ['tomorrow', 'partTomorrow'],
      ['next_week', 'partNextWeek'],
      ['drop', 'partDrop'],
      ['done', 'partDone'],
    ] as const
  )
    .filter(([k]) => sum[k] > 0)
    .map(([k, word]) => t(`pages.myDay.wrap.${word}`, { count: sum[k] }))
    .join(', ');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.myDay.wrap.title')}
      description={formatDate(day, locale, { weekday: 'long', day: 'numeric', month: 'short' })}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!items?.length} loading={busy} onClick={() => void save()} data-wrap-save>
            {parts ? t('pages.myDay.wrap.saveWith', { parts }) : t('pages.myDay.wrap.title')}
          </Button>
        </>
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
          <ul className="flex flex-col divide-y divide-border">
            {items.map((i) => {
              const s = stateOf(i.id);
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
                    <span className="shrink-0 text-xs text-muted">{t(`pages.myDay.wrap.${i.kind}`)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={i.title}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={s.done}
                      className={choiceClass(s.done)}
                      onClick={() => set(i.id, { done: true })}
                      data-wrap-state="done"
                    >
                      {t('pages.myDay.wrap.done')}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!s.done}
                      className={choiceClass(!s.done)}
                      onClick={() => set(i.id, { done: false })}
                      data-wrap-state="not_done"
                    >
                      {t('pages.myDay.wrap.notDone')}
                    </button>
                  </div>
                  {!s.done ? (
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.myDay.wrap.notDone')}>
                      {MOVES.map(({ move, word }) => (
                        <button
                          key={move}
                          type="button"
                          role="radio"
                          aria-checked={s.move === move}
                          className={choiceClass(s.move === move)}
                          onClick={() => set(i.id, { move })}
                          data-wrap-move={move}
                        >
                          {t(`pages.myDay.wrap.${word}`)}
                          {move === 'tomorrow' ? (
                            <span className="ms-1.5 font-data text-xs text-muted">{tomorrow}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
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
