/** What the Settings screens need of a translator: `t` and `t.has` (next-intl's, or `createTranslator`'s). */
export type Say = { (key: string): string; has: (key: string) => boolean };

/** File types, as people say them: the format names are the same in every language, the one plain word is not
 * (files.allowed_types holds MIME types — W20). A MIME type with no entry here is written as the format after the slash. */
const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/svg+xml': 'SVG',
  'text/csv': 'CSV',
  'application/msword': 'Word (.doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.ms-excel': 'Excel (.xls)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
  'application/vnd.ms-powerpoint': 'PowerPoint (.ppt)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (.pptx)',
  'application/zip': 'ZIP',
};

/** The catalog key of a field's name inside an object setting ("account_manager"), when it has one. */
export const keyWordKey = (k: string): string => `settings.fields.${k}`;

/** A choice's name in the catalog when it is not its own value: the screen never says "margin" (V73), so the choice
 * stored as `margin` is worded under `profit`. */
const CATALOG_NAME: Record<string, string> = { margin: 'profit' };

/** The catalog keys that can word an enum value of a setting, best first. */
export const valueWordKeys = (settingKey: string, v: string): string[] => [
  `settings.values.${settingKey}.${CATALOG_NAME[v] ?? v}`,
  `theme.${v}`,
  `density.${v}`,
  `profile.notify.${v}`,
  `partners.figures.${v}`,
];

/** Settings whose values are the keys of entries of a list (the screen shows the entries' names, never the keys):
 * the field's path → the list. The revenue definition counts services and client types (V4, V501). */
export const LIST_VALUES: Record<string, string> = {
  'finance.revenue_definition.services': 'service',
  'finance.revenue_definition.client_types': 'side_type',
};

/** The entries of the lists named in LIST_VALUES, by the field's path. */
export type ChoiceNames = Record<string, { key: string; name_en: string; name_ar: string | null; active?: boolean }[]>;

/** The name of a list entry in a language, from its key; null when there is no such entry. */
export type NameLookup = (path: string, key: string) => string | null;

export const nameLookup =
  (names: ChoiceNames | undefined, locale: 'en' | 'ar'): NameLookup =>
  (path, key) => {
    const e = names?.[path]?.find((x) => x.key === key);
    return e ? (locale === 'ar' && e.name_ar ? e.name_ar : e.name_en) : null;
  };

/** A key in plain words: its wording, else "account_manager" → "Account manager" (English only — a key with no wording is
 * a gap the Arabic-words test refuses). */
export function keyWord(t: Say, k: string): string {
  if (t.has(keyWordKey(k))) return t(keyWordKey(k));
  const plain = k.replace(/_/g, ' ');
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

/** The word for an enum value: the setting's own list in the catalog, else a shared list, else the value itself. */
export function valueWord(t: Say, settingKey: string, v: unknown, names?: NameLookup): string {
  if (typeof v === 'boolean') return t(`settings.setting.values.${v}`);
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return JSON.stringify(v);
  const listed = names?.(settingKey, v);
  if (listed) return listed;
  if (FILE_TYPES[v]) return FILE_TYPES[v];
  if (v === 'text/plain') return t('settings.fileTypes.text');
  for (const k of valueWordKeys(settingKey, v)) if (t.has(k)) return t(k);
  return v;
}

/** A value as words, for the card and the preview: lists joined, objects as "Key: value" pairs (W16). A field inside an
 * object is worded under the setting's key and its own ("finance.revenue_definition.basis"), as the editor words it. */
export function valueText(t: Say, settingKey: string, value: unknown, names?: NameLookup): string {
  if (value === '' || value === null || value === undefined) return t('settings.setting.notSet');
  if (Array.isArray(value))
    return value.length ? value.map((v) => valueText(t, settingKey, v, names)).join(' · ') : '—';
  if (typeof value === 'object')
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${keyWord(t, k)}: ${valueText(t, `${settingKey}.${k}`, v, names)}`)
      .join(' · ');
  return valueWord(t, settingKey, value, names);
}
