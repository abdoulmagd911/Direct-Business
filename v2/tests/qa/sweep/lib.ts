// The QA sweep's shared helpers: the run's fixtures, a result line per check (results.jsonl → results.json and the
// table, by report.mjs), sign-in through the real door, api.* calls as a fixture person (their own session, the
// app's door order), SQL on the LOCAL QA stack for read-backs, and screenshots. Made-up data only (rule 7).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { expect, type Page, type TestInfo } from '@playwright/test';
import pg from 'pg';
import { FIXTURES_FILE, RESULTS_LINES, RUN_DIR, SHOTS_DIR, V2_DIR } from './paths.mjs';

export type Person = { key: string; id: string; email: string; name: string; role: string | null };
export type Fixtures = {
  tag: string;
  password: string;
  today: string;
  users: Record<string, Person>;
  orgs: {
    alpha: { id: string; number: string; name: string };
    beta: { id: string; number: string; name: string; clientOwnerFirst: boolean; supplierOwner: string };
  };
  identifiers: { betaClientId: { id: string; value: string }; betaVat: { id: string; value: string } };
  contracts: { alphaClient: string; betaClient: string; betaSupplier: string };
  notes: { alpha: string; beta: string };
  views: { member: string };
  settingReason: string;
};

let loaded: Fixtures | null = null;
export function fx(): Fixtures {
  if (!loaded) {
    if (!existsSync(FIXTURES_FILE)) throw new Error(`no fixtures at ${FIXTURES_FILE} — run tests/qa/sweep/run.sh`);
    loaded = JSON.parse(readFileSync(FIXTURES_FILE, 'utf8')) as Fixtures;
  }
  return loaded;
}
export function user(key: string): Person {
  const p = fx().users[key];
  if (!p) throw new Error(`no fixture person ${key}`);
  return p;
}

// ---------------------------------------------------------------- results
export type Status = 'PASS' | 'FAIL' | 'NOT BUILT' | 'INFO';
export type Result = {
  area: string;
  screen?: string;
  user?: string;
  check: string;
  status: Status;
  detail?: string;
  shot?: string;
};

export function record(r: Result): void {
  mkdirSync(RUN_DIR, { recursive: true });
  appendFileSync(RESULTS_LINES, JSON.stringify({ ...r, at: new Date().toISOString() }) + '\n');
}

/** One check: PASS when `ok`, else FAIL — and the test fails (softly: the other checks still run). */
export function verdict(r: Omit<Result, 'status'>, ok: boolean): boolean {
  record({ ...r, status: ok ? 'PASS' : 'FAIL' });
  expect
    .soft(ok, `${r.area} · ${r.user ?? ''} · ${r.screen ?? ''} · ${r.check}${r.detail ? ` — ${r.detail}` : ''}`)
    .toBe(true);
  return ok;
}

export function notBuilt(r: Omit<Result, 'status'>): void {
  record({ ...r, status: 'NOT BUILT' });
}

export function info(r: Omit<Result, 'status'>): void {
  record({ ...r, status: 'INFO' });
}

// ---------------------------------------------------------------- words
const catalog = JSON.parse(readFileSync(join(V2_DIR, 'messages', 'en.json'), 'utf8')) as Record<string, unknown>;
/** The English wording of a catalog key (`errors.access.needs_level`), or null when there is none. */
export function words(key: string): string | null {
  let at: unknown = catalog;
  for (const part of key.split('.')) {
    if (!at || typeof at !== 'object') return null;
    at = (at as Record<string, unknown>)[part];
  }
  return typeof at === 'string' ? at : null;
}
const KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
/**
 * What a screen shows for a refusal, exactly as the app words it (src/core/db/errors.ts toDbError, then
 * src/core/db/words.ts errorKey): the key's own wording when the catalog has it, else the kind's general line. A
 * code the app does not know reads "The server did not answer" — that is not a refusal in words.
 */
export function wordingOf(a: { code?: string; key?: string }): {
  kind: string;
  text: string | null;
  specific: boolean;
} {
  const code = a.code ?? '';
  const key = a.key ?? '';
  const kind =
    code === '42501'
      ? 'PermissionDenied'
      : code === 'P0002'
        ? 'NotFound'
        : code === '40001'
          ? 'Conflict'
          : code === 'P0001' || code.startsWith('23')
            ? 'RuleBroken'
            : 'Unavailable';
  const own = KEY.test(key) ? words(`errors.${key}`) : null;
  return { kind, text: own ?? words(`errors.kind.${kind}`), specific: own !== null };
}
/** A refusal the screens put in words (V110): a known kind — never "The server did not answer". */
export function inWords(a: { ok?: boolean; code?: string; key?: string }): boolean {
  return !a.ok && wordingOf(a).kind !== 'Unavailable';
}

// ---------------------------------------------------------------- the database (LOCAL QA stack only)
function setting(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — run through tests/qa/sweep/run.sh`);
  return v;
}
let pool: pg.Pool | undefined;
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  pool ??= new pg.Pool({ connectionString: setting('V2_DB_URL'), max: 3 });
  return (await pool.query<T>(text, params)).rows;
}

// ---------------------------------------------------------------- api.* as a person
export type Answer = { ok: boolean; data: unknown; code?: string; key?: string; detail?: string };
export type Api = (fn: string, args?: Record<string, unknown>) => Promise<Answer>;
const sessions = new Map<string, Promise<Api>>();

/** api.* as a fixture person, through the Data API with their own session (password, then sign_in_complete). */
export function apiAs(key: string, password?: string): Promise<Api> {
  const cacheKey = `${key}:${password ?? ''}`;
  let s = sessions.get(cacheKey);
  if (!s) {
    s = (async () => {
      const p = user(key);
      const c = createClient(setting('NEXT_PUBLIC_SUPABASE_URL'), setting('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
        db: { schema: 'api' },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await c.auth.signInWithPassword({ email: p.email, password: password ?? fx().password });
      if (signed.error) throw new Error(`${key} could not sign in: ${signed.error.message}`);
      await c.rpc('sign_in_complete' as never, { p_provider: 'email', p_device_label: 'QA sweep' } as never);
      return async (fn: string, args: Record<string, unknown> = {}) => {
        const r = await c.rpc(fn as never, args as never);
        if (r.error)
          return {
            ok: false,
            data: null,
            code: r.error.code,
            key: r.error.message,
            detail: r.error.details ?? undefined,
          };
        return { ok: true, data: r.data as unknown };
      };
    })();
    sessions.set(cacheKey, s);
  }
  return s;
}

/** A short line for a result's detail: the refusal's code, key and the words a screen shows, or what came back. */
export function said(a: Answer): string {
  if (!a.ok) {
    const w = wordingOf(a);
    const detail = a.detail ? ` (${a.detail.slice(0, 100)})` : '';
    return `refused ${a.code} ${a.key}${detail} → "${w.text}"${w.specific ? '' : ' [general wording: no errors.' + a.key + ']'}`;
  }
  const text = JSON.stringify(a.data);
  return `answered ${text.length > 160 ? `${text.slice(0, 160)}…` : text}`;
}

// ---------------------------------------------------------------- the browser
export async function hydrated(page: Page, timeout = 20_000): Promise<boolean> {
  return page
    .waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout })
    .then(() => true)
    .catch(() => false);
}

/** The whole password door: open `from` signed out, sign in, and wait until the page has left the door. */
export async function signIn(page: Page, key: string, from = '/my-day', password?: string): Promise<void> {
  const p = user(key);
  await page.goto(`/sign-in?next=${encodeURIComponent(from)}`);
  await page.getByLabel('Work email').fill(p.email);
  await page.getByLabel('Password', { exact: true }).fill(password ?? fx().password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page, `${key} signs in`).not.toHaveURL(/\/sign-in(\?|$)/, { timeout: 20_000 });
}

/** Fills the door once and clicks Sign in (the page is open on /sign-in). */
export async function tryDoor(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await submitAndSettle(page, page.getByRole('button', { name: 'Sign in', exact: true }));
}

/** Clicks a form's submit (a server action) and waits for its answer and the re-render, so a refusal read is fresh. */
export async function submitAndSettle(page: Page, button: ReturnType<Page['locator']>): Promise<void> {
  const answered = page
    .waitForResponse((r) => r.request().method() === 'POST' && !!r.request().headers()['next-action'], {
      timeout: 20_000,
    })
    .catch(() => null);
  await button.click();
  await answered;
  await page
    .waitForFunction(() => !document.querySelector('button[aria-busy="true"]'), null, { timeout: 10_000 })
    .catch(() => undefined);
}

export const refusalLine = (page: Page) => page.getByRole('main').getByRole('alert');
export const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]', { hasText: text }).first();

/** A screenshot in the run's shots folder (QA_SHOTS); returns its path for the result line. */
export async function shot(page: Page, name: string): Promise<string> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const path = join(SHOTS_DIR, `${name.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 120)}.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => undefined);
  return path;
}

/** The title of the test, for result lines that need no more. */
export const titleOf = (t: TestInfo) => t.title;
