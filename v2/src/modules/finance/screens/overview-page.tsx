import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { DataState } from '@/ui/DataState';
import { Page } from '@/ui/shell/Page';
import { ledgerFilterFromQuery } from '../ledger';
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
  // FIX-03 F179 (P2): Finance is refused whole to Members and Viewers — no level, no page, figures included.
  if ((me.levels.finance ?? 'none') === 'none')
    return (
      <Page page="finance" title={t('nav.finance')}>
        <DataState
          kind="no-access"
          what={t('nav.finance')}
          message={t('finance.locked')}
          goHome={t('errors.notFound.goMyDay')}
        />
      </Page>
    );
  const today = riyadhDay();
  const ask = periodAsk({ period: one(q.period), from: one(q.from), to: one(q.to) }, today);
  // The ledger's filters ride the same address as the period, so a saved view is a named address (workstream B).
  const ledger = ledgerFilterFromQuery({
    company: one(q.company),
    client: one(q.client),
    kind: one(q.kind),
    code: one(q.code),
  });
  return (
    <Page page="finance" title={t('nav.finance')}>
      <FinanceOverviewLive
        ask={ask}
        today={today}
        full={(me.levels.finance ?? 'none') === 'full'}
        ledger={ledger}
        view={one(q.view) ?? ''}
      />
    </Page>
  );
}
