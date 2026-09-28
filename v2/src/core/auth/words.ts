// The sign-in page's wording, from the English catalog (keys, never sentences in code). Arabic stays off until the
// owner approves it (app.arabic_enabled — P6-7); P3-3 moves every screen, this one included, to next-intl.
import en from '../../../messages/en.json';

type Catalog = typeof en;

/** Looks up a dotted key ("sign_in.error.not_listed") and fills {placeholders}. An unknown key shows itself. */
export function word(key: string, vars: Record<string, string | number> = {}): string {
  let node: unknown = en as Catalog;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (all, name: string) => (name in vars ? String(vars[name]) : all));
}
