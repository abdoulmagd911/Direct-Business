// Landing 31 (the 15 Nov boards): the pieces of the Tasks look that are rules, not paint — kept pure so the list and the
// board cannot disagree and a test can pin them without drawing anything.
import { boardColumns, statusView, type StatusView } from '../rules';
import type { TaskRow, TaskStatus } from '../types';

/**
 * THE ONE PILL (15 Nov: "One status pill per task, everywhere"). A row or a card shows exactly one pill, chosen by
 * this order — the first that applies:
 *   1. Blocked — the task is In progress and carries a blocked reason;
 *   2. the task's own status, by the name the settings give it (Not started · In progress · Done · Cancelled).
 * Nothing else is ever a pill: Overdue is the due date drawn in the danger colour with the word "Overdue:" for a
 * screen reader and its own icon (never colour alone); the priority is a line of text under the title; the star is
 * the star.
 */
export function pillOf(row: Pick<TaskRow, 'meaning' | 'blocked_reason'>): StatusView {
  return statusView(row);
}

export type StatusGroup<R> = {
  /** The status key, or `blocked` for the Blocked group. */
  key: string;
  kind: 'status' | 'blocked';
  /** The settings' status; null for Blocked and for a status the settings no longer name. */
  status: TaskStatus | null;
  rows: R[];
};

/**
 * The board's columns and the list's groups — the same answer for both. One per status the app really has, in the
 * settings' order (`boardColumns`: every active status, and a retired one only while a task holds it), plus Blocked
 * right after In progress: a blocked task is In progress with its reason (V191), and the boards give it its own
 * column. Every row lands in exactly one group, so the counts add up to the list's count.
 */
export function statusGroups<R extends Pick<TaskRow, 'status' | 'meaning' | 'blocked_reason'>>(
  rows: readonly R[],
  statuses: readonly TaskStatus[],
): StatusGroup<R>[] {
  const columns = boardColumns(rows, statuses);
  // a settings status that is itself keyed "blocked" owns that name: nothing is split out of it
  if (columns.some((c) => c.key === 'blocked'))
    return columns.map((c) => ({ key: c.key, kind: 'status' as const, status: c.status, rows: c.rows }));
  const blocked: StatusGroup<R> = { key: 'blocked', kind: 'blocked', status: null, rows: [] };
  const out: StatusGroup<R>[] = [];
  let after = -1;
  for (const c of columns) {
    const stuck = c.rows.filter((r) => statusView(r) === 'blocked');
    blocked.rows.push(...stuck);
    out.push({
      key: c.key,
      kind: 'status',
      status: c.status,
      rows: stuck.length ? c.rows.filter((r) => statusView(r) !== 'blocked') : c.rows,
    });
    if (c.status?.meaning === 'in_progress') after = out.length;
  }
  if (after >= 0) out.splice(after, 0, blocked);
  else if (blocked.rows.length) out.push(blocked);
  return out;
}

/**
 * What a task is about, in names: "project · partner", one of them, or the word for internal work. A name the reader
 * may not see (the lookups hold none) is left out; with nothing to say the answer is empty.
 */
export function whereOf(
  row: Pick<TaskRow, 'project_id' | 'partner_id' | 'work_type'>,
  names: { project: (id: string | null) => string; partner: (id: string | null) => string },
  internal: string,
): { kind: 'project' | 'partner' | 'internal' | 'none'; parts: string[] } {
  const known = (s: string) => (s && s !== '—' ? s : '');
  const project = known(names.project(row.project_id));
  const partner = known(names.partner(row.partner_id));
  if (project) return { kind: 'project', parts: partner ? [project, partner] : [project] };
  if (partner) return { kind: 'partner', parts: [partner] };
  if (!row.project_id && !row.partner_id && row.work_type === 'internal')
    return { kind: 'internal', parts: [internal] };
  return { kind: 'none', parts: [] };
}
