'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { answerConflict, useConflictAsk, type ConflictChoice } from '@/core/commands/conflict-store';
import { formatDate } from '@/core/i18n/format';
import { Button } from './Button';
import { Dialog } from './Dialog';

/**
 * The conflict dialog (FLOW-08, TECH-SPEC §2.4): two people changed the same field. Names who changed it and when,
 * shows their value and mine per field, and the person chooses each; Save runs the command again with the choice.
 * Rendered once by the shell; `command()` opens it through the conflict store.
 */
export function ConflictDialog() {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const ask = useConflictAsk();
  const [choice, setChoice] = useState<ConflictChoice>({});
  const [askedFor, setAskedFor] = useState<object | null>(null);
  if (ask !== askedFor) {
    // A new question starts with nothing chosen: the person decides every conflicting field (V128).
    setAskedFor(ask);
    setChoice({});
  }
  const complete = !!ask && ask.rows.every((r) => choice[r.key]);
  const when = ask?.at ? formatDate(new Date(ask.at), locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return (
    <Dialog
      open={ask !== null}
      onOpenChange={(o) => !o && answerConflict(null)}
      title={ask?.by ? t('conflict.titleBy', { name: ask.by }) : t('conflict.title')}
      description={t('conflict.description')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={() => answerConflict(null)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!complete} onClick={() => answerConflict(choice)} data-conflict-save>
            {t('conflict.save')}
          </Button>
        </>
      }
    >
      {ask ? (
        <div className="flex flex-col gap-4" data-conflict-dialog>
          {when ? (
            <p className="text-sm text-muted" data-conflict-when>
              {t('conflict.when', { time: when })}
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {ask.rows.map((r) => (
              <li key={r.key} className="rounded-md border border-border p-3" data-conflict-field={r.key}>
                <p className="mb-2 text-sm font-semibold">{r.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(['theirs', 'mine'] as const).map((side) => (
                    <label
                      key={side}
                      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 text-sm has-[:checked]:border-border-strong has-[:checked]:bg-accent-soft"
                    >
                      <input
                        type="radio"
                        name={`conflict-${r.key}`}
                        value={side}
                        checked={choice[r.key] === side}
                        onChange={() => setChoice({ ...choice, [r.key]: side })}
                        className="mt-0.5 accent-[var(--primary)]"
                        data-conflict-pick={side}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-xs font-semibold uppercase tracking-[.07em] text-muted">
                          {side === 'theirs'
                            ? ask.by
                              ? t('conflict.theirsBy', { name: ask.by })
                              : t('conflict.theirs')
                            : t('conflict.mine')}
                        </span>
                        <span className="break-words font-medium">{side === 'theirs' ? r.theirs : r.mine}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Dialog>
  );
}
