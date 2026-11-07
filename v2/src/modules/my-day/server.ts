import 'server-only';
import { serverRpc } from '@/core/db/server-rpc';
import type { ListEntry } from '@/modules/partners/types';
import type { TaskRow } from '@/modules/tasks/types';
import type { CaptureKind } from './quick-capture';
import type { DueAnswer } from './reminder-alert';
import type { MyDayAnswer, MyNote, OpenAsks, Scope } from './types';

/** My day's page (api.my_day). */
export async function myDay(scope: Scope, limit: number, kind?: CaptureKind): Promise<MyDayAnswer> {
  const day = (await serverRpc('my_day', { p_scope: scope, p_limit: limit })) as unknown as MyDayAnswer;
  if (!kind) return day;
  // narrowed to one kind (V641): the notes, their total and "more" come from the kind's own read; the rest is My day's
  const of = (await serverRpc('my_notes_by_kind', { p_scope: scope, p_kind: kind, p_limit: limit })) as unknown as Pick<
    MyDayAnswer,
    'notes' | 'notes_total' | 'more'
  >;
  return { ...day, notes: of.notes, notes_total: of.notes_total, more: of.more };
}

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

/** My reminders whose time has come and are not put away (api.reminders_due); null when it cannot be read — the Today block says so and the rest of My day still draws. */
export async function remindersDue(): Promise<DueAnswer | null> {
  try {
    return (await serverRpc('reminders_due', {} as never)) as unknown as DueAnswer;
  } catch {
    return null;
  }
}

/** The open questions asked to me and the ones I asked (api.open_asks); null when it cannot be read — the Waiting sections say so and the rest of My day still draws. */
export async function openAsks(): Promise<OpenAsks | null> {
  try {
    return (await serverRpc('open_asks', {} as never)) as unknown as OpenAsks;
  } catch {
    return null;
  }
}

/** The tasks flagged as needing help and addressed to me (api.escalated_tasks); null when it cannot be read. */
export async function escalatedToMe(): Promise<TaskRow[] | null> {
  try {
    return (await serverRpc('escalated_tasks', {} as never)) as unknown as TaskRow[];
  } catch {
    return null;
  }
}
