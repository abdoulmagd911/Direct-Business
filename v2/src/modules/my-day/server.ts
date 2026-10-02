import 'server-only';
import { serverRpc } from '@/core/db/server-rpc';
import type { ListEntry } from '@/modules/partners/types';
import type { MyDayAnswer, MyNote, Scope } from './types';

/** My day's page (api.my_day). */
export const myDay = async (scope: Scope, limit: number) =>
  (await serverRpc('my_day', { p_scope: scope, p_limit: limit })) as unknown as MyDayAnswer;

/** One note the reader may see; null when it is gone or not theirs to read (a private note is its author's alone). */
export async function myNote(id: string): Promise<MyNote | null> {
  try {
    return (await serverRpc('my_note', { p_id: id })) as unknown as MyNote;
  } catch {
    return null;
  }
}

export const activityTypes = async () =>
  (await serverRpc('list', { p_list: 'activity_type' })) as unknown as ListEntry[];
export const activityOutcomes = async () =>
  (await serverRpc('list', { p_list: 'activity_outcome' })) as unknown as ListEntry[];
