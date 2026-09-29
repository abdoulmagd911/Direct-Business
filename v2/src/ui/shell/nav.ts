import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CheckSquare,
  Circle,
  ClipboardCheck,
  FileText,
  FolderKanban,
  GitBranch,
  Handshake,
  LayoutDashboard,
  Settings,
  Sun,
  Target,
  Wallet,
} from 'lucide-react';
import type { Me } from '@/core/auth/me';
import { modules } from '@/core/registry';
import { canSee } from '../person';

/**
 * The drawer, the bottom bar and Ctrl K read the module registry (TECH-SPEC §2.3, V123): every page with
 * `nav.group === 'main'`, in `nav.order`, as one entry — or as the entries the page declares (Partners shows as
 * Clients and Suppliers & partners). A person sees an entry only with a level above none on its page (V125); a page
 * the database does not know is hidden, never guessed. Settings is the admin's door (owner, 29 Sep); everyone reaches
 * My profile from the profile chip.
 */
export type NavEntry = {
  /** `<page>` or `<page>:<entry>` — the drawer's own key. */
  key: string;
  page: string;
  route: string;
  label: string;
  icon: LucideIcon;
};

/** Icon names the modules use (lucide names) → components. An unknown name draws a plain circle, never nothing. */
const ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  'layout-dashboard': LayoutDashboard,
  'building-2': Building2,
  handshake: Handshake,
  'git-branch': GitBranch,
  'folder-kanban': FolderKanban,
  'check-square': CheckSquare,
  wallet: Wallet,
  target: Target,
  'file-text': FileText,
  'clipboard-check': ClipboardCheck,
  settings: Settings,
};

const iconOf = (name?: string) => (name && ICONS[name]) || Circle;

function build(): NavEntry[] {
  const out: { order: number; entry: NavEntry }[] = [];
  for (const m of modules)
    for (const p of m.pages ?? []) {
      if (p.nav?.group !== 'main') continue;
      const entries = p.nav.entries?.length
        ? p.nav.entries.map((e, i) => ({
            order: p.nav!.order + i / 100,
            entry: {
              key: `${p.key}:${e.key}`,
              page: p.key,
              route: e.route,
              label: e.label,
              icon: iconOf(e.icon ?? p.icon),
            },
          }))
        : [
            {
              order: p.nav.order,
              entry: { key: p.key, page: p.key, route: p.route, label: p.label, icon: iconOf(p.icon) },
            },
          ];
      out.push(...entries);
    }
  return out.sort((a, b) => a.order - b.order).map((x) => x.entry);
}

/** Every main entry the registry declares, in drawer order. */
export const NAV_ENTRIES: readonly NavEntry[] = build();

export const SETTINGS_ENTRY: NavEntry = {
  key: 'settings',
  page: 'settings',
  route: '/settings',
  label: 'nav.settings_home',
  icon: Settings,
};

/** The entries this person may open. */
export function navFor(me: Me): NavEntry[] {
  return NAV_ENTRIES.filter((e) => canSee(me, e.page));
}

/** Settings shows for admins only (owner, 29 Sep); My profile is reached from the profile chip. */
export function isAdmin(me: Me): boolean {
  return me.person.role?.is_admin === true;
}

/** Whether an entry is the one on screen: its path, and its `?view=` when it names one. */
export function isActiveEntry(entry: NavEntry, pathname: string, view: string | null): boolean {
  const [path, query] = entry.route.split('?');
  const onPath = pathname === path || pathname.startsWith(path + '/');
  if (!onPath) return false;
  const wanted = query ? new URLSearchParams(query).get('view') : null;
  return wanted ? view === wanted : true;
}
