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

export interface PageDef {
  /** Dotted lower-case key, e.g. `tasks`, `settings.org`. */
  key: string;
  route: string;
  /** Catalog key of the page's name, e.g. `nav.tasks`. */
  label: string;
  icon?: string;
  /** In the drawer (main pages) or in Settings' own list. */
  nav?: { group: 'main' | 'settings'; order: number };
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

export interface ModuleDef {
  key: string;
  pages?: PageDef[];
  capabilities?: CapabilityDef[];
  settings?: SettingDef[];
}

export function defineModule(def: ModuleDef): ModuleDef {
  return def;
}
