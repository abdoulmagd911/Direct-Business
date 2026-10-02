import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { PartnersList, type ListFilters } from './PartnersList';
import Link from 'next/link';
import { cn } from '@/ui/cn';
import { SIDE_PAGE, SIDE_ROUTE, type ListEntry, type PartnersAnswer, type Side } from '../types';

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
const many = (v: string) => (v ? v.split(',').filter(Boolean) : []);

/** The filters a list address carries (a saved view is one of these, under a name). */
export function filtersOf(q: Record<string, string | string[] | undefined>): ListFilters {
  return {
    q: str(q.q),
    types: many(str(q.type)),
    owners: many(str(q.owner)),
    statuses: many(str(q.status)),
    tiers: many(str(q.tier)),
    priorities: many(str(q.priority)),
    key_partner: str(q.key) === '1',
    stale: str(q.stale) === '1',
    archived: str(q.archived) === '1',
    view: str(q.view),
  };
}

/**
 * Clients, with Suppliers as its second tab (V98, V149, V217): one list per side over api.partners(side), each tab
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
  // one page, two tabs: the title is Clients on both (V217)
  const title = t('nav.clients');
  if ((me.levels[page] ?? 'none') === 'none')
    return (
      <Page>
        <PageHeader title={title} />
        <DataState kind="no-access" what={title} message={t('state.noAccess', { what: title })} />
      </Page>
    );
  const filters = filtersOf(q);
  const p_filters: Record<string, unknown> = { side };
  if (filters.q) p_filters.q = filters.q;
  if (filters.types.length) p_filters.types = filters.types;
  if (filters.owners.length) p_filters.owners = filters.owners;
  if (filters.statuses.length) p_filters.statuses = filters.statuses;
  if (filters.tiers.length) p_filters.tiers = filters.tiers;
  if (filters.priorities.length) p_filters.priorities = filters.priorities;
  if (filters.key_partner) p_filters.key_partner = true;
  if (filters.stale) p_filters.stale = true;
  if (filters.archived) p_filters.include_archived = true;
  const read = async (): Promise<{ answer: PartnersAnswer | null; failed: boolean }> => {
    try {
      const answer = (await serverRpc('partners', {
        p_filters: p_filters as never,
        p_limit: 500,
      })) as unknown as PartnersAnswer;
      return { answer, failed: false };
    } catch {
      return { answer: null, failed: true };
    }
  };
  const [org, types, tiers, priorities, { answer, failed }] = await Promise.all([
    serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
    serverRpc('list', { p_list: 'side_type' }) as unknown as Promise<ListEntry[]>,
    serverRpc('list', { p_list: 'side_tier' }) as unknown as Promise<ListEntry[]>,
    serverRpc('list', { p_list: 'priority' }) as unknown as Promise<ListEntry[]>,
    read(),
  ]);
  const other: Side = side === 'client' ? 'supplier_partner' : 'client';
  const both = (me.levels[SIDE_PAGE[other]] ?? 'none') !== 'none';
  let otherTotal: number | null = null;
  if (both)
    try {
      const a = (await serverRpc('partners', {
        p_filters: { side: other } as never,
        p_limit: 1,
      })) as unknown as PartnersAnswer;
      otherTotal = a.total;
    } catch {
      otherTotal = null;
    }
  const totals: Record<Side, number | null> = {
    [side]: answer?.total ?? null,
    [other]: otherTotal,
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
        tabs={
          both ? (
            <nav aria-label={t('partners.sideTabs')} data-side-tabs className="flex border-b border-border sm:gap-1">
              {(['client', 'supplier_partner'] as const).map((s) => {
                const active = s === side;
                return (
                  <Link
                    key={s}
                    href={SIDE_ROUTE[s]}
                    aria-current={active ? 'page' : undefined}
                    data-side-tab={s}
                    className={cn(
                      '-mb-px flex h-11 flex-1 items-center justify-center gap-2 border-b-2 px-4 text-base font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus sm:flex-none',
                      active ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text',
                    )}
                  >
                    {s === 'client' ? t('nav.clients') : t('nav.suppliers_partners')}
                    {totals[s] !== null ? (
                      <span className="font-data text-sm text-muted" data-side-count>
                        {totals[s]}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          ) : null
        }
      />
    </Page>
  );
}
