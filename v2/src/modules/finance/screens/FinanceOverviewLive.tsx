'use client';
import { useFinanceRead, type Block } from '../use-reads';
import type { PeriodAsk } from '../period';
import type {
  ClosedMonth,
  HealthEntry,
  IncomeByService,
  NotInvoiced,
  OverviewData,
  PaymentsAsOf,
  Period,
} from '../types';
import { FinanceOverview } from './FinanceOverview';

const dataOf = <T,>(b: Block<T>): T | null => (b.status === 'ready' ? b.data : null);

/**
 * The Overview with its reads made here, in the browser, a few at a time (see use-reads.ts): the page and the period
 * tabs appear at once, each block fills as its read answers, and a block that cannot be read is said so in place with
 * a Try again that repeats only that read. The first asked is the first served: the figures, then the months.
 */
export function FinanceOverviewLive({ ask, today, full }: { ask: PeriodAsk; today: string; full: boolean }) {
  const range = { p_from: ask.from, p_to: ask.to };
  const at = `${ask.from}|${ask.to}`;
  const period = useFinanceRead<Period, 'finance_period'>('finance_period', range, `period|${at}`);
  const asOf = useFinanceRead<PaymentsAsOf, 'finance_payments_as_of'>('finance_payments_as_of', {}, 'as-of');
  const closed = useFinanceRead<ClosedMonth[], 'finance_closed_months'>('finance_closed_months', {}, 'closed');
  const health = useFinanceRead<HealthEntry[], 'finance_health'>('finance_health', range, `health|${at}`);
  const notInvoiced = useFinanceRead<NotInvoiced, 'finance_not_invoiced'>(
    'finance_not_invoiced',
    range,
    `not-invoiced|${at}`,
  );
  const service = useFinanceRead<IncomeByService, 'finance_income_by_service'>(
    'finance_income_by_service',
    range,
    `service|${at}`,
  );
  const data: OverviewData = {
    period: dataOf(period.block),
    closed: dataOf(closed.block),
    health: dataOf(health.block),
    notInvoiced: dataOf(notInvoiced.block),
    asOf: dataOf(asOf.block),
    service: dataOf(service.block),
  };
  const is = (b: Block<unknown>) => b.status === 'loading';
  return (
    <FinanceOverview
      ask={ask}
      today={today}
      full={full}
      data={data}
      loading={{
        period: is(period.block),
        closed: is(closed.block),
        health: is(health.block),
        notInvoiced: is(notInvoiced.block),
        asOf: is(asOf.block),
        service: is(service.block),
      }}
      retry={{
        period: period.retry,
        closed: closed.retry,
        health: health.retry,
        notInvoiced: notInvoiced.retry,
        asOf: asOf.retry,
        service: service.retry,
      }}
    />
  );
}
