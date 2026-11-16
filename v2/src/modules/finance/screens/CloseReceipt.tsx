'use client';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatMoney } from '@/core/i18n/format';
import { Button } from '@/ui/Button';

/** What Close month just did, as the page knew it at that moment: nothing here is worked out or asked for again. */
export type Closed = {
  /** The month's first day, `YYYY-MM-01`. */
  month: string;
  /** The month's own name ("October 2026"), as its row says it. */
  monthLabel: string;
  /** Who pressed Close month — the person signed in; left out when the page was not told. */
  by?: string;
  /** The Riyadh day it was closed on, `YYYY-MM-DD`. */
  on: string;
  /** How many rows the close kept, as the database answered; null when it did not say. */
  units: number | null;
  /** The month's figures as its row showed them when it was closed; null when the month had no row at all. */
  figures: { revenue: number; cost: number; profit: number } | null;
};

/**
 * After Close month (not drawn on the boards; built in the same look): a panel that says what was closed, by whom,
 * when, and the month's totals as they were kept — and ONE button, which puts the panel away. Closing has no Undo
 * (V620), so there is nothing else to offer here. A month with no row keeps its dashes, never a 0.
 */
export function CloseReceipt({ closed, onDone }: { closed: Closed; onDone: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const none = t('finance.months.none');
  const money = (n: number | undefined) =>
    closed.figures && n !== undefined ? `${formatMoney(n, locale)} ${t('finance.sar')}` : none;
  const facts: [string, string, string][] = [
    ...(closed.by ? [['by', t('finance.close.receipt.by'), closed.by] as [string, string, string]] : []),
    ['on', t('finance.close.receipt.on'), formatDate(`${closed.on}T12:00:00Z`, locale)],
    ['rows', t('finance.ledger.units'), closed.units === null ? none : String(closed.units)],
    ['revenue', t('finance.months.revenue'), money(closed.figures?.revenue)],
    ['cost', t('finance.months.cost'), money(closed.figures?.cost)],
    ['profit', t('finance.months.profit'), money(closed.figures?.profit)],
  ];
  return (
    <div
      role="status"
      className="mx-4 mb-4 flex flex-col gap-4 rounded-lg border border-success/30 bg-success-soft p-4 sm:mx-5 sm:p-5"
      data-finance-close-receipt={closed.month}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-grid size-10 shrink-0 place-items-center rounded-pill bg-raised text-success"
        >
          <Check className="size-5" />
        </span>
        <h3 className="min-w-0 break-words font-display text-xl font-semibold leading-7 text-strong">
          {t('finance.close.done', { month: closed.monthLabel })}
        </h3>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @min-[560px]:grid-cols-3">
        {facts.map(([key, label, value]) => (
          <div key={key} className="flex min-w-0 flex-col gap-0.5" data-receipt={key}>
            <dt className="text-xs leading-4 text-muted">{label}</dt>
            <dd
              className={
                key === 'by' || key === 'on'
                  ? 'break-words text-base font-medium text-strong'
                  : 'font-data text-base font-semibold text-strong tabular'
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <Button variant="primary" onClick={onDone} data-receipt-done>
          {t('finance.close.receipt.done')}
        </Button>
      </div>
    </div>
  );
}
