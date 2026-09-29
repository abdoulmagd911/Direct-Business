import type { LucideIcon } from 'lucide-react';

/**
 * An action Ctrl K offers (V401: New task · Log activity · New invoice · Go to). Each step registers its own as it
 * lands (P5-2 the task and the activity, P4-4 the invoice), so the palette never names a door that is not built.
 */
export type PaletteAction = {
  key: string;
  /** Catalog key of the label. */
  label: string;
  icon: LucideIcon;
  /** The page whose level (above none) shows the action. */
  page: string;
  /** Where it goes; the screen there opens its form. */
  route: string;
};

const actions: PaletteAction[] = [];

export function registerActions(list: PaletteAction[]) {
  for (const a of list) if (!actions.some((x) => x.key === a.key)) actions.push(a);
}

export function paletteActions(): readonly PaletteAction[] {
  return actions;
}
