import { modules } from '@/core/registry';

export type SettingsGroupDef = { slug: string; page: string; label: string; order: number };

/** The Settings groups the registry declares (`nav.group === 'settings'`), in order: `/settings/<slug>` ↔ `settings.<slug>`. */
export function settingsGroups(): SettingsGroupDef[] {
  const out: SettingsGroupDef[] = [];
  for (const m of modules)
    for (const p of m.pages ?? [])
      if (p.nav?.group === 'settings' && p.key.startsWith('settings.'))
        out.push({ slug: p.key.slice('settings.'.length), page: p.key, label: p.label, order: p.nav.order });
  return out.sort((a, b) => a.order - b.order);
}

/** The setting lists (`list: true`) whose settings page is this group. */
export function listsOf(pageKey: string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (const m of modules)
    for (const e of m.entities ?? []) if (e.list && e.page === pageKey) out.push({ key: e.key, label: e.label });
  return out;
}
