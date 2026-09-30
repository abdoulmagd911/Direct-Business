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
  History,
  LayoutDashboard,
  Settings,
  Sun,
  Target,
  Wallet,
} from 'lucide-react';
import type { Me } from '@/core/auth/me';
import { modules } from '@/core/registry';
import type { PageDef } from '@/core/registry/define-module';
import { canSee } from '../person';

/**
 * The drawer, the bottom bar and Ctrl K read the module registry (TECH-SPEC §2.3, V123): every page with
 * `nav.group === 'main'`, in `nav.order`, as one entry — or as the entries the page declares. Which of them make the
 * menu is the employee view's rule (V217), and it lives here alone: `navFor`. A page the database does not know is
 * hidden, never guessed. Settings is the admin's door at the foot (owner, 29 Sep); everyone reaches My profile from the
 * profile chip.
 */
export type NavEntry = {
  /** `<page>` or `<page>:<entry>` — the drawer's own key. */
  key: string;
  page: string;
  route: string;
  label: string;
  icon: LucideIcon;
  tier: 'work' | 'manage';
  /** A manage page a Viewer still gets (KPIs, Reports). */
  viewer: boolean;
  /** A manage page for Head and Admin only (Overview, Activity). */
  headUp: boolean;
  /** The main page this one is a tab of (Suppliers → Clients); never in the menu itself. */
  tabOf: string | null;
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
  history: History,
  settings: Settings,
};

const iconOf = (name?: string) => (name && ICONS[name]) || Circle;

// A page that names no tier is a manage page: nothing new reaches a Member's menu by default (simplicity gate, item 4).
const menuOf = (nav: NonNullable<PageDef['nav']>) => ({
  tier: nav.tier ?? ('manage' as const),
  viewer: nav.viewer === true,
  headUp: nav.from === 'head',
  tabOf: nav.tabOf ?? null,
});

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
              ...menuOf(p.nav!),
            },
          }))
        : [
            {
              order: p.nav.order,
              entry: {
                key: p.key,
                page: p.key,
                route: p.route,
                label: p.label,
                icon: iconOf(p.icon),
                ...menuOf(p.nav),
              },
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
  tier: 'manage',
  viewer: false,
  headUp: true,
  tabOf: null,
};

/** The roles whose menu carries the manage pages (V217). */
const MANAGE_ROLES = ['manager', 'head', 'admin'];

/** Manager, Head and Admin: the manage tier, whose menu carries the manage pages (V217). */
export function isManageTier(me: Me): boolean {
  const role = me.person.role;
  return !!role && (role.is_admin || MANAGE_ROLES.includes(role.key));
}

/** Whether an entry is in this person's menu: work pages at any level above none; manage pages by role (V217). */
export function inMenu(me: Me, e: NavEntry): boolean {
  if (!canSee(me, e.page) || e.tabOf) return false;
  if (e.tier === 'work') return true;
  const role = me.person.role;
  if (!role) return false;
  if (role.is_admin) return true;
  if (role.key === 'viewer') return e.viewer;
  if (e.headUp) return role.key === 'head';
  return MANAGE_ROLES.includes(role.key);
}

/** The menu: the drawer's main list, the phone bar's first four and More's rest (V217). */
export function navFor(me: Me): NavEntry[] {
  return NAV_ENTRIES.filter((e) => inMenu(me, e));
}

/** The menu with Settings at its foot for admins — what the phone bar and More divide between them. */
export function menuFor(me: Me): NavEntry[] {
  return [...navFor(me), ...(isAdmin(me) ? [SETTINGS_ENTRY] : [])];
}

/**
 * The phone bar (V217): the menu's first four, then More — which holds the rest, My profile and Sign out. A Viewer
 * whose four fill the bar with nothing left has no More; the profile is on the avatar (brief B).
 */
export function barFor(me: Me): { bar: NavEntry[]; rest: NavEntry[]; more: boolean } {
  const menu = menuFor(me);
  const bar = menu.slice(0, 4);
  const rest = menu.slice(4);
  return { bar, rest, more: rest.length > 0 || me.person.role?.key !== 'viewer' };
}

/**
 * Every main page this person may open, in or out of the menu — Ctrl K's pages. Out of the menu is never locked: the
 * address, search and links keep working at the person's level (V217).
 */
export function reachableFor(me: Me): NavEntry[] {
  return [...NAV_ENTRIES.filter((e) => canSee(me, e.page)), ...(isAdmin(me) ? [SETTINGS_ENTRY] : [])];
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
