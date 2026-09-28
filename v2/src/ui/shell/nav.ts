import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  CalendarCheck2,
  CheckSquare,
  ClipboardCheck,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  Settings,
  Sun,
  Wallet,
} from 'lucide-react';

/**
 * The drawer's page list. In P3-4 builder A's registry (`core/registry`) becomes the one source of
 * pages, access and Ctrl K; this file then reads from it instead of declaring them (V203). Keys equal
 * the registry page keys already, so nothing else changes. Order (oversight, 29 Sep): My day, Overview,
 * Partners, Pipeline, Projects, Tasks, Finance, KPIs, Reports, Appraisal; Settings at the foot (V80 adds
 * Overview and Pipeline).
 */
export type NavPage = { key: string; route: string; icon: LucideIcon; group: 'main' | 'foot' };

export const NAV_PAGES: NavPage[] = [
  { key: 'my-day', route: '/my-day', icon: Sun, group: 'main' },
  { key: 'overview', route: '/overview', icon: LayoutDashboard, group: 'main' },
  { key: 'partners', route: '/partners', icon: Briefcase, group: 'main' },
  { key: 'pipeline', route: '/pipeline', icon: KanbanSquare, group: 'main' },
  { key: 'projects', route: '/projects', icon: CalendarCheck2, group: 'main' },
  { key: 'tasks', route: '/tasks', icon: CheckSquare, group: 'main' },
  { key: 'finance', route: '/finance', icon: Wallet, group: 'main' },
  { key: 'kpis', route: '/kpis', icon: BarChart3, group: 'main' },
  { key: 'reports', route: '/reports', icon: FileText, group: 'main' },
  { key: 'appraisal', route: '/appraisal', icon: ClipboardCheck, group: 'main' },
  { key: 'settings', route: '/settings', icon: Settings, group: 'foot' },
];
