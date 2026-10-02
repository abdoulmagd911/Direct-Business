// The shapes the task doors answer in (P5-1, #140; V195): api.tasks(filter) rows and api.task(id). Builder A owns the
// doors; these types only name what the Tasks screens read of them.

export type Meaning = 'not_started' | 'in_progress' | 'done' | 'cancelled';

/** One row of api.tasks (work.task_row) — the task and its flags, judged today (V400). */
export type TaskRow = {
  id: string;
  number: string;
  title: string;
  owner_id: string | null;
  team_id: string;
  priority: string | null;
  priority_en: string | null;
  priority_ar: string | null;
  executive_directive: boolean;
  status: string;
  status_en: string;
  status_ar: string;
  meaning: Meaning;
  type: string | null;
  type_en: string | null;
  type_ar: string | null;
  work_type: 'client' | 'internal';
  start_on: string | null;
  due_on: string | null;
  partner_id: string | null;
  project_id: string | null;
  origin: string;
  happened_on: string;
  logged_at: string;
  closed_at: string | null;
  blocked_reason: string | null;
  blocked_on: string | null;
  version: number;
  can_edit: boolean;
  open_action_items: number;
  helpers: string[];
  past_work: boolean;
  needs_owner: boolean;
  overdue: boolean;
  stale: boolean;
  blocked: boolean;
  logged_late: boolean;
  backfilled: boolean;
  last_activity_on: string | null;
};

export type TaskList = { rows: TaskRow[]; total: number; more: boolean };

export type ActionItem = {
  id: string;
  text: string;
  owner_id: string;
  due_on: string | null;
  done_on: string | null;
  done_by: string | null;
  sort: number;
  happened_on: string;
  version: number;
  overdue: boolean;
  helpers: string[];
};

export type StatusChange = {
  from: string | null;
  to: string;
  meaning: Meaning;
  blocked: boolean;
  reason: string | null;
  happened_on: string;
  logged_at: string;
  by: string;
};

/** api.task(id): the row, and what hangs on it. */
export type TaskDetail = TaskRow & {
  notes: string | null;
  assigned_by: string | null;
  closed_by: string | null;
  created_by: string;
  action_items: ActionItem[];
  refs: { id: string; system: string; system_en: string; system_ar: string | null; value: string }[];
  contacts: string[];
  status_history: StatusChange[];
};

/** A task status as the settings list holds it (api.list('task_status')): names editable, meaning locked (V401). */
export type TaskStatus = {
  id: string;
  key: string;
  name_en: string;
  name_ar: string;
  sort: number;
  active: boolean;
  meaning: Meaning;
  is_default: boolean;
};

/** A name to pick: an organisation (api.partners) or a project (api.projects). */
export type NamePick = { id: string; name_en: string; name_ar: string | null; number: string };
