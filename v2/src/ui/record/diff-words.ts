import { formatStoredDate } from '@/core/i18n/format';

/**
 * The shared diff renderer (D36(a), Landing 15 Group C): one place that turns a change's field names and values
 * into words, used by the record History (ActivityTimeline), the /activity Changes feed and Settings log, and the
 * bell (NotificationsPanel — field names only, it carries no values). Before this, the field-name fallback was
 * duplicated in the timeline and the bell, the Settings log bypassed both, and values that are keys — a start
 * page, a setting, a capability, a list of people — read raw. A value with no word falls back to plain words,
 * never to JSON and never to the raw key.
 */

/** The translations a renderer needs: next-intl's `t` (callable, with `has`). */
export type WordT = {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
};

export type AvatarName = { displayName: string };

/** A column name is never shown: its wording, else the name in plain words ("manager_id" → "Manager"). */
export function plainWords(field: string): string {
  const plain = field.replace(/_id$/, '').replace(/_/g, ' ');
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

export function fieldLabel(t: WordT, field: string): string {
  if (t.has(`activity.fields.${field}`)) return t(`activity.fields.${field}`);
  return plainWords(field);
}

/**
 * A bare key in words: a setting's name ("app.arabic_enabled" → "Arabic"), a capability's ("tasks.assign_own" →
 * "Assign a task I own or created"), a start page's ("my_day" → "My day"). Null when no wording knows the key.
 */
export function keyWord(t: WordT, key: string): string | null {
  if (t.has(`setting.${key}`)) return t(`setting.${key}`);
  if (t.has(`cap.${key}`)) return t(`cap.${key}`);
  if (t.has(`activity.startPage.${key}`)) return t(`activity.startPage.${key}`);
  return null;
}

/** A setting's key in words ("app.arabic_enabled" → "Arabic"), else null. */
export function settingLabel(t: WordT, key: string): string | null {
  if (t.has(`setting.${key}`)) return t(`setting.${key}`);
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export type ValueWordsDeps = {
  t: WordT;
  locale: 'en' | 'ar';
  /** A field's value in words from what the screen knows — ids to names; null when it has no word. */
  describe?: (field: string, value: unknown) => string | null;
  /** Who is who, for a person's id. */
  people?: Record<string, AvatarName>;
};

/**
 * A field's value in words. Order: the screen's own lookup first (a department's or person's name for its id),
 * then the vocabularies a raw value can be (a start page, a theme, a setting key, a capability key), then a
 * stored day, then a person's id by name. A list reads as its items' words — a UUID in it resolves to the
 * person's name, never the id (F-B2-02) — and a grouped value as its named parts.
 */
export function makeValueWords({ t, locale, describe, people = {} }: ValueWordsDeps) {
  const valueWords = (field: string, v: unknown): string => {
    const said = describe?.(field, v);
    if (said) return said;
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return t(v ? 'common.yes' : 'common.no');
    if (typeof v === 'string') {
      // A key, not a word: a setting's key, a capability's key, a start page ("Start page: my_day" — F-B5-13(a)).
      if (field === 'key' || field === 'capability_key') {
        const word = keyWord(t, v);
        if (word) return word;
      }
      if ((field === 'theme' || field === 'default_theme') && t.has(`theme.${v}`)) return t(`theme.${v}`);
      if ((field === 'density' || field === 'default_density') && t.has(`density.${v}`)) return t(`density.${v}`);
      if (field === 'locale' && t.has(`locale.${v}`)) return t(`locale.${v}`);
      if ((field === 'start_page' || field === 'default_start_page') && t.has(`activity.startPage.${v}`))
        return t(`activity.startPage.${v}`);
      // A stored day or moment is written the one way the app writes a date, then a person's id by name.
      const when = formatStoredDate(v, locale);
      if (when) return when;
      if (UUID_RE.test(v)) return people[v]?.displayName ?? '—';
      return v;
    }
    if (typeof v === 'number') {
      const when = formatStoredDate(v, locale);
      if (when) return when;
      return String(v);
    }
    // A list reads as its items' words, never as JSON and never as raw ids (F-B2-02): each item goes through
    // the same words, so a shared-with list names its people. A checklist item keeps its text, marked done.
    if (Array.isArray(v)) {
      if (!v.length) return '—';
      const texts = v.map((it) => {
        if (it && typeof it === 'object') {
          const rec = it as Record<string, unknown>;
          if (typeof rec.text === 'string' && rec.text.trim())
            return rec.done === true ? `${rec.text.trim()} (${t('status.done')})` : rec.text.trim();
          return null;
        }
        if (typeof it === 'string' || typeof it === 'number') return valueWords(field, it);
        return null;
      });
      const said = texts.filter((x): x is string => x !== null);
      return said.length ? said.join(', ') : '—';
    }
    // A grouped value reads as its named parts, never as JSON.
    if (v && typeof v === 'object') {
      const parts = Object.entries(v as Record<string, unknown>).map(
        ([k, val]) => `${fieldLabel(t, k)}: ${valueWords(k, val)}`,
      );
      return parts.length ? parts.join(', ') : '—';
    }
    return JSON.stringify(v);
  };
  return valueWords;
}

/**
 * One setting's value in words, for the Settings log: the kinds a notification setting names ("notify.
 * kinds_enabled" lists its kinds by their words), a default theme/density/start page by its word, anything
 * else by the shared renderer. `words` is the screen's valueWords.
 */
export function settingValueWords(
  t: WordT,
  key: string,
  value: unknown,
  words: (field: string, value: unknown) => string,
): string {
  if (key === 'notify.kinds_enabled' && Array.isArray(value)) {
    if (!value.length) return '—';
    const kinds = value.map((k) =>
      typeof k === 'string' && t.has(`profile.notify.${k}`) ? t(`profile.notify.${k}`) : String(k),
    );
    return kinds.join(', ');
  }
  if (typeof value === 'string') {
    if (key === 'app.default_theme' && t.has(`theme.${value}`)) return t(`theme.${value}`);
    if (key === 'app.default_density' && t.has(`density.${value}`)) return t(`density.${value}`);
    if (key === 'app.default_start_page' && t.has(`activity.startPage.${value}`))
      return t(`activity.startPage.${value}`);
  }
  return words('value', value);
}
