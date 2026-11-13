// The rules the Tasks screens apply (P5-2, first PR; builder D, V270–V275). Pure functions, so each is unit-tested
// and sabotaged (tests/unit/tasks, tests/sabotage/tasks.mjs). The database decides access and every write rule
// (#140, V189–V196); these only shape what is asked and how it reads on screen.
import { monthNumber } from '@/core/i18n/format';
import { assignablePeople } from '@/modules/org/pickers';
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

/**
 * My work (owned ∪ items ∪ helping — V195), Owned, Helping, Team (what the person may see: their departments, V96), and
 * Past work (V491, V506: never in the other four; where the grid pastes it — V276).
 */
export const SCOPES = ['my_work', 'owned', 'helping', 'team', 'past'] as const;
export type Scope = (typeof SCOPES)[number];

/**
 * Which tabs a phone shows (V630: few, big, nothing crowded). Someone who gives work (`tasks.assign`) sees My work and
 * Team; everyone else My work and Owned. The rest sit under the row's one More. A wide screen shows all five. The choice
 * is this one list, so a change of heart is a change here (no usage data yet, 11 Oct).
 */
export function phoneScopes(capabilities: readonly string[]): readonly Scope[] {
  return capabilities.includes('tasks.assign') ? ['my_work', 'team'] : ['my_work', 'owned'];
}
export const STATUS_CHIPS = ['open', 'blocked', 'done', 'cancelled'] as const;
export type StatusChipKey = (typeof STATUS_CHIPS)[number];
export const DUE_CHIPS = ['overdue', 'today', 'week', 'none'] as const;
export type DueChipKey = (typeof DUE_CHIPS)[number];

/** FIX-01: the list's sort, a menu where the columns are not sortable — newest, oldest, due day, title, priority. */
export const TASK_SORTS = ['newest', 'oldest', 'due', 'title', 'priority'] as const;
export type TaskSortKey = (typeof TASK_SORTS)[number];

/**
 * FIX-01 (D28): one list sorted, stably — the tie-break is always added-at (`logged_at`) then id, so two rows in the
 * same place never swap. Priority follows the settings list's own order (`sort`, low first); a task with no priority
 * sits after every prioritised one, and one whose key the list no longer names after those it does.
 */
export function sortRows<
  R extends { id: string; title: string; due_on: string | null; logged_at: string; priority: string | null },
>(
  rows: readonly R[],
  sort: TaskSortKey | undefined,
  priorities: readonly { key: string; sort: number | null }[] = [],
): R[] {
  if (!sort) return [...rows];
  const rank = new Map(priorities.map((p) => [p.key, p.sort ?? Number.MAX_SAFE_INTEGER]));
  const byAdded = (a: R, b: R) =>
    a.logged_at < b.logged_at ? 1 : a.logged_at > b.logged_at ? -1 : a.id < b.id ? -1 : 1;
  const byTitle = (a: R, b: R) => a.title.localeCompare(b.title) || byAdded(a, b);
  return [...rows].sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return a.logged_at < b.logged_at ? -1 : a.logged_at > b.logged_at ? 1 : a.id < b.id ? -1 : 1;
      case 'due':
        if (a.due_on === null && b.due_on === null) return byAdded(a, b);
        if (a.due_on === null) return 1;
        if (b.due_on === null) return -1;
        return a.due_on < b.due_on ? -1 : a.due_on > b.due_on ? 1 : byAdded(a, b);
      case 'title':
        return byTitle(a, b);
      case 'priority': {
        const ra = a.priority == null ? Number.MAX_SAFE_INTEGER : (rank.get(a.priority) ?? Number.MAX_SAFE_INTEGER);
        const rb = b.priority == null ? Number.MAX_SAFE_INTEGER : (rank.get(b.priority) ?? Number.MAX_SAFE_INTEGER);
        return ra - rb || byAdded(a, b);
      }
      default:
        return byAdded(a, b);
    }
  });
}

/** List / Board by status / Calendar by due day (§8 Tasks): one view of the same rows, kept in the address. */
export const LAYOUTS = ['list', 'board', 'calendar'] as const;
export type Layout = (typeof LAYOUTS)[number];

export type TaskFilters = {
  scope: Scope;
  layout?: Layout;
  /** The calendar's month, `YYYY-MM` (Riyadh's this month when absent). */
  month?: string;
  status?: StatusChipKey;
  due?: DueChipKey;
  partner?: string;
  project?: string;
  q?: string;
  /** Phase 5: the Starred saved view (starred tasks only) and the Need-help saved view (flagged tasks only). */
  starred?: boolean;
  escalated?: boolean;
  /** FIX-01: the owner filter (a person id) and the priority filter (a key of the priority list). */
  owner?: string;
  priority?: string;
  /** FIX-01: the list's sort; absent, the server's own order stands. */
  sort?: TaskSortKey;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[a-z][a-z0-9_-]*$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = <T extends string>(list: readonly T[], v: string | undefined): T | undefined =>
  v !== undefined && (list as readonly string[]).includes(v) ? (v as T) : undefined;

/** The list's state lives in the address (shareable, Back works): anything unknown is dropped, never guessed. */
export function parseFilters(params: Record<string, string | string[] | undefined>): TaskFilters {
  const partner = one(params.partner);
  const project = one(params.project);
  const q = one(params.q)?.trim().slice(0, 100);
  const owner = one(params.owner);
  const priority = one(params.priority);
  return {
    scope: oneOf(SCOPES, one(params.view)) ?? 'my_work',
    layout: oneOf(LAYOUTS, one(params.layout)),
    month: MONTH.test(one(params.month) ?? '') ? one(params.month) : undefined,
    status: oneOf(STATUS_CHIPS, one(params.status)),
    due: oneOf(DUE_CHIPS, one(params.due)),
    partner: partner && UUID.test(partner) ? partner : undefined,
    project: project && UUID.test(project) ? project : undefined,
    q: q || undefined,
    starred: one(params.starred) === '1' || undefined,
    escalated: one(params.escalated) === '1' || undefined,
    owner: owner && UUID.test(owner) ? owner : undefined,
    priority: priority && KEY.test(priority) ? priority : undefined,
    sort: oneOf(TASK_SORTS, one(params.sort)),
  };
}

/**
 * FIX-12 (D36(j)): a saved view's query, read back as this list's filters — anything unknown or out of shape is
 * dropped, never guessed. A view saved from this list keeps its whole query, so opening it replaces the filters
 * on screen, not just the scope and the flags.
 */
export function queryFilters(query: Record<string, unknown> | undefined): Partial<TaskFilters> {
  if (!query) return {};
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) || undefined : undefined;
  return {
    scope: typeof query.scope === 'string' ? oneOf(SCOPES, query.scope) : undefined,
    layout: typeof query.layout === 'string' ? oneOf(LAYOUTS, query.layout) : undefined,
    month: typeof query.month === 'string' && MONTH.test(query.month) ? query.month : undefined,
    status: typeof query.status === 'string' ? oneOf(STATUS_CHIPS, query.status) : undefined,
    due: typeof query.due === 'string' ? oneOf(DUE_CHIPS, query.due) : undefined,
    partner: typeof query.partner === 'string' && UUID.test(query.partner) ? query.partner : undefined,
    project: typeof query.project === 'string' && UUID.test(query.project) ? query.project : undefined,
    q,
    starred: query.starred === true || undefined,
    escalated: query.escalated === true || undefined,
    owner: typeof query.owner === 'string' && UUID.test(query.owner) ? query.owner : undefined,
    priority: typeof query.priority === 'string' && KEY.test(query.priority) ? query.priority : undefined,
    sort: typeof query.sort === 'string' ? oneOf(TASK_SORTS, query.sort) : undefined,
  };
}

/** The address of the list with one change made (a chip set, dropped, or the view switched). */
export function filtersHref(f: TaskFilters, change: Partial<TaskFilters> = {}): string {
  const next = { ...f, ...change };
  const p = new URLSearchParams();
  if (next.scope !== 'my_work') p.set('view', next.scope);
  if (next.layout && next.layout !== 'list') p.set('layout', next.layout);
  if (next.layout === 'calendar' && next.month) p.set('month', next.month);
  if (next.status) p.set('status', next.status);
  if (next.due) p.set('due', next.due);
  if (next.partner) p.set('partner', next.partner);
  if (next.project) p.set('project', next.project);
  if (next.q) p.set('q', next.q);
  if (next.starred) p.set('starred', '1');
  if (next.escalated) p.set('escalated', '1');
  if (next.owner) p.set('owner', next.owner);
  if (next.priority) p.set('priority', next.priority);
  if (next.sort) p.set('sort', next.sort);
  const s = p.toString();
  return s ? `/tasks?${s}` : '/tasks';
}

/** What api.tasks is asked for the view (V195's filter); `listFilter` adds what the list asks on top of it. */
export function apiFilter(f: TaskFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {
    scope: f.scope === 'owned' ? 'mine' : f.scope === 'team' || f.scope === 'past' ? 'all' : 'my_work',
  };
  if (f.scope === 'past') out.past_work = true;
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
  if (f.owner) out.owner_id = f.owner;
  if (f.q) out.q = f.q;
  if (f.starred) out.starred = true;
  if (f.escalated) out.escalated = true;
  return out;
}

/**
 * What the Tasks list asks api.tasks (owner 13 Nov): the view's filter and every chip — Helping, the due window, the
 * priority — and the sort, so the door answers the view itself. The list reads one page of 200: a chip judged in the
 * browser lost every task past that page and counted the unfiltered total (work.task_list answers them since
 * 20261113110000). `keepRow` judges the same rules on the rows, so the two always agree.
 */
export function listFilter(f: TaskFilters): Record<string, unknown> {
  const out = apiFilter(f);
  if (f.scope === 'helping') out.scope = 'helping';
  if (f.due === 'today' || f.due === 'week' || f.due === 'none') out.due = f.due;
  if (f.priority) out.priority = f.priority;
  if (f.sort) out.sort = f.sort;
  return out;
}

/** The filter's rules judged on the rows (the door answers the same since 20261113110000): Helping is My work I do not
 * own; due today, the next seven days (the chip "Next 7 days"), or none; the Starred and Need-help views keep only
 * their own rows; FIX-01's priority filter keeps only its key. */
export function keepRow(row: TaskRow, f: TaskFilters, me: string, today: string): boolean {
  if (f.scope === 'helping' && row.owner_id === me) return false;
  if (f.starred && !row.starred) return false;
  if (f.escalated && !row.escalated) return false;
  if (f.priority && row.priority !== f.priority) return false;
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
 * What a chosen move needs before it is sent (V401, V191): Blocked needs its reason, and so does Cancelled, so a
 * cancelled task closes with its why recorded instead of a stray note; Done with open action items asks
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
  if (move.kind === 'status' && move.status.meaning === 'cancelled') {
    const reason = answers.reason?.trim() ?? '';
    if (!reason) return { ask: 'reason' };
    if (reason.length > REASON_MAX) return { refuse: 'reason_too_long' };
    return { go: { p_status: move.status.key, p_reason: reason } };
  }
  if (move.status.meaning === 'done' && t.open_action_items > 0) {
    if (!answers.closeItems) return { ask: 'close_items', count: t.open_action_items };
    return { go: { p_status: move.status.key, p_close_items: true } };
  }
  return { go: { p_status: move.status.key } };
}

// ---------------------------------------------------------------- quick add (V464, V466)

export const TITLE_MAX = 300;

export type QuickAddInput = {
  title: string;
  ownerId?: string;
  due?: string;
  partnerId?: string;
  projectId?: string;
  /** FIX-05 (F021): the task's priority, a key of the priority list (high / medium / low …). */
  priority?: string;
  /** FIX-05 (F023): free notes, shown on the record as Notes. */
  notes?: string;
};
export type QuickAddResult =
  | { values: Record<string, unknown> }
  | { error: 'title_required' | 'title_too_long' | 'due_invalid' | 'owner_required' };

/**
 * The Owner picker on a task being created (FIX-05, F024; P1b, own tasks only): the task is the creator's own work,
 * so anyone who may create one may pick its owner — with `tasks.assign`, or in a team without it. Giving work to
 * others still needs `tasks.assign` once the task exists and belongs to someone else; the database refuses that
 * (work.tasks_assign), and backfilling for others stays gated (PastWorkPanel).
 */
export function mayPickOwnerOnCreate(canAssign: boolean, myTeam: string | null): boolean {
  return canAssign || myTeam !== null;
}

/**
 * Quick add's Owner choice (V277). A task's team is its owner's, else mine (V194, V464), so someone in no team — the
 * owner's admin account, by design (V444) — is offered **no Default**: they must pick an owner, and only people in a
 * team are offered, since anyone else would leave the task with no team. Everyone else keeps Default and every
 * assignable person (V465).
 */
export function quickAddOwners<P extends { team_id: string | null; account?: string | null }>(
  myTeam: string | null,
  people: readonly P[],
): { offerDefault: boolean; people: P[] } {
  const offerDefault = myTeam !== null;
  const assignable = assignablePeople(people);
  return { offerDefault, people: offerDefault ? assignable : assignable.filter((p) => p.team_id !== null) };
}

/**
 * Someone in no team who may not give tasks to others (no `tasks.assign`) can neither own a task — a task's team is its
 * owner's — nor pick another owner (QA-521): Quick add and Past work say so in one line, with no picker and no save,
 * the way a locked area says why (V605 (5)).
 */
export const noTeamToWorkIn = (myTeam: string | null, canAssign: boolean): boolean => myTeam === null && !canAssign;

/** Quick add's refusal in words: the database's "needs a team" (a race with a team change) reads as "Pick an owner". */
export function quickAddRefusalKey(key: string): string {
  return key === 'errors.task.team_required' ? 'pages.tasks.add.owner_required' : refusalKey(key);
}

/**
 * A due day as typed (V286): "20261020", "2026-10-20", "2026/10/20" or day first "20/10/2026", in Latin or Arabic-Indic
 * digits; a real Gregorian day between 2000 and 2099 comes back as "2026-10-20", anything else as null. A text box, not
 * the browser's date box: the date box orders its parts by the computer's own settings, so typed digits landed in the
 * wrong parts and left junk ("1020-02-02").
 */
export function parseDueDay(typed: string): string | null {
  const s = typed.trim().replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  const ymd = /^(\d{4})(\d{2})(\d{2})$/.exec(s) ?? /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  const dmy = ymd ? null : /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  // the day as the app writes it back ("20 Oct 2026", Arabic's own month word too)
  const word = ymd || dmy ? null : /^(\d{1,2})\s+(\S+?)\.?,?\s+(\d{4})$/.exec(s);
  const wordMonth = word ? monthNumber(word[2]!) : null;
  const parts = ymd
    ? [ymd[1], ymd[2], ymd[3]]
    : dmy
      ? [dmy[3], dmy[2], dmy[1]]
      : word && wordMonth
        ? [word[3], String(wordMonth), word[1]]
        : null;
  if (!parts) return null;
  const [y, mo, d] = parts;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The values quick add sends api.task_create: the title, a due day, a partner or a project, a priority and notes.
 * The owner is sent only when it is someone else — left out, the database names it (V464: the project's owner, else
 * the client's account manager, else me). A project wins over a partner: the task takes the project's organisation
 * (V194). With `ownerRequired` (no Default, V277) an owner must be picked.
 */
export function quickAddValues(
  input: QuickAddInput,
  me: string,
  opts: { ownerRequired?: boolean } = {},
): QuickAddResult {
  const title = input.title.trim();
  if (!title) return { error: 'title_required' };
  if (title.length > TITLE_MAX) return { error: 'title_too_long' };
  if (opts.ownerRequired && !input.ownerId) return { error: 'owner_required' };
  const values: Record<string, unknown> = { title };
  if (input.ownerId && input.ownerId !== me) values.owner_id = input.ownerId;
  if (input.due) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due)) return { error: 'due_invalid' };
    values.due_on = input.due;
  }
  if (input.projectId) values.project_id = input.projectId;
  else if (input.partnerId) values.partner_id = input.partnerId;
  if (input.priority) values.priority = input.priority;
  const notes = input.notes?.trim();
  if (notes) values.notes = notes;
  return { values };
}

// ---------------------------------------------------------------- Escalate (V401)

/** Whom a task is escalated to: someone else who can be given work (V465) — never me, never the admin or test account. */
export function escalateTargets<P extends { id: string; account?: string | null }>(
  people: readonly P[],
  me: string,
): P[] {
  return assignablePeople(people).filter((p) => p.id !== me);
}

/** What api.escalate is sent: a person and a note — both required, and never myself (the door refuses the same). */
export function escalateValues(
  input: { to?: string; note: string },
  me: string,
): { values: { p_to: string; p_note: string } } | { error: 'to_required' | 'note_required' | 'to_yourself' } {
  if (!input.to) return { error: 'to_required' };
  if (input.to === me) return { error: 'to_yourself' };
  const note = input.note.trim();
  if (!note) return { error: 'note_required' };
  return { values: { p_to: input.to, p_note: note } };
}

// ---------------------------------------------------------------- Delegate (Phase 1, CUJ 5)

// Delegate picks from the same people as Escalate (V465) and sends the same shape — a person and a note, both
// required, never myself — to api.task_delegate instead of api.escalate.
export const delegateTargets = escalateTargets;
export const delegateValues = escalateValues;

// ---------------------------------------------------------------- the achievement strip (Phase 1, CUJ 7)

/**
 * The strip never appears on a task closed before this build ships: the Phase 1 migration's timestamp, 12:00 Riyadh
 * on 7 November 2026. A task closed after that, done (a cancelled task is not an achievement), nudge-eligible
 * (linked to a partner, or top priority "High" — "has a KPI" is dropped, no task→KPI link exists), with no
 * achievement linked yet, shows the strip until it is logged or dismissed.
 */
export const ACHIEVEMENT_STRIP_CUTOVER = '2026-11-07T09:00:00.000Z';

export type AchievementStrip = 'show' | 'dismissed' | 'hide';

export function achievementStrip(task: {
  meaning: Meaning;
  closed_at: string | null;
  partner_id: string | null;
  priority: string | null;
  dismissed_from_nudge: boolean;
  has_achievement: boolean;
}): AchievementStrip {
  if (task.meaning !== 'done') return 'hide';
  if (task.closed_at === null || Number.isNaN(Date.parse(task.closed_at))) return 'hide';
  if (Date.parse(task.closed_at) < Date.parse(ACHIEVEMENT_STRIP_CUTOVER)) return 'hide';
  if (task.partner_id === null && task.priority !== 'high') return 'hide';
  if (task.has_achievement) return 'hide';
  return task.dismissed_from_nudge ? 'dismissed' : 'show';
}

// ---------------------------------------------------------------- the team's load (V91)

/** The load figures show on the Team view, to someone who gives work to others (`tasks.assign`): a manager or a head. */
export function showsTeamLoad(scope: Scope, capabilities: readonly string[]): boolean {
  return scope === 'team' && capabilities.includes('tasks.assign');
}

/** The load in my departments, the most overdue first, then the most open work, then by name — who needs help leads. */
export function byLoad<L extends { overdue: number; open_tasks: number; full_name_en: string }>(
  rows: readonly L[],
): L[] {
  return [...rows].sort(
    (a, b) => b.overdue - a.overdue || b.open_tasks - a.open_tasks || a.full_name_en.localeCompare(b.full_name_en),
  );
}

// ---------------------------------------------------------------- the board and the calendar (§8 Tasks)

/**
 * The board: one column per status, in the settings' order — every active status, and a retired one only while a task
 * still holds it (V161). Every row lands in exactly one column, so the board counts what the list counts.
 */
export function boardColumns<R extends { status: string }>(
  rows: readonly R[],
  statuses: readonly TaskStatus[],
): { status: TaskStatus | null; key: string; rows: R[] }[] {
  const held = new Set(rows.map((r) => r.status));
  const shown = [...statuses].filter((s) => s.active || held.has(s.key)).sort((a, b) => a.sort - b.sort);
  const columns = shown.map((s) => ({ status: s as TaskStatus | null, key: s.key, rows: [] as R[] }));
  const byKey = new Map(columns.map((c) => [c.key, c]));
  for (const r of rows) {
    let c = byKey.get(r.status);
    if (!c) {
      // a status the settings list no longer names still gets its column: never a dropped task
      c = { status: null, key: r.status, rows: [] };
      byKey.set(r.status, c);
      columns.push(c);
    }
    c.rows.push(r);
  }
  return columns;
}

/** The calendar's month: the address's, else Riyadh's this month. */
export const monthOf = (month: string | undefined, today: string): string => month ?? today.slice(0, 7);

/** The month before or after, `YYYY-MM`. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * The month as whole weeks, Sunday first (Riyadh's working week starts Sunday): each day `YYYY-MM-DD`, and whether it
 * is in the month. Calendar arithmetic only, the same in every time zone.
 */
export function monthWeeks(month: string): { day: string; inMonth: boolean }[][] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const weeks: { day: string; inMonth: boolean }[][] = [];
  const d = new Date(start);
  do {
    const week: { day: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ day: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === m - 1 });
      d.setUTCDate(d.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (d.getUTCMonth() === m - 1);
  return weeks;
}

/** Tasks by their due day; those with none are listed apart, never placed on a guessed day. */
export function byDueDay<R extends { due_on: string | null }>(
  rows: readonly R[],
): { days: Map<string, R[]>; undated: R[] } {
  const days = new Map<string, R[]>();
  const undated: R[] = [];
  for (const r of rows) {
    if (!r.due_on) undated.push(r);
    else days.set(r.due_on, [...(days.get(r.due_on) ?? []), r]);
  }
  return { days, undated };
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
  const m = /^errors\.((?:task|action_item|escalation)\.[a-z_]+|person\.unavailable|common\.date_in_future)$/.exec(key);
  return m ? `pages.tasks.errors.${m[1]}` : key;
}
// ---------------------------------------------------------------- test tasks may show Remove

/**
 * A task may show Remove only when it is a test task: its owner or its creator is a TEST
 * user (core.person.is_test). The server refuses anything else, so this only shapes the
 * screen; it never decides access. Real tasks never get the control, whatever the screen.
 */
export function taskIsTestOwned(
  task: { owner_id: string | null; created_by?: string | null },
  people: { id: string; is_test?: boolean }[],
): boolean {
  const test = new Set(people.filter((p) => p.is_test === true).map((p) => p.id));
  return (
    (task.owner_id !== null && test.has(task.owner_id)) ||
    (task.created_by !== null && task.created_by !== undefined && test.has(task.created_by))
  );
}
