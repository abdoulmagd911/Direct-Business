import { notFound } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { historyRows, type RecordChange } from '@/ui/record/history';
import { Page } from '@/ui/shell/Page';
import { PartnerRecord, type PartnerRecordData } from './PartnerRecord';
import type { CompanyFile, CompanySummary, Contract, ListEntry, Note, PartnerCard, Side } from '../types';
import type { RecordComments } from '@/ui/record/Comments';

/**
 * The organisation record (V95, V98, V149–V154), opened from the Partners or the Suppliers & partners list.
 *
 * FIX-45: the page used to make 16 separate serverRpc calls (the partner read awaited alone, then 15 more in a
 * Promise.all) — 16 HTTPS round trips through the gateway, so two ordinary 10 s stalls on that spine cost ~20 s.
 * It now makes ONE call, api.partner_page, which returns the card, the org, the six partner sections and the eight
 * lists in a single round trip (the function guards the six sections the way the page's maybe<> used to).
 */
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
  type PageAnswer = {
    card: PartnerCard;
    org: OrgAnswer;
    notes: Note[] | null;
    contracts: Contract[] | null;
    history: RecordChange[] | null;
    comments: RecordComments | null;
    files: CompanyFile[] | null;
    summary: CompanySummary | null;
    lists: {
      types: ListEntry[];
      tiers: ListEntry[];
      reasons: ListEntry[];
      roles: ListEntry[];
      activityTypes: ListEntry[];
      outcomes: ListEntry[];
      systems: ListEntry[];
      priorities: ListEntry[];
      fileKinds: ListEntry[];
    };
  };
  let page: PageAnswer | null = null;
  let refused = false;
  try {
    page = (await serverRpc('partner_page', { p_id: id })) as unknown as PageAnswer;
  } catch (e) {
    const kind = (e as { kind?: string }).kind;
    if (kind === 'NotFound') notFound();
    // Only a real refusal is "no access" (F-B3-05 / F-B5-10 / F-B6-01(c)): a stalled read (Unavailable — the
    // gateway holds a signed-in call ~5 s and gives up at 10 s, status 555) or anything else a read can throw is
    // a failed read, and the record says so with Try again — never a denial. This is the readOrFail rule, applied
    // to the one read this page cannot make optional.
    if (kind === 'PermissionDenied') refused = true;
  }
  // The org is still read on the refused path, as the old page read it alongside the card: the record's no-access
  // state needs the people it names. On the open path it rides inside partner_page — no second round trip.
  // The file kinds ride inside partner_page too (FIX-15): the Files section asks for a review date exactly when
  // the kind requires one, read live, never hard-coded, so an admin's change in Settings applies.
  const org: OrgAnswer = page?.org ?? ((await serverRpc('org', {} as never)) as unknown as OrgAnswer);
  const data: PartnerRecordData = {
    me,
    side,
    tab: typeof tab === 'string' ? tab : 'overview',
    filter: typeof filter === 'string' ? filter : undefined,
    card: page?.card ?? null,
    refused,
    org,
    notes: page?.notes ?? [],
    contracts: page?.contracts ?? [],
    history: page?.history ? historyRows(page.history, 'partner', id) : null,
    comments: page?.comments ?? null,
    files: page?.files ?? null,
    summary: page?.summary ?? null,
    lists: page?.lists ?? {
      types: [],
      tiers: [],
      reasons: [],
      roles: [],
      activityTypes: [],
      outcomes: [],
      systems: [],
      priorities: [],
      fileKinds: [],
    },
  };
  return (
    <Page bare>
      <PartnerRecord data={data} />
    </Page>
  );
}
