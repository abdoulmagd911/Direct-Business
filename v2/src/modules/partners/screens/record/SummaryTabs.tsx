'use client';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { Button } from '@/ui/Button';
import { DataState } from '@/ui/DataState';
import { readFailure, type ReadFailure } from '../../read-failure';
import type { CompanySummary, Contract, PartnerCard, Side } from '../../types';
import { CodesTab, FinanceTab } from './CompanyTabs';

/**
 * The Codes and Finance tabs with their own read (Landing 34). The record's one read (api.partner_page) used to work
 * out the organisation's finance summary on every open — most of that read's time, and the reason records timed out —
 * although only these two tabs show it. The page read now answers `summary_deferred`, and the summary is asked for
 * here (api.company_summary), only when one of the two tabs is opened: once, kept for as long as the record is open,
 * and read again after a change on the record (`stamp` moves). The Overview and the record's first paint never wait
 * on it and never fail because of it; a summary that does not load says so inside the tab, with its own Try again.
 *
 * This component stays mounted on every tab (it draws nothing on the others), so what was read is kept while the
 * person moves between tabs. A page read that still carries the summary itself (`deferred` false) is drawn as before.
 */
export function SummaryTabs({
  tab,
  card,
  deferred,
  initial,
  stamp,
  onPageRetry,
  side,
  hideImported,
  view,
  contracts = [],
}: {
  /** The record's contracts: the Finance tab lists a client-side contract's payments (Landing 47, A13). */
  contracts?: Contract[];
  /** The record's open tab; only 'codes' and 'finance' draw (and ask). */
  tab: string;
  card: PartnerCard;
  /** The page read left the summary to this component. */
  deferred: boolean;
  /** The summary the page read carried, when it was not deferred (null: that read of it failed). */
  initial: CompanySummary | null;
  /** Moves when something on the record was changed: the summary is read again. */
  stamp: number;
  /** Try again for a summary the page read itself failed to give (not deferred): the page reads again. */
  onPageRetry: () => void;
  side: Side;
  hideImported: boolean;
  view: string;
}) {
  const t = useTranslations();
  const wanted = tab === 'codes' || tab === 'finance';
  const [attempt, setAttempt] = useState(0);
  const key = `${card.id}:${stamp}:${attempt}`;
  const [got, setGot] = useState<{ id: string; summary: CompanySummary } | null>(null);
  const [failed, setFailed] = useState<{ key: string; failure: ReadFailure } | null>(null);
  /** The read that has answered: moving between the two tabs, or away and back, asks nothing again. */
  const answered = useRef<string | null>(null);
  useEffect(() => {
    if (!deferred || !wanted || answered.current === key) return;
    let live = true;
    rpc('company_summary', { p_partner: card.id })
      .then((s) => {
        if (!live) return;
        answered.current = key;
        setGot({ id: card.id, summary: s as unknown as CompanySummary });
        setFailed(null);
      })
      .catch((e: unknown) => {
        if (live) setFailed({ key, failure: readFailure(e) });
      });
    return () => {
      live = false;
    };
  }, [deferred, wanted, key, card.id]);

  if (!wanted) return null;
  const what = t(`partners.tabs.${tab}`);
  // what was read stays on screen while it is read again after a change; a summary of another record never does
  const summary = deferred ? (got?.id === card.id ? got.summary : null) : initial;
  if (deferred && !summary) {
    const failure = failed?.key === key ? failed.failure : null;
    if (!failure)
      return (
        <div data-summary-state="loading">
          <DataState kind="loading" message={t('state.loading', { what })} />
        </div>
      );
    return (
      <div data-summary-state="failed">
        <DataState
          kind="failed"
          message={`${t('state.failed', { what })}. ${t(`partners.read.${failure.kind}`)}`}
          action={
            <>
              {attempt > 0 ? (
                <span className="text-sm text-muted" data-read-tried={attempt}>
                  {t('partners.read.again', { count: attempt })}
                </span>
              ) : null}
              <bdi className="font-data text-xs text-muted" data-failure-ref>
                {failure.ref}
              </bdi>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw />}
                onClick={() => setAttempt((n) => n + 1)}
                className="ms-auto"
                data-summary-retry
              >
                {t('common.tryAgain')}
              </Button>
            </>
          }
        />
      </div>
    );
  }
  if (tab === 'codes') return <CodesTab card={card} summary={summary} />;
  return (
    <FinanceTab
      card={card}
      summary={summary}
      onRetry={deferred ? () => setAttempt((n) => n + 1) : onPageRetry}
      side={side}
      hideImported={hideImported}
      view={view}
      contracts={contracts}
    />
  );
}
