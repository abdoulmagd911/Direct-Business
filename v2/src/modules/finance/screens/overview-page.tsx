import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { Page } from '@/ui/shell/Page';
import { periodAsk, riyadhDay } from '../period';
import type { OverviewData } from '../types';
import { FinanceOverview } from './FinanceOverview';

type Q = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/** Reads one part; a part that failed is null and the screen says which one, never a 0 (M27, M53). */
async function part<T>(read: () => Promise<unknown>): Promise<T | null> {
  try {
    return (await read()) as T;
  } catch {
    return null;
  }
}

/**
 * The Finance Overview (P4-5, GC-5, V610–V623): every figure is read from the database's own views over the period in
 * the address — the screen adds nothing up and rounds nothing the database did not. Each part is read on its own, so
 * one failed read costs one block, not the page.
 */
export async function FinanceOverviewPage({ searchParams }: { searchParams: Promise<Q> }) {
  const [q, me, t] = await Promise.all([searchParams, requireMe(), getTranslations()]);
  const today = riyadhDay();
  const ask = periodAsk({ period: one(q.period), from: one(q.from), to: one(q.to) }, today);
  const [period, closed, health, notInvoiced, asOf, service] = await Promise.all([
    part<OverviewData['period']>(() => serverRpc('finance_period', { p_from: ask.from, p_to: ask.to })),
    part<OverviewData['closed']>(() => serverRpc('finance_closed_months', {} as never)),
    part<OverviewData['health']>(() => serverRpc('finance_health', { p_from: ask.from, p_to: ask.to })),
    part<OverviewData['notInvoiced']>(() => serverRpc('finance_not_invoiced', { p_from: ask.from, p_to: ask.to })),
    part<OverviewData['asOf']>(() => serverRpc('finance_payments_as_of', {} as never)),
    part<OverviewData['service']>(() => serverRpc('finance_income_by_service', { p_from: ask.from, p_to: ask.to })),
  ]);
  return (
    <Page page="finance" title={t('nav.finance')}>
      <FinanceOverview
        ask={ask}
        today={today}
        full={(me.levels.finance ?? 'none') === 'full'}
        data={{ period, closed, health, notInvoiced, asOf, service }}
      />
    </Page>
  );
}
