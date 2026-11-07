import { notFound } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { historyRows, type RecordChange } from '@/ui/record/history';
import { Page } from '@/ui/shell/Page';
import { PartnerRecord, type PartnerRecordData } from './PartnerRecord';
import type { CompanyFile, CompanySummary, Contract, ListEntry, Note, PartnerCard, Side } from '../types';
import type { RecordComments } from '@/ui/record/Comments';

/** What the reader may not read is left out, never faked (the database refuses; the screen shows no-access). */
async function maybe<T>(read: () => Promise<unknown>): Promise<T | null> {
  try {
    return (await read()) as T;
  } catch {
    return null;
  }
}

/** The organisation record (V95, V98, V149–V154), opened from the Clients or the Suppliers & partners list. */
export async function PartnerRecordPage({
  side,
  params,
  searchParams,
}: {
  side: Side;
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; filter?: string | string[] }>;
}) {
  const [{ id }, { tab, filter }, me] = await Promise.all([params, searchParams, requireMe()]);
  let card: PartnerCard | null = null;
  let refused = false;
  try {
    card = (await serverRpc('partner', { p_id: id })) as unknown as PartnerCard;
  } catch (e) {
    if ((e as { kind?: string }).kind === 'NotFound') notFound();
    refused = true;
  }
  const lists = async (name: string) => (await serverRpc('list', { p_list: name })) as unknown as ListEntry[];
  const [
    org,
    notes,
    contracts,
    history,
    comments,
    files,
    summary,
    types,
    tiers,
    reasons,
    roles,
    activityTypes,
    outcomes,
    systems,
    priorities,
  ] = await Promise.all([
    serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
    card ? maybe<Note[]>(() => serverRpc('notes', { p_entity: 'partner', p_id: id, p_limit: 100 })) : null,
    card ? maybe<Contract[]>(() => serverRpc('contracts', { p_partner: id })) : null,
    card ? maybe<RecordChange[]>(() => serverRpc('record_history', { p_entity: 'partner', p_id: id } as never)) : null,
    // The Discussion's comments, read live beside the files.
    card ? maybe<RecordComments>(() => serverRpc('comments', { p_entity: 'partner', p_id: id } as never)) : null,
    // The company page's Files section (existing file doors) and its Codes/Finance tabs (one summary
    // read). Either failing leaves its tab saying so, never an invented figure.
    card ? maybe<CompanyFile[]>(() => serverRpc('files', { p_entity: 'partner', p_id: id })) : null,
    card ? maybe<CompanySummary>(() => serverRpc('company_summary', { p_partner: id })) : null,
    lists('side_type'),
    lists('side_tier'),
    lists('side_status_reason'),
    lists('contact_role'),
    lists('activity_type'),
    lists('activity_outcome'),
    lists('ref_system'),
    lists('priority'),
  ]);
  const data: PartnerRecordData = {
    me,
    side,
    tab: typeof tab === 'string' ? tab : 'overview',
    filter: typeof filter === 'string' ? filter : undefined,
    card,
    refused,
    org,
    notes: notes ?? [],
    contracts: contracts ?? [],
    history: history ? historyRows(history, 'partner', id) : null,
    comments,
    files,
    summary,
    lists: { types, tiers, reasons, roles, activityTypes, outcomes, systems, priorities },
  };
  return (
    <Page bare>
      <PartnerRecord data={data} />
    </Page>
  );
}
