/**
 * core/prefs — the ONLY place v2 keeps anything in the browser (spec A13, §2.4 rule 6).
 * Preferences are UI-only (theme, density, drawer, locale, a development direction override) and are
 * stored as cookies so the server renders <html data-theme data-density dir> before the first paint —
 * no flash of the wrong theme. Once "My profile" lands (P3-5) the person's profile is the source of truth
 * and these cookies are its cache.
 */
export const THEMES = ['light', 'dark', 'colorful', 'direct'] as const;
export type Theme = (typeof THEMES)[number];
export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];
export const DRAWER_STATES = ['pinned', 'collapsed'] as const;
export type DrawerState = (typeof DRAWER_STATES)[number];
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DIRS = ['auto', 'ltr', 'rtl'] as const;
export type DirOverride = (typeof DIRS)[number];

export type Prefs = {
  theme: Theme;
  density: Density;
  drawer: DrawerState;
  locale: Locale;
  /** Development only: force a direction to test RTL with the English catalog (pseudo-locale). */
  dir: DirOverride;
};

/** The allow-list: nothing else may be stored. Default theme is Direct (OPEN-QUESTIONS Q32, recommended). */
export const PREF_DEFS: {
  [K in keyof Prefs]: { cookie: string; values: readonly Prefs[K][]; default: Prefs[K] };
} = {
  theme: { cookie: 'v2.theme', values: THEMES, default: 'direct' },
  density: { cookie: 'v2.density', values: DENSITIES, default: 'comfortable' },
  drawer: { cookie: 'v2.drawer', values: DRAWER_STATES, default: 'pinned' },
  locale: { cookie: 'v2.locale', values: LOCALES, default: 'en' },
  dir: { cookie: 'v2.dir', values: DIRS, default: 'auto' },
};

export const PREF_KEYS = Object.keys(PREF_DEFS) as (keyof Prefs)[];

const ONE_YEAR = 60 * 60 * 24 * 365;

function coerce<K extends keyof Prefs>(key: K, raw: string | undefined | null): Prefs[K] {
  const def = PREF_DEFS[key];
  return (def.values as readonly string[]).includes(raw ?? '') ? (raw as Prefs[K]) : def.default;
}

/** Build a Prefs object from any cookie reader (server `cookies()` or a parsed document.cookie). */
export function prefsFrom(get: (name: string) => string | undefined): Prefs {
  const out = {} as Prefs;
  for (const key of PREF_KEYS) {
    (out as Record<string, unknown>)[key] = coerce(key, get(PREF_DEFS[key].cookie));
  }
  return out;
}

/**
 * Direction for <html dir>: the locale decides unless the override is set. Only the development
 * profile menu and the tests ever set it (there is no control for it in a production build).
 */
export function dirOf(prefs: Prefs): 'ltr' | 'rtl' {
  if (prefs.dir !== 'auto') return prefs.dir;
  return prefs.locale === 'ar' ? 'rtl' : 'ltr';
}

/* ---------- browser side ---------- */

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/\./g, '\\.') + '=([^;]*)'));
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

/**
 * The cookie naming the preferences whose cookie is only a cache of what the person's profile or the admin's default says
 * (PrefsSync wrote it), not a choice this browser made. A cached value never beats the profile or the admin's default
 * (QA-210); a choice made here (`setPref` without `cache`) removes the key from the list again.
 */
export const SYNCED_COOKIE = 'v2.synced';

/** The keys whose cookie is only a cache, from any cookie reader. */
export function syncedFrom(get: (name: string) => string | undefined): Set<string> {
  return new Set((get(SYNCED_COOKIE) ?? '').split(',').filter(Boolean));
}

/** Whether a cookie holds a choice this browser made for the preference: a valid value that PrefsSync did not just cache. */
export function ownChoice(key: keyof Prefs, get: (name: string) => string | undefined): boolean {
  const raw = get(PREF_DEFS[key].cookie);
  return raw !== undefined && (PREF_DEFS[key].values as readonly string[]).includes(raw) && !syncedFrom(get).has(key);
}

/** Whether this browser holds its own choice for a preference, as opposed to the coerced default or a cached value. */
export function prefIsSet(key: keyof Prefs): boolean {
  return ownChoice(key, readCookie);
}

export function readPrefs(): Prefs {
  return prefsFrom(readCookie);
}

/** `cache`: the value is what the profile or the admin's default says, kept in the cookie for the first paint — not a choice. */
export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K], opts: { cache?: boolean } = {}): void {
  const def = PREF_DEFS[key];
  if (!(def.values as readonly string[]).includes(value)) throw new Error(`prefs: ${key} cannot be ${String(value)}`);
  if (typeof document === 'undefined') return;
  const synced = syncedFrom(readCookie);
  if (opts.cache) synced.add(key);
  else synced.delete(key);
  document.cookie = `${SYNCED_COOKIE}=${[...synced].join(',')}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  document.cookie = `${def.cookie}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  applyPrefsToDocument(readPrefs());
  window.dispatchEvent(new CustomEvent('v2:prefs', { detail: readPrefs() }));
}

/** Mirrors the server's <html> attributes so a change shows at once, without a reload. */
export function applyPrefsToDocument(prefs: Prefs): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.dataset.theme = prefs.theme;
  html.dataset.density = prefs.density;
  html.setAttribute('dir', dirOf(prefs));
  html.setAttribute('lang', prefs.locale);
}
