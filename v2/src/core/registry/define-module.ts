// The module contract (TECH-SPEC §2.3): every module declares itself once, in its own `module.ts`, with
// defineModule({...}). This is the only place a page, a capability or a setting is declared; the drawer, the access
// matrix, the database (through `pnpm registry:sync`) and Ctrl K all read it. The old app registered a page in three
// places and a finance page sat unreachable for two days — here a page missing from the database fails CI (REG-01).
//
// Module files stay plain data: no React, no server code, relative imports only — Node reads them to sync.
import type { z } from 'zod';

export const LEVELS = ['none', 'view', 'own', 'full'] as const;
export type Level = (typeof LEVELS)[number];

/** The five roles a person can hold; a role only sets starting levels (D2). */
export const ROLES = ['admin', 'head', 'manager', 'member', 'viewer'] as const;
export type RoleKey = (typeof ROLES)[number];

export interface NavEntryDef {
  /** Distinct within the page, e.g. `clients`. */
  key: string;
  /** Catalog key of the entry's name, e.g. `nav.clients`. */
  label: string;
  route: string;
  icon?: string;
}

export interface PageDef {
  /** Dotted lower-case key, e.g. `tasks`, `settings.org`. */
  key: string;
  route: string;
  /** Catalog key of the page's name, e.g. `nav.tasks`. */
  label: string;
  icon?: string;
  /**
   * In the drawer (main pages) or in Settings' own list. A page may show as several drawer entries (`entries`), each
   * its own label and route into the same page — the owner's Clients and Suppliers & partners (29 Sep) are two doors
   * into Partners; access stays the page's. Without `entries`, the page is one entry with its own label and route.
   */
  nav?: {
    group: 'main' | 'settings';
    order: number;
    entries?: NavEntryDef[];
    /**
     * The menu rule (the employee view, V217): a `work` page is in the menu at any level above none; a `manage` page
     * only for Manager, Head and Admin — and for a Viewer when `viewer` is set. `from: 'head'` keeps a manage page to
     * Head and Admin. Out of the menu is never locked: the address, Ctrl K and links keep working at the person's level.
     */
    tier?: 'work' | 'manage';
    viewer?: boolean;
    from?: 'head';
    /** Shown as a tab of another main page, never in the menu itself (Suppliers is the second tab of Clients). */
    tabOf?: string;
  };
  /** The page's screen is built: its Create item may show, and it no longer says "Being built." (set by whoever lands it). */
  built?: boolean;
  /** The levels this page offers (default all four). */
  levels?: readonly Level[];
  /** Starting level per role; a role not named starts at `none`. The admin role is Full everywhere regardless. */
  defaults: Partial<Record<RoleKey, Level>>;
}

export interface CapabilityDef {
  /** `<module>.<action>`, e.g. `tasks.assign`. */
  key: string;
  /** The page it is shown under in the access matrix. */
  page: string;
  label: string;
  /** Roles that start with it (the admin role always has it). */
  defaults: Partial<Record<RoleKey, boolean>>;
}

export interface SettingDef {
  /** `<area>.<name>`, e.g. `auth.device_idle_days`. */
  key: string;
  /** The Settings page it belongs to. */
  group: string;
  label: string;
  schema: z.ZodType;
  default: unknown;
  /** A change takes a date from which it applies (§3.2). */
  effectiveDated?: boolean;
}

export interface EntityDef {
  /** Short key for record links (`/r/<key>/<id>`) and history, e.g. `person`. */
  key: string;
  /** The table, schema-qualified. Every change-logged table is an entity (ENT-01). */
  table: string;
  /** The page whose Full lets a manager undo any change to it (§3.3); null: only its author or an admin. */
  page: string | null;
  label: string;
  /**
   * Who is told when someone else changes the record (§3.3): a column of the row holding a person's id
   * (`person_id`, `head_person_id`), or a schema-qualified SQL function `(uuid) → setof uuid` (`work.task_owners`).
   */
  owners?: string;
  /**
   * A setting list (§3.0 LIST, V76): key, name_en and name_ar (both required), sort, active — read by everyone through
   * api.list and changed only through api.list_save, with Full on its page (a settings page). Nothing else is.
   */
  list?: boolean;
  /**
   * Private (V96): only its own `visible` rule, its owners or an admin let a person see a record — Own on its page never
   * counts as View (appraisals).
   */
  private?: boolean;
  /** Its own visibility rule: a schema-qualified SQL function `(record uuid, person uuid) → boolean`. */
  visible?: string;
  /**
   * How a person's level on one record is found (V98): a function `schema.fn(table text, id uuid, person uuid)` returning
   * a level — an organisation's records go by the pages of its sides. Without one, the level on `page`.
   */
  level?: string;
  /**
   * A record of what happened, never rewritten (a side's status changes — V62): retiring a list entry leaves it on
   * these rows and counts them apart (V161).
   */
  history?: boolean;
  /**
   * Its own `visible` rule alone decides who sees a record — admins and owners included (V454, V183): a private My day
   * note is its author's alone. Needs `visible`.
   */
  ruleOnly?: boolean;
}

export interface ModuleDef {
  key: string;
  pages?: PageDef[];
  capabilities?: CapabilityDef[];
  settings?: SettingDef[];
  entities?: EntityDef[];
}

export function defineModule(def: ModuleDef): ModuleDef {
  return def;
}
