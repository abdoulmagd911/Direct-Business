'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { refetchAll } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { Select } from '@/ui/Select';
import { toast } from '@/ui/Toast';
import { LEDGER_KINDS, ledgerFilterQuery, ledgerReadArgs } from '../ledger';
import { myClientsOf, NO_CLIENTS, type MyClients } from '../own-clients';
import type { PeriodAsk } from '../period';
import type { DealType } from '../deal-type';
import type { LedgerCompany, LedgerFilter, LedgerRow } from '../types';
import { financeWrote, useFinanceRead } from '../use-reads';
import type { FinanceTab } from '../tabs';
import { cn } from '@/ui/cn';
import { CountedTable } from './CountedTable';
import { FinanceAchievements } from './FinanceAchievements';
import { FinanceAgeing, FinanceHeld, FinanceReconciliation } from './FinanceChecks';
import { FinanceReport, type LedgerToggle } from './FinanceReport';
import { FinanceCard } from './parts';
import { ledgerReportOf } from './ledger-report';

type Locale = 'en' | 'ar';

/** "All partners" / "All types" as a value of its own: an empty value is the select's blank, so the box read nothing. */
const ALL = '__all';

/**
 * The Finance page's ledger section (workstream B): the filters (company, client ID, invoice type, code)
 * beside the period the page already has, the saved views over them, and the report itself. The address
 * carries the filters, so a saved view is just a named address and the Codes page can link here with `code`
 * already set. The Project filter was removed whole (F175, FIX-32).
 */
export function FinanceLedgerSection({
  ask,
  initial,
  view,
  full,
  own = false,
  ready,
  away = () => undefined,
}: {
  ask: PeriodAsk;
  initial: LedgerFilter;
  /** The open saved view's id, from the address — '' for the plain filtered view. */
  view: string;
  full: boolean;
  /** Own on Finance (Landing 56): the person changes the entries of their own clients — asked once, below. */
  own?: boolean;
  /** False holds the ledger read until the tiles are asked first (the read-order rule). */
  ready: boolean;
  /** Landing 58: the class that puts a tab's sections away while that tab is not open (none: every section shows). */
  away?: (tab: FinanceTab) => string | undefined;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [partner, setPartner] = useState(initial.partner ?? '');
  const [clientId, setClientId] = useState(initial.clientId ?? '');
  const [kind, setKind] = useState(initial.kind ?? '');
  const [code, setCode] = useState(initial.code ?? '');
  // The boxes follow the address (F171): opening a saved view changes `initial`, and the boxes must show the
  // view's filters, not the ones typed before it. Same render-phase sync as the task list (FIX-34 R2a).
  // No project box: the ledger's Project filter was removed whole (F175, FIX-32) — the draft, the open view
  // and Clear never carry it again.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setPartner(initial.partner ?? '');
    setClientId(initial.clientId ?? '');
    setKind(initial.kind ?? '');
    setCode(initial.code ?? '');
  }
  // The open view, lit the moment it is pressed (F172): the pill must not wait for the server round-trip.
  // It follows the address too, so Back and refresh keep it.
  const [currentView, setCurrentView] = useState(view || 'all');
  const [seenView, setSeenView] = useState(view || 'all');
  if ((view || 'all') !== seenView) {
    setSeenView(view || 'all');
    setCurrentView(view || 'all');
  }

  const draft: LedgerFilter = {
    ...(partner ? { partner } : {}),
    ...(clientId ? { clientId } : {}),
    ...(kind ? { kind: kind as LedgerFilter['kind'] } : {}),
    ...(code ? { code } : {}),
  };
  // Apply, Clear and All keep the period the person chose: MTD/QTD/YTD go by name (two dates in the address are a
  // custom period — F171 — so writing them turned "Year to date" into "Custom" and froze its end at today).
  const go = (f: LedgerFilter, v = '') => {
    const q = new URLSearchParams({
      period: ask.key,
      ...(ask.key === 'custom' ? { from: ask.from, to: ask.to } : {}),
      ...ledgerFilterQuery(f),
    });
    if (v) q.set('view', v);
    router.push(`/finance?${q.toString()}`);
  };
  const openView = (v: { key: string; query?: Record<string, unknown> }) => {
    // Light the pill at once (F172), before the server round-trip lands.
    setCurrentView(v.key);
    if (!v.query) return go({}, v.key === 'all' ? '' : v.key);
    const q = v.query;
    const f: LedgerFilter = {
      ...(typeof q.company === 'string' && q.company ? { partner: q.company } : {}),
      ...(typeof q.client === 'string' && q.client ? { clientId: q.client } : {}),
      ...(typeof q.kind === 'string' && q.kind ? { kind: q.kind as LedgerFilter['kind'] } : {}),
      ...(typeof q.code === 'string' && q.code ? { code: q.code } : {}),
    };
    const period = typeof q.period === 'string' ? q.period : ask.key;
    const from = typeof q.from === 'string' ? q.from : ask.from;
    const to = typeof q.to === 'string' ? q.to : ask.to;
    const params = new URLSearchParams({ period, from, to, ...ledgerFilterQuery(f), view: v.key });
    router.push(`/finance?${params.toString()}`);
  };

  const args = ledgerReadArgs(initial, ask.from, ask.to);
  const key = JSON.stringify(args);
  const read = useFinanceRead<unknown, 'finance_unified_ledger'>(
    'finance_unified_ledger',
    args,
    `ledger|${key}`,
    ready,
  );
  // the database's own names, read once into the report's (see ledger-report.ts)
  const answer = read.block.status === 'ready' ? read.block.data : null;
  const report = useMemo(() => (answer ? ledgerReportOf(answer) : null), [answer]);
  // Exclude / Include one row (admins — the database refuses anyone else): the row's own number and the organisation
  // it is RECORDED under (never the one it counts under after a merge). A refusal is thrown to the reason box, which
  // says it in words and stays open; a success says so and every Finance read asks again (see use-reads.ts).
  const onToggle = async (kind: LedgerToggle, row: LedgerRow, reason: string) => {
    if (!row.number || !row.source_partner_id) return;
    await rpc(kind === 'exclude' ? 'finance_row_exclude' : 'finance_row_include', {
      p_partner: row.source_partner_id,
      p_number: row.number,
      p_reason: reason,
    });
    toast.done(
      t(kind === 'exclude' ? 'finance.ledger.excludedDone' : 'finance.ledger.includedDone', { number: row.number }),
    );
    financeWrote();
    refetchAll();
  };
  // Landing 56: at Own, which clients are theirs — asked once, after the ledger; Full needs no asking
  const mineRead = useFinanceRead<unknown, 'finance_my_clients'>('finance_my_clients', {}, 'my-clients', ready && own);
  const mine: MyClients = full
    ? { all: true, partners: [] }
    : own && mineRead.block.status === 'ready'
      ? myClientsOf(mineRead.block.data)
      : NO_CLIENTS;
  // Landing 47 (A5): set one row's deal type — the row's own number at the organisation it is RECORDED under (none for
  // a row recorded here that matches no organisation). Full on Finance; the database refuses anyone else, in words.
  const onSetDealType = async (row: LedgerRow, type: DealType | null, reason: string) => {
    if (!row.number) return;
    await rpc('finance_deal_type_set', {
      p_partner: (row.source_partner_id ?? null) as never,
      p_number: row.number,
      p_type: type as never,
      p_reason: reason,
    });
    toast.done(t('finance.ledger.deal.setDone', { number: row.number }));
    financeWrote();
    refetchAll();
  };
  const companyName = (c: { partner_id: string | null; trade_name_en: string | null; trade_name_ar: string | null }) =>
    locale === 'ar' && c.trade_name_ar ? c.trade_name_ar : (c.trade_name_en ?? '');
  // The partners the box offers stay while the next view loads, so a picked partner never goes blank meanwhile.
  const [companies, setCompanies] = useState<LedgerCompany[]>([]);
  if (report && report.companies !== companies) setCompanies(report.companies);
  const companyOptions = [
    { value: ALL, label: t('finance.ledger.allCompanies') },
    ...companies
      .filter((c) => c.partner_id)
      .map((c) => ({
        value: c.partner_id as string,
        label: `${companyName(c)}${c.partner_number ? ` (${c.partner_number})` : ''}`,
      })),
  ];

  const panel = (tab: FinanceTab) => cn('flex min-w-0 flex-col gap-8', away(tab));
  return (
    <>
      <div className={panel('ledger')} data-finance-tab-panel="ledger">
        <FinanceCard
          id="finance-ledger"
          title={t('finance.ledger.title')}
          source={t('finance.unified')}
          data-finance-ledger-section
        >
          <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5">
            <SavedViewsBar
              page="finance"
              fixed={[{ key: 'all', label: t('common.all') }]}
              current={currentView}
              query={{ period: ask.key, from: ask.from, to: ask.to, ...ledgerFilterQuery(draft) }}
              onOpen={openView}
              canShare={full}
              onDefault={(v) => openView(v)}
              saveHint={t('finance.ledger.saveHint')}
            />
            <form
              className="grid items-end gap-3 @min-[520px]:grid-cols-2 @min-[1000px]:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
              data-finance-ledger-filters
              onSubmit={(e) => {
                e.preventDefault();
                go(draft);
              }}
            >
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-strong">
                {t('finance.ledger.partner')}
                <Select
                  value={partner || ALL}
                  onValueChange={(v) => setPartner(v === ALL ? '' : v)}
                  options={companyOptions}
                  aria-label={t('finance.ledger.partner')}
                  data-finance-filter-company
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-strong">
                {t('finance.ledger.clientId')}
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  aria-label={t('finance.ledger.clientId')}
                  data-finance-filter-client
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-strong">
                {t('finance.ledger.kind')}
                <Select
                  value={kind || ALL}
                  onValueChange={(v) => setKind(v === ALL ? '' : v)}
                  options={[
                    { value: ALL, label: t('finance.ledger.allKinds') },
                    ...LEDGER_KINDS.map((k) => ({ value: k, label: t(`finance.kind.${k}`) })),
                  ]}
                  aria-label={t('finance.ledger.kind')}
                  data-finance-filter-kind
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-strong">
                {t('finance.ledger.code')}
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-label={t('finance.ledger.code')}
                  data-finance-filter-code
                />
              </label>
              <div className="flex flex-wrap gap-2 @min-[520px]:col-span-2 @min-[1000px]:col-span-1">
                <Button type="submit" variant="primary" data-finance-filter-apply>
                  {t('finance.ledger.apply')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPartner('');
                    setClientId('');
                    setKind('');
                    setCode('');
                    go({});
                  }}
                  data-finance-filter-clear
                >
                  {t('finance.ledger.clear')}
                </Button>
              </div>
            </form>
          </div>
          <FinanceReport
            report={report}
            loading={read.block.status === 'loading'}
            failed={read.block.status === 'failed'}
            onRetry={read.retry}
            onToggle={onToggle}
            onSetDealType={onSetDealType}
            mine={mine}
          />
        </FinanceCard>
        {/* "Is it counted?" for the same period as the ledger above; it waits its turn like the ledger does */}
        <CountedTable from={ask.from} to={ask.to} ready={ready} />
      </div>
      {/* Landing 47: what is owed and how old (A6) — the Owed tab (Landing 58) */}
      <div className={panel('owed')} data-finance-tab-panel="owed">
        <FinanceAgeing ready={ready} />
      </div>
      {/* Landing 47: does Finance agree with itself (A10), what is held to tie (A11) — the Checks tab (Landing 58);
          each is a read of its own beside the money, waits its turn like the ledger and asks again on its own */}
      <div className={panel('checks')} data-finance-tab-panel="checks">
        <FinanceReconciliation from={ask.from} to={ask.to} ready={ready} />
        <FinanceHeld from={ask.from} to={ask.to} ready={ready} />
      </div>
      {/* the period's achievements, apart from the money (Landing 41): a list with no amount, in no total — under
          Overview, after the months and income by service (Landing 58) */}
      <div className={panel('overview')} data-finance-tab-panel="achievements">
        <FinanceAchievements from={ask.from} to={ask.to} ready={ready} />
      </div>
    </>
  );
}
