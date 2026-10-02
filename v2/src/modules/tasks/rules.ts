// The rules the Tasks screens apply (P5-2, first PR; builder D, V270–V275). Pure functions, so each is unit-tested
// and sabotaged (tests/unit/tasks, tests/sabotage/tasks.mjs). The database decides access and every write rule
// (#140, V189–V196); these only shape what is asked and how it reads on screen.
import type { Meaning, TaskRow, TaskStatus } from './types';

// ---------------------------------------------------------------- the day (V40, V400)

/** Riyadh's calendar day for an instant, as YYYY-MM-DD — whatever the browser's or the server's own clock zone. */
export function riyadhDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** A calendar day moved by whole days (no clock, no zone: a date is a date). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** V514: an item is urgent when overdue or due within this many days (`work.urgent_within_days`, its first value). */
export const URGENT_WITHIN_DAYS = 2;

export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'later' | 'closed';

/**
 * How a due day reads today (V400, V491, V514): a closed task's due is history; past work is never overdue; an open
 * task is overdue the day after its due day, "today" on it, "soon" within the urgent window.
 */
export function dueState(t: Pick<TaskRow, 'due_on' | 'meaning' | 'past_work'>, today: string): DueState {
  if (!t.due_on) return 'none';
  if (t.meaning === 'done' || t.meaning === 'cancelled') return 'closed';
  if (t.past_work) return 'later';
  if (t.due_on < today) return 'overdue';
  if (t.due_on === today) return 'today';
  if (t.due_on <= addDays(today, URGENT_WITHIN_DAYS)) return 'soon';
  return 'later';
}

// ---------------------------------------------------------------- the list's views and chips (§3.7)

/** My work (owned ∪ items ∪ helping — V195), Owned, Helping, Team (what the person may see: their departments, V96). */
export const SCOPES = ['my_work', 'owned', 'helping', 'team'] as const;
export type Scope = (typeof SCOPES)[number];
export const STATUS_CHIPS = ['open', 'blocked', 'done', 'cancelled'] as const;
export type StatusChipKey = (typeof STATUS_CHIPS)[number];
export const DUE_CHIPS = ['overdue', 'today', 'week', 'none'] as const;
export type DueChipKey = (typeof DUE_CHIPS)[number];

export type TaskFilters = {
  scope: Scope;
  status?: StatusChipKey;
  due?: DueChipKey;
  partner?: string;
  project?: string;
  q?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = <T extends string>(list: readonly T[], v: string | undefined): T | undefined =>
  v !== undefined && (list as readonly string[]).includes(v) ? (v as T) : undefined;

/** The list's state lives in the address (shareable, Back works): anything unknown is dropped, never guessed. */
export function parseFilters(params: Record<string, string | string[] | undefined>): TaskFilters {
  const partner = one(params.partner);
  const project = one(params.project);
  const q = one(params.q)?.trim().slice(0, 100);
  return {
    scope: oneOf(SCOPES, one(params.view)) ?? 'my_work',
    status: oneOf(STATUS_CHIPS, one(params.status)),
    due: oneOf(DUE_CHIPS, one(params.due)),
    partner: partner && UUID.test(partner) ? partner : undefined,
    project: project && UUID.test(project) ? project : undefined,
    q: q || undefined,
  };
}

/** The address of the list with one change made (a chip set, dropped, or the view switched). */
export function filtersHref(f: TaskFilters, change: Partial<TaskFilters> = {}): string {
  const next = { ...f, ...change };
  const p = new URLSearchParams();
  if (next.scope !== 'my_work') p.set('view', next.scope);
  if (next.status) p.set('status', next.status);
  if (next.due) p.set('due', next.due);
  if (next.partner) p.set('partner', next.partner);
  if (next.project) p.set('project', next.project);
  if (next.q) p.set('q', next.q);
  const s = p.toString();
  return s ? `/tasks?${s}` : '/tasks';
}

/** What api.tasks is asked (V195's filter). What it cannot answer yet — Helping, due today or this week — is `keepRow`. */
export function apiFilter(f: TaskFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {
    scope: f.scope === 'owned' ? 'mine' : f.scope === 'team' ? 'all' : 'my_work',
  };
  if (f.status === 'open') out.meanings = ['not_started', 'in_progress'];
  if (f.status === 'blocked') {
    out.meanings = ['in_progress'];
    out.blocked = true;
  }
  if (f.status === 'done') out.meanings = ['done'];
  if (f.status === 'cancelled') out.meanings = ['cancelled'];
  if (f.due === 'overdue') out.overdue = true;
  if (f.partner) out.partner_id = f.partner;
  if (f.project) out.project_id = f.project;
  if (f.q) out.q = f.q;
  return out;
}

/** The part of the filter judged on the rows: Helping is My work I do not own; due today, this week, or none. */
export function keepRow(row: TaskRow, f: TaskFilters, me: string, today: string): boolean {
  if (f.scope === 'helping' && row.owner_id === me) return false;
  if (f.due === 'today' && row.due_on !== today) return false;
  if (f.due === 'week' && !(row.due_on && row.due_on >= today && row.due_on <= addDays(today, 6))) return false;
  if (f.due === 'none' && row.due_on) return false;
  return true;
}

// ---------------------------------------------------------------- status (V401, V191)

/** What a status reads as: one of the four meanings, or Blocked — In progress with its reason. */
export type StatusView = Meaning | 'blocked';

export function statusView(t: Pick<TaskRow, 'meaning' | 'blocked_reason'>): StatusView {
  return t.meaning === 'in_progress' && t.blocked_reason ? 'blocked' : t.meaning;
}

export const STATUS_TONE: Record<StatusView, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  not_started: 'neutral',
  in_progress: 'info',
  blocked: 'warning',
  done: 'success',
  cancelled: 'neutral',
};

export type Move = { kind: 'status'; status: TaskStatus } | { kind: 'block' };

/**
 * The moves a task offers, in the statuses' own order, without the one it is in: each of the four statuses, and
 * Blocked (unless it already is). Resuming a blocked task is choosing In progress (V191).
 */
export function statusMoves(t: Pick<TaskRow, 'meaning' | 'blocked_reason' | 'status'>, statuses: TaskStatus[]): Move[] {
  const now = statusView(t);
  const live = [...statuses].filter((s) => s.active).sort((a, b) => a.sort - b.sort);
  const out: Move[] = [];
  for (const s of live) {
    if (s.key !== t.status || now === 'blocked') out.push({ kind: 'status', status: s });
    // Blocked sits where In progress does, whether or not the task is in it now
    if (s.meaning === 'in_progress' && now !== 'blocked') out.push({ kind: 'block' });
  }
  return out;
}

export const REASON_MAX = 500;

export type MovePlan =
  | { go: { p_status: string; p_reason?: string; p_close_items?: boolean } }
  | { ask: 'reason' }
  | { ask: 'close_items'; count: number }
  | { refuse: 'reason_too_long' };

/**
 * What a chosen move needs before it is sent (V401, V191): Blocked needs its reason; Done with open action items asks
 * first, then closes them too (one request, one Undo). The database refuses the same — this asks before it has to.
 */
export function planMove(
  t: Pick<TaskRow, 'open_action_items'>,
  move: Move,
  statuses: TaskStatus[],
  answers: { reason?: string; closeItems?: boolean } = {},
): MovePlan {
  if (move.kind === 'block') {
    const reason = answers.reason?.trim() ?? '';
    if (!reason) return { ask: 'reason' };
    if (reason.length > REASON_MAX) return { refuse: 'reason_too_long' };
    const progress = statuses.find((s) => s.meaning === 'in_progress' && s.active);
    return { go: { p_status: progress?.key ?? 'in_progress', p_reason: reason } };
  }
  if (move.status.meaning === 'done' && t.open_action_items > 0) {
    if (!answers.closeItems) return { ask: 'close_items', count: t.open_action_items };
    return { go: { p_status: move.status.key, p_close_items: true } };
  }
  return { go: { p_status: move.status.key } };
}

// ---------------------------------------------------------------- quick add (V464, V466)

export const TITLE_MAX = 300;

export type QuickAddInput = { title: string; ownerId?: string; due?: string; partnerId?: string; projectId?: string };
export type QuickAddResult =
  { values: Record<string, unknown> } | { error: 'title_required' | 'title_too_long' | 'due_invalid' };

/**
 * The values quick add sends api.task_create: the title, a due day, a partner or a project. The owner is sent only
 * when it is someone else — left out, the database names it (V464: the project's owner, else the client's account
 * manager, else me). A project wins over a partner: the task takes the project's organisation (V194).
 */
export function quickAddValues(input: QuickAddInput, me: string): QuickAddResult {
  const title = input.title.trim();
  if (!title) return { error: 'title_required' };
  if (title.length > TITLE_MAX) return { error: 'title_too_long' };
  const values: Record<string, unknown> = { title };
  if (input.ownerId && input.ownerId !== me) values.owner_id = input.ownerId;
  if (input.due) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due)) return { error: 'due_invalid' };
    values.due_on = input.due;
  }
  if (input.projectId) values.project_id = input.projectId;
  else if (input.partnerId) values.partner_id = input.partnerId;
  return { values };
}

// ---------------------------------------------------------------- the checklist (V438, V190)

/** Who ticks an action item: the task's editors, the item's owner, or a helper on it (V190). */
export function canTick(
  item: { owner_id: string; helpers: string[] },
  task: Pick<TaskRow, 'can_edit'>,
  me: string,
): boolean {
  return task.can_edit || item.owner_id === me || item.helpers.includes(me);
}

// ---------------------------------------------------------------- refusals in words

/**
 * The catalog key for a task door's refusal. The task doors' own keys (`task.*`, `action_item.*`, and a day in the
 * future — QA-234) are worded under
 * `pages.tasks.errors.*` (builder D's part of the catalog); every other key is the shared `errors.*` one.
 */
export function refusalKey(key: string): string {
  const m = /^errors\.((?:task|action_item)\.[a-z_]+|person\.unavailable|common\.date_in_future)$/.exec(key);
  return m ? `pages.tasks.errors.${m[1]}` : key;
}
