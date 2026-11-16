import { Building2, Circle, ListChecks, SlidersHorizontal, Target, Users, Wallet, type LucideIcon } from 'lucide-react';

/** The line icon of each Settings group (V21: one icon in a peach circle per entry). An unknown group draws a plain
 *  circle, never nothing. */
const ICONS: Record<string, LucideIcon> = {
  org: Users,
  partners: Building2,
  performance: Target,
  finance: Wallet,
  work: ListChecks,
  app: SlidersHorizontal,
};

export function settingsIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? Circle;
}

/** A phone's browser, by what it says of itself: the Settings address opens the one list there (13 Nov board), and
 *  People & access everywhere else. A narrow desktop window is not a phone — it keeps the group row above the page. */
export function isPhoneBrowser(userAgent: string | null | undefined): boolean {
  return /\bMobi/i.test(userAgent ?? '');
}
