// The E2E specs' reach into the local Supabase stack (never the cloud project): its database, for made-up people and
// for moving a device's last use back in time; its mail catcher, for the emailed codes. Settings come from
// scripts/e2e/stack-env.mjs. Every value here is made up (rule 7): people are "Test Person …" at example.test.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, type BrowserContext, type Page } from '@playwright/test';
import pg from 'pg';

function setting(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — run the specs with the stack's settings (scripts/e2e/stack-env.mjs)`);
  return v;
}

let pool: pg.Pool | undefined;

/** Runs SQL on the stack's database as its owner (fixtures only; the app itself never does this). */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
  pool ??= new pg.Pool({ connectionString: setting('V2_DB_URL'), max: 4 });
  return (await pool.query<T>(text, params)).rows;
}

function admin() {
  return createClient(setting('NEXT_PUBLIC_SUPABASE_URL'), setting('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin;
}

/** Every test person's password (made up; the door is email + password — owner, 29 Sep). */
export const TEST_PASSWORD = 'Test-Pass-2026-Riyadh';
const CODE_DOOR = process.env.SIGN_IN_METHOD === 'code';

export interface TestPerson {
  id: string;
  email: string;
  authUserId: string | null;
  name: string;
}

/**
 * A made-up person in the Commercial department. `listed` (default) gives them an allowed email and its auth user, as
 * the admin's allow-list would; `canSignIn: false` is a listed person who is switched off. The auth user holds the
 * test password, and the app knows it (`passwordRecorded`, default) — so no "Generate for everyone without a password"
 * running in a parallel spec ever replaces it; `passwordRecorded: false` is a person the app thinks has none.
 */
export async function makePerson(
  opts: { admin?: boolean; canSignIn?: boolean; listed?: boolean; passwordRecorded?: boolean } = {},
): Promise<TestPerson> {
  const { admin: isAdmin = false, canSignIn = true, listed = true, passwordRecorded = true } = opts;
  const id = randomUUID();
  const tag = id.slice(0, 8);
  const email = `test.e2e-${tag}@example.test`;
  const name = `Test Person ${tag}`;
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري')
     on conflict (code) do nothing`,
  );
  const roleKey = isAdmin ? 'admin' : 'member';
  // An Arabic name is required (V97): a trigger checks it before the conflict is, so it is passed even when the role
  // is already there.
  await sql(
    `insert into core.role (key, name_en, name_ar, is_admin) values ($1, $2, $3, $4) on conflict (key) do nothing`,
    [roleKey, isAdmin ? 'Admin' : 'Team member', isAdmin ? 'مدير النظام' : 'عضو الفريق', isAdmin],
  );
  await sql(
    `insert into core.person (id, full_name_en, department_id, role_id, can_sign_in, kind)
     values ($1, $2, (select id from core.department where code = 'commercial'),
             (select id from core.role where key = $3), $4, 'staff')`,
    [id, name, roleKey, canSignIn],
  );
  if (!listed) return { id, email, authUserId: null, name };
  await sql(`insert into core.person_email (person_id, email, is_primary) values ($1, $2, true)`, [id, email]);
  const created = await admin().createUser({ email, email_confirm: true, password: TEST_PASSWORD });
  if (!created.data.user) throw new Error(`could not create the auth user: ${created.error?.message}`);
  await sql(
    `insert into core.person_auth (auth_user_id, person_id, email, password_set_at)
     values ($1, $2, $3, case when $4 then now() end)`,
    [created.data.user.id, id, email, passwordRecorded],
  );
  return { id, email, authUserId: created.data.user.id, name };
}

/** A made-up email nobody holds. */
export function unlistedEmail(): string {
  return `test.e2e-nobody-${randomUUID().slice(0, 8)}@example.test`;
}

interface MailSummary {
  ID: string;
  Created: string;
}

/** Every message the mail catcher holds for an address, newest first. */
export async function mailsTo(email: string): Promise<MailSummary[]> {
  const url = `${setting('V2_MAILPIT_URL')}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mail catcher answered ${res.status}`);
  const body = (await res.json()) as { messages?: MailSummary[] };
  return body.messages ?? [];
}

/** The 6-digit code in the newest email to this address sent after `since` (waits up to 15 s for it to arrive). */
export async function codeFor(email: string, since: number): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const fresh = (await mailsTo(email)).find((m) => Date.parse(m.Created) >= since - 1000);
    if (fresh) {
      const res = await fetch(`${setting('V2_MAILPIT_URL')}/api/v1/message/${fresh.ID}`);
      const msg = (await res.json()) as { Text?: string; HTML?: string };
      const code = /\b(\d{6})\b/.exec(`${msg.Text ?? ''} ${msg.HTML ?? ''}`)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no code reached ${email}`);
}

// The stack sends one code per address per second (supabase/config.toml, [auth.email] max_frequency): a second
// device of the same person waits that second out rather than being refused.
const lastSent = new Map<string, number>();

let codeDoor: Promise<unknown> | undefined;

/**
 * The emailed code is off unless an admin switches it on (V166); these specs sign in through it, so the stack's
 * company-wide switch is turned on once (a dated row, as an admin's change would be), before any code is asked for.
 */
export function codeDoorOn(): Promise<unknown> {
  codeDoor ??= sql(
    `insert into core.setting (key, department_id, value, valid_from, reason)
     select 'auth.code_door_enabled', null, 'true'::jsonb, date '2020-01-01', 'Test: the specs sign in with the emailed code'
     where not exists (select 1 from core.setting where key = 'auth.code_door_enabled' and department_id is null
                       and valid_from = date '2020-01-01' and deleted_at is null)`,
  );
  return codeDoor;
}

/** Asks for a code on the sign-in page (already open); returns when it was asked for. */
export async function sendCode(page: Page, email: string): Promise<number> {
  await codeDoorOn();
  const wait = (lastSent.get(email) ?? 0) + 1500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const since = Date.now();
  lastSent.set(email, since);
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  return since;
}

/**
 * Tries the door once with an email (the sign-in page is open): the password door fills the password and clicks
 * Sign in; the code door asks for a code. The refusal, if any, is the page's alert line.
 */
export async function attemptSignIn(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  if (CODE_DOOR) {
    await sendCode(page, email);
    return;
  }
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** The person's own Sign out (POST /auth/sign-out): the device is marked signed out and the cookies cleared. */
export async function signOut(page: Page): Promise<void> {
  await page.request.post('/auth/sign-out');
  await page.context().clearCookies();
}

/** Whether the door sends e-mails at all: only the code door does. */
export const DOOR_SENDS_MAIL = CODE_DOOR;

/**
 * Gives an auth user made through the allow-list (an admin allowing an email) the test password, as an admin's
 * "Set password" would — without the must-change step, so a spec about the allow-list stays about the allow-list —
 * and records it, so a parallel "Generate for everyone without a password" leaves it alone.
 */
export async function givePassword(email: string, password = TEST_PASSWORD): Promise<void> {
  const [row] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [email]);
  if (!row) throw new Error(`no auth user for ${email}`);
  const { error } = await admin().updateUserById(row.id, { password });
  if (error) throw new Error(error.message);
  await sql(
    `update core.person_auth set password_set_at = now(), must_change_password = false where auth_user_id = $1`,
    [row.id],
  );
}

/** The whole door: open `from` signed out, land on the sign-in page, email + password (or the code) → back to `from`. */
export async function signIn(page: Page, email: string, from = '/', password = TEST_PASSWORD): Promise<void> {
  await page.goto(from);
  await page.waitForURL(/\/sign-in\?/);
  if (!CODE_DOOR) {
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page, 'the password signs in').not.toHaveURL(/\/sign-in(\?|$)/, { timeout: 15_000 });
    return;
  }
  const since = await sendCode(page, email);
  await page.getByLabel('Digit 1 of 6').waitFor();
  await page.getByLabel('Digit 1 of 6').fill(await codeFor(email, since));
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page, 'the code signs in').not.toHaveURL(/\/sign-in(\?|$)/, { timeout: 15_000 });
}

/** The Supabase session a browser holds (the access token's session_id), read from its cookie. */
export async function sessionOf(context: BrowserContext): Promise<{ sessionId: string; accessToken: string }> {
  const chunks = (await context.cookies())
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  if (!chunks.length) throw new Error('this browser holds no session');
  let raw = chunks.map((c) => decodeURIComponent(c.value)).join('');
  if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice(7), 'base64url').toString('utf8');
  const session = JSON.parse(raw) as { access_token: string };
  const payload = JSON.parse(Buffer.from(session.access_token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
    session_id: string;
  };
  return { sessionId: payload.session_id, accessToken: session.access_token };
}

/** The device row of a browser's session. */
export async function deviceOf(context: BrowserContext): Promise<string> {
  const { sessionId } = await sessionOf(context);
  const rows = await sql<{ id: string }>(`select id from core.device_session where auth_session_id = $1`, [sessionId]);
  if (!rows[0]) throw new Error('this browser has no device row');
  return rows[0].id;
}

/** Calls an api.* function as the person signed in to this browser, straight through the Data API. */
export async function callAs(context: BrowserContext, fn: string, args: Record<string, unknown> = {}) {
  const { accessToken } = await sessionOf(context);
  const res = await fetch(`${setting('NEXT_PUBLIC_SUPABASE_URL')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: setting('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
      authorization: `Bearer ${accessToken}`,
      'content-profile': 'api',
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

/** The sign-in log's results for an email, oldest first. */
export async function logOf(email: string): Promise<string[]> {
  const rows = await sql<{ result: string }>(`select result from core.sign_in_log where email = $1 order by at, id`, [
    email,
  ]);
  return rows.map((r) => r.result);
}

/**
 * A server action called straight by its action ID, as anything holding the page's bundle could — never through the
 * screen that normally calls it. The ID comes from the build's own manifest (file + exported name), the arguments are
 * sent as the browser would, and the answer is the raw React Server Components text (the action's result is in it).
 */
export async function callServerAction(
  page: Page,
  path: string,
  file: string,
  exportedName: string,
  args: unknown[],
): Promise<string> {
  const manifest = JSON.parse(readFileSync('.next/server/server-reference-manifest.json', 'utf8')) as {
    node: Record<string, { filename?: string; exportedName?: string }>;
  };
  const id = Object.entries(manifest.node).find(([, a]) => a.filename === file && a.exportedName === exportedName)?.[0];
  if (!id) throw new Error(`no server action ${exportedName} in ${file}`);
  const res = await page.request.post(path, {
    headers: { 'Next-Action': id, 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'text/x-component' },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return res.text();
}
