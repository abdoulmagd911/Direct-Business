import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { PartnersList } from './PartnersList';
import { filtersOf, readFilters } from '../list/filters';
import { NO_COUNTS, cardDimensionOn, countsFromRows, countsOf, withCounts, type KpiCounts } from '../list/kpi';
import { SideTabs } from '../list/SideTabs';
import { SIDE_PAGE, type ListEntry, type PartnersAnswer, type Side } from '../types';

export { filtersOf };

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

/**
 * Partners, with Suppliers as its second tab (V98, V149, V217): one list per side over api.partners(side), each tab
 * its own address and its own access key. The tab row shows only when the reader has both sides. The filters live in
 * the address, so a saved view is an address and the global refetch re-reads the list. What the reader may not see is
 * refused by the database and shown as the no-access state, never as an empty list.
 */
export async function PartnersListPage({
  side,
  searchParams,
}: {
  side: Side;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, me] = await Promise.all([searchParams, requireMe()]);
  const t = await getTranslations();
  const page = SIDE_PAGE[side];
  // the title is the page on screen: Partners on /partners, Suppliers on /suppliers; the two tabs sit under it (V217, V238)
  const title = side === 'client' ? t('nav.clients') : t('nav.suppliers_partners');
  if ((me.levels[page] ?? 'none') === 'none')
    return (
      <Page>
        <PageHeader title={title} />
        <DataState
          kind="no-access"
          what={title}
          message={t('state.noAccess', { what: title })}
          goHome={t('errors.notFound.goMyDay')}
        />
      </Page>
    );
  const filters = filtersOf(q);
  const p_filters = readFilters(side, filters);
  const read = async (): Promise<{ answer: PartnersAnswer | null; failed: boolean }> => {
    try {
      const answer = (await serverRpc('partners', {
        p_filters: withCounts(p_filters) as never,
        p_limit: 500,
      })) as unknown as PartnersAnswer;
      return { answer, failed: false };
    } catch {
      return { answer: null, failed: true };
    }
  };
  // Landing 31: the cards' figures come with the list read itself (`counts`, 20261116110000) — the search and the
  // other filters on, the cards' own choice off — so a render is one partners read whatever card is pressed (FIX-45).
  const other: Side = side === 'client' ? 'supplier_partner' : 'client';
  const both = (me.levels[SIDE_PAGE[other]] ?? 'none') !== 'none';
  // FIX-45: the other side's count used to cost a second `partners` call on every list render, only to fill the
  // other tab's number. It is omitted now — the tab shows no count until it is opened, when its own list read
  // carries its total. One list render is one partners read.
  const [org, types, tiers, priorities, { answer, failed }] = await Promise.all([
    serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
    serverRpc('list', { p_list: 'side_type' }) as unknown as Promise<ListEntry[]>,
    serverRpc('list', { p_list: 'side_tier' }) as unknown as Promise<ListEntry[]>,
    serverRpc('list', { p_list: 'priority' }) as unknown as Promise<ListEntry[]>,
    read(),
  ]);
  // An answer without counts (a database not yet migrated) falls back to its rows when they are the whole unfiltered
  // list; otherwise the figures are not known ("—"), never guessed and never 0.
  const counts: KpiCounts = !answer
    ? NO_COUNTS
    : (countsOf(answer) ??
      (!cardDimensionOn(filters) && answer.total <= answer.rows.length
        ? countsFromRows(answer.rows, answer.total)
        : NO_COUNTS));
  const totals: Record<Side, number | null> = {
    [side]: answer?.total ?? null,
    [other]: null,
  } as Record<Side, number | null>;
  return (
    <Page bare>
      <PartnersList
        me={me}
        side={side}
        title={title}
        filters={filters}
        answer={answer}
        failed={failed}
        org={org}
        types={types.filter((x) => x.side === side)}
        sideTypes={types}
        tiers={tiers.filter((x) => x.side === side)}
        priorities={priorities}
        startCreating={str(q.new) === '1'}
        counts={counts}
        tabs={
          both ? (
            <SideTabs
              side={side}
              label={t('partners.sideTabs')}
              names={{ client: t('nav.clients'), supplier_partner: t('nav.suppliers_partners') }}
              totals={totals}
            />
          ) : null
        }
      />
    </Page>
  );
}
