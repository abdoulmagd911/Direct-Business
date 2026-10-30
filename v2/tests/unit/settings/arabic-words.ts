// Helpers for the Settings-in-Arabic tests (QA-591): what a screen draws, as the words a person reads, and which of
// them are not Arabic. All values in the tests are made up.
import { z } from 'zod';
import { modules } from '../../../src/core/registry/index';
import type { SettingDefRow, SettingSchema } from '../../../src/modules/settings/schema';

/** The words on a rendered screen: the text, and the words a screen reader or a hover reads (aria-label, title,
 * placeholder, alt); other attributes out; entities read; one space between. */
export function wordsOf(markup: string): string {
  return markup
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
    .replace(
      /<[^>]*>/g,
      (tag) =>
        [...tag.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => ` ${m[1]} `).join(' ') + ' ',
    )
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Format names and file extensions: the same letters in every language. */
export const SAME_IN_EVERY_LANGUAGE = new Set([
  'CSV',
  'Excel',
  'PDF',
  'PNG',
  'JPEG',
  'WebP',
  'GIF',
  'SVG',
  'ZIP',
  'Word',
  'PowerPoint',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
]);

/** Every Latin word on the screen that is not a format name or in `data` (the made-up values the test put there). */
export function latinLeft(text: string, data: Iterable<string> = []): string[] {
  const allowed = new Set([
    ...SAME_IN_EVERY_LANGUAGE,
    ...[...data].flatMap((d) => d.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? []),
  ]);
  const found = text.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? [];
  return [...new Set(found.filter((w) => !allowed.has(w)))];
}

/** Every string a setting's default holds that is not one of its fixed choices: values a person typed, not words. */
function typedStrings(schema: SettingSchema, value: unknown, out: string[]): void {
  if (typeof value === 'string' && !schema.enum) out.push(value);
  if (Array.isArray(value)) for (const v of value) typedStrings(schema.items ?? {}, v, out);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) typedStrings(schema.properties?.[k] ?? {}, v, out);
}

export type RegistrySetting = { def: SettingDefRow; group: string; typed: string[] };

/** Every setting the registry declares, as the database would answer for it: the schema, today's value, one row. */
export function registrySettings(): RegistrySetting[] {
  const out: RegistrySetting[] = [];
  for (const m of modules)
    for (const s of m.settings ?? []) {
      const schema = z.toJSONSchema(s.schema) as unknown as SettingSchema;
      const typed: string[] = [];
      typedStrings(schema, s.default, typed);
      out.push({
        group: s.group,
        typed,
        def: {
          key: s.key,
          label_key: s.label,
          schema,
          default: s.default,
          effective_dated: !!s.effectiveDated,
          value: s.default,
          rows: [
            {
              id: `row-${s.key}`,
              department_id: null,
              value: s.default,
              valid_from: '2026-10-01',
              reason: 'default',
              set_by: null,
              set_at: '2026-10-01T00:00:00Z',
            },
          ],
        },
      });
    }
  return out;
}

/** Every fixed choice a schema offers, with the dotted setting key the screen words it under. */
export function choicesOf(
  schema: SettingSchema,
  settingKey: string,
  out: { settingKey: string; value: string }[] = [],
) {
  if (schema.enum) for (const e of schema.enum) if (typeof e === 'string') out.push({ settingKey, value: e });
  if (schema.items) choicesOf(schema.items, settingKey, out);
  for (const [k, s] of Object.entries(schema.properties ?? {})) choicesOf(s, `${settingKey}.${k}`, out);
  return out;
}

/** Every field name inside an object setting, however deep. */
export function fieldNamesOf(schema: SettingSchema, out: string[] = []) {
  for (const [k, s] of Object.entries(schema.properties ?? {})) {
    out.push(k);
    fieldNamesOf(s, out);
  }
  if (schema.items) fieldNamesOf(schema.items, out);
  return out;
}
