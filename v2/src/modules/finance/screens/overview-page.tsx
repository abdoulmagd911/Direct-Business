import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { Page } from '@/ui/shell/Page';
import { periodAsk, riyadhDay } from '../period';
import { FinanceOverviewLive } from './FinanceOverviewLive';

type Q = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/**
 * The Finance Overview (P4-5, GC-5, V610–V623): the page knows who is asking and for which period; every figure is read
 * from the database's own views by the screen itself, a few reads at a time, each block on its own (see use-reads.ts),
 * so one slow or failed read costs one block and the period tabs answer at once.
 */
export async function FinanceOverviewPage({ searchParams }: { searchParams: Promise<Q> }) {
  const [q, me, t] = await Promise.all([searchParams, requireMe(), getTranslations()]);
  const today = riyadhDay();
  const ask = periodAsk({ period: one(q.period), from: one(q.from), to: one(q.to) }, today);
  return (
    <Page page="finance" title={t('nav.finance')}>
      <FinanceOverviewLive ask={ask} today={today} full={(me.levels.finance ?? 'none') === 'full'} />
    </Page>
  );
}
