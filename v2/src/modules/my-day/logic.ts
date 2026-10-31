import { TURN_KINDS, type TodayTask, type MyNote, type NoteLink, type TurnKind } from './types';

/** Every block on My day draws this many rows at most, then a "more" link (V433: 5–7 rows, Comfortable, never cramped). */
export const BLOCK_ROWS = 7;

export function blockOf<T>(rows: T[], total: number): { rows: T[]; more: boolean } {
  return { rows: rows.slice(0, BLOCK_ROWS), more: Math.max(total, rows.length) > BLOCK_ROWS };
}

/**
 * Turn into (V433): a logged meeting or call and a reminder now. A task, an action item and an achievement wait on their
 * own flag — set when their Turn into dialog and the database door accept them (`note_turn_into` answers `not_yet` for
 * all three until then) — not on their page being built, which only gives the + menu and the record address (V270,
 * V377). Until its flag is set the menu leaves a kind out, never greyed (GC-1, cut 3, V605 (3)).
 */
export const TURN_NEEDS: Partial<Record<TurnKind, string>> = {
  task: 'tasks.turn_into_task',
  action_item: 'tasks.turn_into',
  achievement: 'kpis.turn_into',
};

/**
 * The Turn into flags that are set: their dialog and their database door are both in (V605 (3)) — an achievement
 * (V381), a task (V226: the task door and the checklist option are live in production since 7 Oct) and an item on a
 * task's checklist (V647: the database door has taken it since 3 Oct; the picker is in).
 */
export const TURN_READY: ReadonlySet<string> = new Set(['kpis.turn_into', 'tasks.turn_into_task', 'tasks.turn_into']);

export function turnLive(kind: TurnKind, built: ReadonlySet<string>): boolean {
  const flag = TURN_NEEDS[kind];
  return !flag || built.has(flag);
}

/** The Turn into kinds the menu offers: a kind whose flag is not set is left out, never greyed (GC-1, cut 3). */
export const liveKinds = (built: ReadonlySet<string>): TurnKind[] => TURN_KINDS.filter((k) => turnLive(k, built));

/** A note's line: its title, else its first words, else its first checklist row. */
export function noteTitle(n: Pick<MyNote, 'title' | 'body' | 'items'>): string {
  return (
    n.title?.trim() || n.body?.trim().split('\n')[0]?.trim() || n.items.find((i) => i.text.trim())?.text.trim() || ''
  );
}

/** The whole note as one text, for the line of the activity it becomes. */
export function noteText(n: Pick<MyNote, 'title' | 'body' | 'items'>): string {
  return [n.title?.trim(), n.body?.trim(), ...n.items.map((i) => `- ${i.text.trim()}`)].filter(Boolean).join('\n');
}

export function checklistCount(n: Pick<MyNote, 'items'>): { done: number; total: number } {
  return { done: n.items.filter((i) => i.done).length, total: n.items.length };
}

/**
 * The count on a checklist's card: the action items of the task it became when it made some (they are what gets ticked
 * once it is a task), else its own rows.
 */
export function cardCount(n: Pick<MyNote, 'items' | 'task_items'>): { done: number; total: number } {
  return n.task_items?.total ? n.task_items : checklistCount(n);
}

/** Where a "turned into" chip leads: a logged call or meeting opens its organisation's record; a reminder has no page. */
export function linkRoute(link: NoteLink): string | null {
  // the call a note became is a line of the organisation's Activity: the chip opens it there
  if (link.entity === 'activity' && link.partner_id) return `/partners/${link.partner_id}?tab=activity`;
  if (link.entity === 'achievement') return `/kpis/achievements/${link.id}`;
  if ((link.entity === 'task' || link.entity === 'action_item') && link.number) return `/tasks/${link.number}`;
  return null;
}

/** A note's own page, under My day: where a "from note" chip and a note's row lead. */
export const noteRoute = (id: string) => `/my-day/notes/${id}`;

/**
 * Wrap up today (V433) walks my open captures: api.my_day's Me answer is already the notes not done and due by today, and
 * what a meeting finished or a note turned into something has been handled.
 */
export function openCaptures(notes: MyNote[]): MyNote[] {
  return notes.filter((n) => n.mine && !n.finished_at && n.links.length === 0);
}

/** The next working day in Riyadh: Sunday after a Thursday (OLD-WRK-022; Friday and Saturday are the weekend). */
export function nextWorkingDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 5 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export type TodayGroups = { overdue: TodayTask[]; today: TodayTask[]; next: TodayTask[] };

/**
 * The Today block's three groups (Overdue, Today, Next). The database already names each task's group by its Riyadh due
 * day (D3); a task without one is grouped here from `day` — Riyadh's date, never the browser's (V40, D20). Tasks I only
 * help on are not mine to chase and stay out.
 */
export function todayGroups(tasks: TodayTask[], day: string): TodayGroups {
  const out: TodayGroups = { overdue: [], today: [], next: [] };
  for (const t of tasks) {
    if (t.role === 'helper' || t.group === 'helping') continue;
    const g = t.group ?? (t.due_on < day ? 'overdue' : t.due_on === day ? 'today' : 'next');
    out[g].push(t);
  }
  return out;
}

/** The four groups of the Today block, in the order they are drawn (P5-7). */
export const TASK_GROUPS = ['overdue', 'today', 'next', 'helping'] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

/** The block's views that come with the page: all four groups, the tasks that are mine, the tasks I only help on. */
export const FIXED_TASK_VIEWS: Record<'all' | 'mine' | 'helping', TaskGroup[]> = {
  all: [],
  mine: ['overdue', 'today', 'next'],
  helping: ['helping'],
};

/** The groups a saved view keeps; an unknown word is dropped, and none at all means every group is drawn. */
export function readTaskView(query: Record<string, unknown> | undefined): TaskGroup[] {
  const raw = Array.isArray(query?.groups) ? (query!.groups as unknown[]) : [];
  return TASK_GROUPS.filter((g) => raw.includes(g));
}

/** The tasks I only help on (they are not mine to chase, so `todayGroups` leaves them out), the nearest day first. */
export function helpingTasks(tasks: TodayTask[]): TodayTask[] {
  return tasks
    .filter((t) => t.role === 'helper' || t.group === 'helping')
    .sort((a, b) => a.due_on.localeCompare(b.due_on));
}

/** What a person can decide about a row: Done, Tomorrow (the next working day) or Drop. A row with no choice is left alone. */
export type WrapChoice = 'done' | 'tomorrow' | 'drop';
export const WRAP_CHOICES: WrapChoice[] = ['done', 'tomorrow', 'drop'];
/** The word a row is shown under: a task, or what the capture was made as (V641). */
export type WrapWord = 'task' | NonNullable<MyNote['capture_kind']>;
/** The order the groups are drawn in: tasks first, then the captures by kind. */
export const WRAP_WORDS: WrapWord[] = ['task', 'note', 'idea', 'checklist', 'reminder', 'meeting'];
export type WrapItem = {
  kind: 'task' | 'note';
  word: WrapWord;
  id: string;
  title: string;
  client: string | null;
  route: string;
  number?: string;
};

/** How a row is named when it is spoken about: a task by its number, a note by its words. */
export const wrapLabel = (i: { title: string; number?: string | null }) =>
  i.number ? `${i.number} ${i.title}` : i.title;

/** The capture's own kind word: what it was captured as, or what its stored kind says on a read that predates it. */
export const captureWord = (n: MyNote): NonNullable<MyNote['capture_kind']> =>
  n.capture_kind ?? (n.kind === 'sticky' ? 'note' : n.kind);

/**
 * Wrap up v2 walks the day's tasks (mine, overdue or due today) and my open captures. The rows I only help on are
 * not mine to close, and a task due later is not today's.
 */
export function wrapItems(tasks: TodayTask[], notes: MyNote[]): WrapItem[] {
  const mine = tasks
    .filter((t) => t.role === 'owner' && (t.group === 'overdue' || t.group === 'today'))
    .map((t): WrapItem => ({
      kind: 'task',
      word: 'task',
      id: t.id,
      title: t.title,
      client: t.partner_name,
      route: `/tasks/${t.number}`,
      number: t.number,
    }));
  const captured = openCaptures(notes).map((n): WrapItem => ({
    kind: 'note',
    word: captureWord(n),
    id: n.id,
    title: noteTitle(n),
    client: null,
    route: noteRoute(n.id),
  }));
  return [...mine, ...captured];
}

/** The rows grouped by their kind word, in the fixed order; a kind with no rows has no group. */
export function wrapGroups(items: WrapItem[]): { word: WrapWord; items: WrapItem[] }[] {
  return WRAP_WORDS.map((word) => ({ word, items: items.filter((i) => i.word === word) })).filter(
    (g) => g.items.length > 0,
  );
}

/** The one request for the lot: api.wrap_up's items — only the rows the person chose; the rest stay as they are. */
export function wrapPayload(items: WrapItem[], states: Record<string, WrapChoice | undefined>) {
  return items.flatMap((i) => {
    const choice = states[i.id];
    return choice ? [{ kind: i.kind, id: i.id, choice }] : [];
  });
}

/** What one Save will do, counted from the choices made, so no one re-dates the list without seeing it. */
export function wrapSummary(items: WrapItem[], states: Record<string, WrapChoice | undefined>) {
  const out = { done: 0, tomorrow: 0, drop: 0 };
  for (const p of wrapPayload(items, states)) out[p.choice] += 1;
  return out;
}

/**
 * After a refused Save the rows are read again: the ones that are gone (no longer mine, or closed meanwhile) are named
 * and left out; every other choice is kept, so one more tap saves the rest.
 */
export function wrapRecover(before: WrapItem[], after: WrapItem[]) {
  const still = new Set(after.map((i) => i.id));
  return { gone: before.filter((i) => !still.has(i.id)), items: after };
}
