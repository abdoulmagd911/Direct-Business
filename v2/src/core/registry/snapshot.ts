// The registry as the database holds it — the shape `supabase/registry.json` keeps and REG-01 compares with a
// database built from zero. Building it also refuses a registry that could not be synced: a duplicate key, a
// capability or setting under a page that does not exist, a default level the page does not offer, a default value
// its own schema refuses.
import { z } from 'zod';
import { LEVELS, ROLES, type Level, type ModuleDef } from './define-module';
import { ROLE_SEED } from './roles';

export interface Snapshot {
  roles: { key: string; name_en: string; name_ar: string; sort: number; is_admin: boolean }[];
  pages: {
    key: string;
    module: string;
    route: string;
    nav_group: string | null;
    nav_order: number | null;
    levels: Level[];
  }[];
  capabilities: { key: string; page: string }[];
  settings: {
    key: string;
    group: string;
    label: string;
    schema: unknown;
    default: unknown;
    effective_dated: boolean;
  }[];
  entities: {
    key: string;
    table: string;
    page: string | null;
    owners: string | null;
    list: boolean;
    private: boolean;
    visible: string | null;
    level: string | null;
    history: boolean;
  }[];
  role_levels: { role: string; page: string; level: Level }[];
  role_capabilities: { role: string; capability: string; granted: boolean }[];
}

const KEY = /^[a-z][a-z0-9_.]*$/;
const SETTING_KEY = /^[a-z][a-z0-9_]*\.[a-z0-9_.]+$/;
const byKey = <T extends { key: string }>(a: T, b: T) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export function snapshotOf(modules: readonly ModuleDef[]): Snapshot {
  const problems: string[] = [];
  const seen = new Set<string>();
  const once = (kind: string, key: string) => {
    if (seen.has(`${kind}:${key}`)) problems.push(`${kind} "${key}" is declared twice`);
    seen.add(`${kind}:${key}`);
  };

  const pages: Snapshot['pages'] = [];
  const roleLevels: Snapshot['role_levels'] = [];
  for (const m of modules)
    for (const p of m.pages ?? []) {
      once('page', p.key);
      if (!KEY.test(p.key)) problems.push(`page "${p.key}": a key is lower case, digits, _ and .`);
      const levels = [...(p.levels ?? LEVELS)].sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b));
      pages.push({
        key: p.key,
        module: m.key,
        route: p.route,
        nav_group: p.nav?.group ?? null,
        nav_order: p.nav?.order ?? null,
        levels,
      });
      const top = levels[levels.length - 1] as Level;
      for (const role of ROLES) {
        const level: Level = role === 'admin' ? top : (p.defaults[role] ?? 'none');
        if (!levels.includes(level)) problems.push(`page "${p.key}": role ${role} starts at ${level}, not offered`);
        roleLevels.push({ role, page: p.key, level });
      }
    }
  const pageKeys = new Set(pages.map((p) => p.key));

  const capabilities: Snapshot['capabilities'] = [];
  const roleCaps: Snapshot['role_capabilities'] = [];
  for (const m of modules)
    for (const c of m.capabilities ?? []) {
      once('capability', c.key);
      if (!KEY.test(c.key)) problems.push(`capability "${c.key}": a key is lower case, digits, _ and .`);
      if (!pageKeys.has(c.page)) problems.push(`capability "${c.key}": no page "${c.page}"`);
      capabilities.push({ key: c.key, page: c.page });
      for (const role of ROLES)
        roleCaps.push({ role, capability: c.key, granted: role === 'admin' || c.defaults[role] === true });
    }

  const settings: Snapshot['settings'] = [];
  for (const m of modules)
    for (const s of m.settings ?? []) {
      once('setting', s.key);
      if (!SETTING_KEY.test(s.key)) problems.push(`setting "${s.key}": a key is <area>.<name>`);
      if (!pageKeys.has(s.group)) problems.push(`setting "${s.key}": no page "${s.group}"`);
      const ok = s.schema.safeParse(s.default);
      if (!ok.success) problems.push(`setting "${s.key}": its default does not fit its schema`);
      settings.push({
        key: s.key,
        group: s.group,
        label: s.label,
        schema: z.toJSONSchema(s.schema),
        default: s.default,
        effective_dated: s.effectiveDated === true,
      });
    }

  const entities: Snapshot['entities'] = [];
  const tables = new Set<string>();
  for (const m of modules)
    for (const e of m.entities ?? []) {
      once('entity', e.key);
      if (!/^[a-z][a-z0-9_]*$/.test(e.key)) problems.push(`entity "${e.key}": a key is lower case, digits and _`);
      if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(e.table))
        problems.push(`entity "${e.key}": the table is schema.table`);
      if (tables.has(e.table)) problems.push(`entity "${e.key}": ${e.table} is already an entity`);
      tables.add(e.table);
      if (e.page !== null && !pageKeys.has(e.page)) problems.push(`entity "${e.key}": no page "${e.page}"`);
      if (e.owners !== undefined && !/^([a-z][a-z0-9_]*|[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)$/.test(e.owners))
        problems.push(`entity "${e.key}": owners is a column or schema.function`);
      if (e.list && !(e.page ?? '').startsWith('settings.'))
        problems.push(`entity "${e.key}": a setting list is edited on a settings page`);
      if (e.visible !== undefined && !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(e.visible))
        problems.push(`entity "${e.key}": visible is a schema.function`);
      if (e.level !== undefined && !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(e.level))
        problems.push(`entity "${e.key}": level is a schema.function`);
      entities.push({
        key: e.key,
        table: e.table,
        page: e.page,
        owners: e.owners ?? null,
        list: e.list ?? false,
        private: e.private ?? false,
        visible: e.visible ?? null,
        level: e.level ?? null,
        history: e.history ?? false,
      });
    }

  if (problems.length) throw new Error(`the registry cannot be synced:\n  ${problems.join('\n  ')}`);
  return {
    roles: ROLE_SEED.map((r) => ({ ...r })),
    pages: pages.sort(byKey),
    capabilities: capabilities.sort(byKey),
    settings: settings.sort(byKey),
    entities: entities.sort(byKey),
    role_levels: roleLevels.sort((a, b) => `${a.role} ${a.page}`.localeCompare(`${b.role} ${b.page}`, 'en')),
    role_capabilities: roleCaps.sort((a, b) =>
      `${a.role} ${a.capability}`.localeCompare(`${b.role} ${b.capability}`, 'en'),
    ),
  };
}
