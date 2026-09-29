// The E2E specs' reach into the local Supabase stack (never the cloud project): its database, for made-up people and
// for moving a device's last use back in time; its mail catcher, for the emailed codes. Settings come from
// scripts/e2e/stack-env.mjs. Every value here is made up (rule 7): people are "Test Person …" at example.test.
import { randomUUID } from 'node:crypto';
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

export interface TestPerson {
  id: string;
  email: string;
  authUserId: string | null;
  name: string;
}

/**
 * A made-up person in the Commercial department. `listed` (default) gives them an allowed email and its auth user, as
 * the admin's allow-list would; `canSignIn: false` is a listed person who is switched off.
 */
export async function makePerson(
  opts: { admin?: boolean; canSignIn?: boolean; listed?: boolean } = {},
): Promise<TestPerson> {
  const { admin: isAdmin = false, canSignIn = true, listed = true } = opts;
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
  const created = await admin().createUser({ email, email_confirm: true });
  if (!created.data.user) throw new Error(`could not create the auth user: ${created.error?.message}`);
  await sql(`insert into core.person_auth (auth_user_id, person_id, email) values ($1, $2, $3)`, [
    created.data.user.id,
    id,
    email,
  ]);
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

/** Asks for a code on the sign-in page (already open); returns when it was asked for. */
export async function sendCode(page: Page, email: string): Promise<number> {
  const wait = (lastSent.get(email) ?? 0) + 1500 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const since = Date.now();
  lastSent.set(email, since);
  await page.getByLabel('Work email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  return since;
}

/** The whole door: open `from` signed out, land on the sign-in page, email → code → back to `from`. */
export async function signIn(page: Page, email: string, from = '/'): Promise<void> {
  await page.goto(from);
  await page.waitForURL(/\/sign-in\?/);
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
