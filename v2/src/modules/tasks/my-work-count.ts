// The count behind the Tasks tab's number and its count line (15 Nov boards: "My work · 15 open tasks · 5 due today ·
// 2 overdue · 4 done"), and behind My day's banner — ONE function, so the two screens can never say different numbers.
// Pure: no read here. `loadMyWorkCount` (load.ts) is the read for a screen that does not already hold the rows.
import { dueState } from './rules';
import type { TaskRow } from './types';

export type WorkCount = {
  /** Not started + In progress (a blocked task is In progress with its reason, so it is open). The tab's number. */
  open: number;
  /** Of the open ones: those I am Responsible for, and those I only help on. `owned + helping === open`. */
  owned: number;
  helping: number;
  /** Of the open ones: due on Riyadh's today, and due before it (past work is never overdue, V491). */
  dueToday: number;
  overdue: number;
  /** Done tasks among the rows (cancelled ones are counted nowhere). */
  done: number;
};

type Counted = Pick<TaskRow, 'meaning' | 'due_on' | 'past_work' | 'owner_id'>;

/** What api.tasks is asked for "My work" with no chips on — the Tasks page's own default read (listFilter of it). */
export const MY_WORK_FILTER = { scope: 'my_work' } as const;

/** Counts the rows of one task list as the Tasks tab does. `today` is Riyadh's day (`riyadhDay(new Date())`), `me` the
 *  reader's person id (`me.person.id`). */
export function workCount(rows: readonly Counted[], today: string, me: string): WorkCount {
  const out: WorkCount = { open: 0, owned: 0, helping: 0, dueToday: 0, overdue: 0, done: 0 };
  for (const r of rows) {
    if (r.meaning === 'done') out.done += 1;
    if (r.meaning !== 'not_started' && r.meaning !== 'in_progress') continue;
    out.open += 1;
    if (r.owner_id === me) out.owned += 1;
    else out.helping += 1;
    const due = dueState(r, today);
    if (due === 'today') out.dueToday += 1;
    if (due === 'overdue') out.overdue += 1;
  }
  return out;
}
