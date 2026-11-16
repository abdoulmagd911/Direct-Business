/**
 * core/prefs — the ONLY place v2 keeps anything in the browser (spec A13, §2.4 rule 6).
 * Preferences are UI-only (theme, density, drawer, locale, a development direction override) and are
 * stored as cookies so the server renders <html data-theme data-density dir> before the first paint —
 * no flash of the wrong theme. Once "My profile" lands (P3-5) the person's profile is the source of truth
 * and these cookies are its cache.
 */
/**
 * The themes a person can pick (Landing 31, the V21 boards): Light (the default), Dark, Direct, Turquoise (opt-in,
 * never a default) and System, which follows the device's light or dark setting and switches live with it.
 * Colorful is no longer offered (V636, owner 14 Oct): Turquoise replaces it.
 */
export const THEMES = ['light', 'dark', 'direct', 'turquoise', 'system'] as const;
/** The themes an admin may set as the default for new people: Turquoise is opt-in, and System is a personal choice. */
export const DEFAULT_THEMES = ['light', 'dark', 'direct'] as const;
export type Theme = (typeof THEMES)[number];
/**
 * A theme as the database may still hold it: a profile saved while Colorful was offered reads as Light (V636). A read
 * rule, so no stored value is rewritten and nothing needs undoing.
 */
export type StoredTheme = Theme | 'colorful';
export const readTheme = (stored: string | null | undefined): Theme | null =>
  stored === 'colorful' ? 'light' : (THEMES.find((t) => t === stored) ?? null);
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

/** The allow-list: nothing else may be stored. Default theme is Light (V636, owner 14 Oct; it was Direct under Q32). */
export const PREF_DEFS: {
  [K in keyof Prefs]: { cookie: string; values: readonly Prefs[K][]; default: Prefs[K] };
} = {
  theme: { cookie: 'v2.theme', values: THEMES, default: 'light' },
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
  const apply = () => {
    html.dataset.theme = prefs.theme;
    html.dataset.density = prefs.density;
    html.setAttribute('dir', dirOf(prefs));
    html.setAttribute('lang', prefs.locale);
  };
  // A theme change cross-fades the whole app (200 ms, globals.css): the browser snapshots the old colours and fades
  // to the new ones, so every colour changes together. Instant with "reduce motion", or where the browser has no
  // view transitions.
  const doc = document as Document & { startViewTransition?: (run: () => void) => unknown };
  const still =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  if (html.dataset.theme !== prefs.theme && html.dataset.theme && !still && doc.startViewTransition)
    doc.startViewTransition(apply);
  else apply();
}
