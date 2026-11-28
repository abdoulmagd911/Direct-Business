'use client';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { useMaybeMe } from '@/core/auth/me-context';
import { cn } from '@/ui/cn';
import { healthOf } from '../figures';
import { ledgerMayAsk } from '../ledger';
import { financeTab, financeTabHref, tabOfAnchor, type FinanceTab } from '../tabs';
import { useFinanceRead, type Block } from '../use-reads';
import type { PeriodAsk } from '../period';
import type {
  ClosedMonth,
  HealthEntry,
  IncomeByService,
  LedgerFilter,
  NotInvoiced,
  OverviewData,
  PaymentsAsOf,
  Period,
} from '../types';
import { FinanceOverview } from './FinanceOverview';
import { FinanceImportSection } from './FinanceImportSection';
import { FinanceLedgerSection } from './FinanceLedgerSection';

const dataOf = <T,>(b: Block<T>): T | null => (b.status === 'ready' ? b.data : null);

/**
 * The Overview with its reads made here, in the browser, a few at a time (see use-reads.ts): the page and the period
 * tabs appear at once, each block fills as its read answers, and a block that cannot be read is said so in place with
 * a Try again that repeats only that read. The first asked is the first served: the figures, then the months.
 * On a phone the months, the services and the ledger are one view at a time (the 13 Nov phone board); the view not
 * open is only put away, never unmounted, so its read is asked once and switching costs nothing.
 */
export function FinanceOverviewLive({
  ask,
  today,
  full,
  mayType,
  mayImport,
  ledger,
  view,
  tab: tabParam,
}: {
  ask: PeriodAsk;
  today: string;
  full: boolean;
  /** Own or Full on Finance (Landing 56): types an invoice, and changes the entries of the clients that are theirs. */
  mayType: boolean;
  /** Whether this person imports files: the extra finance.import (Landing 40) — a head or an admin by role, or "Allowed". */
  mayImport: boolean;
  /** The ledger's filters, from the address (workstream B); the section below the Overview draws them. */
  ledger: LedgerFilter;
  view: string;
  /** The tab the address asks for (`?tab=`); Overview when it names none. */
  tab?: string;
}) {
  const locale = useLocale();
  const person = useMaybeMe()?.person;
  // the name a Close month receipt carries: the person's full name, in the language on screen when they have one
  const closer = person
    ? locale === 'ar' && person.full_name_ar
      ? person.full_name_ar
      : person.full_name_en
    : undefined;
  // Landing 58: the open tab, from the address (`?tab=`); an anchor that names a section opens that section's tab
  // (…/finance#finance-company opens Ledger) and, once it is drawn, the browser is taken to the section.
  const imports = mayType && mayImport;
  const [tab, setTab] = useState<FinanceTab>(() => financeTab(tabParam, imports));
  useEffect(() => {
    const follow = () => {
      const hash = window.location.hash;
      const named = tabOfAnchor(hash);
      if (!named || (named === 'import' && !imports)) return;
      queueMicrotask(() => {
        setTab(named);
        requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }));
      });
    };
    follow();
    // an anchor followed on this page (a link, or the address changed by hand) opens its tab as well
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [imports]);
  /** A tab is a change of address in place: Back, refresh and a shared link keep it, and nothing is read again. */
  const openTab = (v: FinanceTab) => {
    setTab(v);
    window.history.replaceState(window.history.state, '', financeTabHref(window.location.search, v));
  };
  const away = (v: FinanceTab) => (tab !== v ? 'hidden' : undefined);
  const range = { p_from: ask.from, p_to: ask.to };
  const at = `${ask.from}|${ask.to}`;
  const period = useFinanceRead<Period, 'finance_period'>('finance_period', range, `period|${at}`);
  const asOf = useFinanceRead<PaymentsAsOf, 'finance_payments_as_of'>('finance_payments_as_of', {}, 'as-of');
  // Asked in the order a person looks: tiles, then the two lists beside them, then the heavy ones below (the months and
  // the health line), so the first screenful fills first (13 Oct sweep: the lists sat on a skeleton for 13 s behind them)
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
  const closed = useFinanceRead<ClosedMonth[], 'finance_closed_months'>('finance_closed_months', {}, 'closed');
  const health = useFinanceRead<HealthEntry[], 'finance_health'>('finance_health', range, `health|${at}`);
  const data: OverviewData = {
    period: dataOf(period.block),
    closed: dataOf(closed.block),
    // a list, or nothing: an answer of any other shape is a read that failed, said so with Try again — never figures
    health: healthOf(dataOf(health.block)),
    notInvoiced: dataOf(notInvoiced.block),
    asOf: dataOf(asOf.block),
    service: dataOf(service.block),
  };
  const is = (b: Block<unknown>) => b.status === 'loading';
  return (
    <div className="flex flex-col gap-8">
      <FinanceOverview
        ask={ask}
        today={today}
        full={full}
        mayType={mayType}
        data={data}
        closer={closer}
        tab={tab}
        onTab={openTab}
        mayImport={imports}
        loading={{
          period: is(period.block),
          closed: is(closed.block),
          health: is(health.block),
          notInvoiced: is(notInvoiced.block),
          asOf: is(asOf.block),
          service: is(service.block),
        }}
        refused={{ health: health.block.status === 'failed' && health.block.refused === true }}
        retry={{
          period: period.retry,
          closed: closed.retry,
          health: health.retry,
          notInvoiced: notInvoiced.retry,
          asOf: asOf.retry,
          service: service.retry,
        }}
      />
      {/* the other tabs' sections (Landing 58): each is only put away while its tab is not open, never unmounted */}
      <FinanceLedgerSection
        ask={ask}
        initial={ledger}
        view={view}
        full={full}
        own={mayType && !full}
        ready={ledgerMayAsk(period.block.status)}
        away={away}
      />
      {/* Importing needs Finance at Own or above and the import extra (the import doors refuse anything less), so the
          tab is only there for a person who has both (Landing 56: the extra decides, not the level). */}
      {imports ? (
        <div className={cn('min-w-0', away('import'))} data-finance-tab-panel="import">
          <FinanceImportSection />
        </div>
      ) : null}
    </div>
  );
}
