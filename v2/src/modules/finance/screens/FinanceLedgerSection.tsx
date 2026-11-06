'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { SavedViewsBar } from '@/ui/SavedViewsBar';
import { Select } from '@/ui/Select';
import { LEDGER_KINDS, ledgerFilterQuery, ledgerReadArgs } from '../ledger';
import type { PeriodAsk } from '../period';
import type { LedgerFilter, LedgerReport } from '../types';
import { useFinanceRead } from '../use-reads';
import { FinanceReport } from './FinanceReport';

type Locale = 'en' | 'ar';

/**
 * The Finance page's ledger section (workstream B): the filters (company, client ID, invoice type, code,
 * project) beside the period the page already has, the saved views over them, and the report itself. The
 * address carries the filters, so a saved view is just a named address and the Codes page can link here with
 * `code` already set. The project box is kept for when its link lands (see finance.ledger) and says so.
 */
export function FinanceLedgerSection({
  ask,
  initial,
  view,
  full,
  ready,
}: {
  ask: PeriodAsk;
  initial: LedgerFilter;
  /** The open saved view's id, from the address — '' for the plain filtered view. */
  view: string;
  full: boolean;
  /** False holds the ledger read until the tiles are asked first (the read-order rule). */
  ready: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [partner, setPartner] = useState(initial.partner ?? '');
  const [clientId, setClientId] = useState(initial.clientId ?? '');
  const [kind, setKind] = useState(initial.kind ?? '');
  const [code, setCode] = useState(initial.code ?? '');
  const [project, setProject] = useState(initial.project ?? '');

  const draft: LedgerFilter = {
    ...(partner ? { partner } : {}),
    ...(clientId ? { clientId } : {}),
    ...(kind ? { kind: kind as LedgerFilter['kind'] } : {}),
    ...(code ? { code } : {}),
    ...(project ? { project } : {}),
  };
  const go = (f: LedgerFilter, v = '') => {
    const q = new URLSearchParams({ period: ask.key, from: ask.from, to: ask.to, ...ledgerFilterQuery(f) });
    if (v) q.set('view', v);
    router.push(`/finance?${q.toString()}`);
  };
  const openView = (v: { key: string; query?: Record<string, unknown> }) => {
    if (!v.query) return go({}, v.key === 'all' ? '' : v.key);
    const q = v.query;
    const f: LedgerFilter = {
      ...(typeof q.company === 'string' && q.company ? { partner: q.company } : {}),
      ...(typeof q.client === 'string' && q.client ? { clientId: q.client } : {}),
      ...(typeof q.kind === 'string' && q.kind ? { kind: q.kind as LedgerFilter['kind'] } : {}),
      ...(typeof q.code === 'string' && q.code ? { code: q.code } : {}),
      ...(typeof q.project === 'string' && q.project ? { project: q.project } : {}),
    };
    const period = typeof q.period === 'string' ? q.period : ask.key;
    const from = typeof q.from === 'string' ? q.from : ask.from;
    const to = typeof q.to === 'string' ? q.to : ask.to;
    const params = new URLSearchParams({ period, from, to, ...ledgerFilterQuery(f), view: v.key });
    router.push(`/finance?${params.toString()}`);
  };

  const args = ledgerReadArgs(initial, ask.from, ask.to);
  const key = JSON.stringify(args);
  const read = useFinanceRead<LedgerReport, 'finance_unified_ledger'>(
    'finance_unified_ledger',
    args,
    `ledger|${key}`,
    ready,
  );
  const report = read.block.status === 'ready' ? read.block.data : null;
  const companyName = (c: { partner_id: string | null; trade_name_en: string | null; trade_name_ar: string | null }) =>
    locale === 'ar' && c.trade_name_ar ? c.trade_name_ar : (c.trade_name_en ?? '');
  const companyOptions = [
    { value: '', label: t('finance.ledger.allCompanies') },
    ...(report?.companies ?? [])
      .filter((c) => c.partner_id)
      .map((c) => ({
        value: c.partner_id as string,
        label: `${companyName(c)}${c.partner_number ? ` (${c.partner_number})` : ''}`,
      })),
  ];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="finance-ledger" data-finance-ledger-section>
      <h2 id="finance-ledger" className="font-display text-lg font-semibold">
        {t('finance.ledger.title')}
      </h2>
      <SavedViewsBar
        page="finance"
        fixed={[{ key: 'all', label: t('common.all') }]}
        current={view || 'all'}
        query={{ period: ask.key, from: ask.from, to: ask.to, ...ledgerFilterQuery(draft) }}
        onOpen={openView}
        canShare={full}
        onDefault={(v) => openView(v)}
        saveHint={t('finance.ledger.saveHint')}
      />
      <form
        className="flex flex-wrap items-end gap-3"
        data-finance-ledger-filters
        onSubmit={(e) => {
          e.preventDefault();
          go(draft);
        }}
      >
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-sm font-medium">
          {t('finance.ledger.partner')}
          <Select
            value={partner}
            onValueChange={setPartner}
            options={companyOptions}
            aria-label={t('finance.ledger.partner')}
            data-finance-filter-company
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm font-medium">
          {t('finance.ledger.clientId')}
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            aria-label={t('finance.ledger.clientId')}
            data-finance-filter-client
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm font-medium">
          {t('finance.ledger.kind')}
          <Select
            value={kind}
            onValueChange={setKind}
            options={[
              { value: '', label: t('finance.ledger.allKinds') },
              ...LEDGER_KINDS.map((k) => ({ value: k, label: t(`finance.kind.${k}`) })),
            ]}
            aria-label={t('finance.ledger.kind')}
            data-finance-filter-kind
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm font-medium">
          {t('finance.ledger.code')}
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label={t('finance.ledger.code')}
            data-finance-filter-code
          />
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-sm font-medium">
          {t('finance.ledger.project')}
          <Input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            aria-label={t('finance.ledger.project')}
            data-finance-filter-project
          />
          <span className="text-xs font-normal text-muted">{t('finance.ledger.projectSoon')}</span>
        </label>
        <div className="flex gap-2">
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
              setProject('');
              go({});
            }}
            data-finance-filter-clear
          >
            {t('finance.ledger.clear')}
          </Button>
        </div>
      </form>
      <FinanceReport
        report={report}
        loading={read.block.status === 'loading'}
        failed={read.block.status === 'failed'}
        onRetry={read.retry}
      />
    </section>
  );
}
