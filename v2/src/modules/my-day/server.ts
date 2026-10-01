import 'server-only';
import { serverRpc } from '@/core/db/server-rpc';
import type { ListEntry } from '@/modules/partners/types';
import type { MyDayAnswer, MyNote, PartnerRef, Scope, TurnedInto } from './types';

/** My day's page (api.my_day). */
export const myDay = async (scope: Scope, limit: number) =>
  (await serverRpc('my_day', { p_scope: scope, p_limit: limit })) as unknown as MyDayAnswer;

/** One note the reader may see; null when it is gone or not theirs to read (a private note is its author's alone). */
export async function myNote(id: string): Promise<MyNote | null> {
  try {
    return (await serverRpc('note', { p_id: id })) as unknown as MyNote;
  } catch {
    return null;
  }
}

export const activityTypes = async () =>
  (await serverRpc('list', { p_list: 'activity_type' })) as unknown as ListEntry[];
export const activityOutcomes = async () =>
  (await serverRpc('list', { p_list: 'activity_outcome' })) as unknown as ListEntry[];

/** The organisations the notes name — a meeting's, and what each note was turned into — each by one hover read. */
export async function partnersOf(notes: MyNote[]): Promise<Record<string, PartnerRef>> {
  const ids = new Set<string>();
  for (const n of notes) {
    if (n.meeting_partner_id) ids.add(n.meeting_partner_id);
    for (const l of n.turned_into as TurnedInto[]) if (l.partner_id) ids.add(l.partner_id);
  }
  const found = await Promise.all(
    [...ids].map(async (id) => {
      try {
        return (await serverRpc('hover_partner', { p_id: id })) as unknown as PartnerRef | null;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(found.filter((p): p is PartnerRef => !!p).map((p) => [p.id, p]));
}
