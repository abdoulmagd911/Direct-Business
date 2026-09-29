import 'server-only';

// The admin's allow-list, server side (TECH-SPEC §4 steps 2 and 5). Every change is made twice over, on purpose:
// the database decides and logs it (api.person_email_add / _remove / person_auth_link / person_sign_out, called as
// the caller — they refuse anyone but an admin, or without org.sign_out — V97, V138), and the secret key keeps
// Supabase Auth in step (an auth user per allowed email, created confirmed; banned the moment it may no longer sign
// in). Screens call these through /auth/admin/*.
import { NextResponse } from 'next/server';
import { DbError, unwrap } from '@/core/db/errors';
import { serverDb } from '@/core/db/server';
import { serviceDb } from '@/core/db/service';
import { getMe } from './get-me';
import type { Level, Me } from './me';
import { temporaryPassword } from './password';

/** Banned for a century: Supabase has no "forever"; unbanning is `none`. */
const BANNED = '876000h';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS: Record<DbError['kind'], number> = {
  PermissionDenied: 403,
  NotFound: 404,
  RuleBroken: 422,
  Conflict: 409,
  Unavailable: 503,
};

/** Runs an admin route: JSON `{ ok: true, … }`, or `{ ok: false, error: { kind, key } }` with its HTTP status. */
export async function adminRoute(request: Request, run: (body: Record<string, unknown>) => Promise<object>) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ ok: true, ...(await run(body)) });
  } catch (e) {
    if (e instanceof DbError) {
      const status = e.key === 'auth.not_signed_in' ? 401 : STATUS[e.kind];
      return NextResponse.json({ ok: false, error: { kind: e.kind, key: e.key } }, { status });
    }
    throw e;
  }
}

const LEVEL_ORDER: Level[] = ['none', 'view', 'own', 'full'];

async function signedIn(): Promise<Me> {
  const me = await getMe();
  if (!me || me.status !== 'ok') throw new DbError('PermissionDenied', 'auth.not_signed_in');
  return me;
}

/** The caller at `level` or above on `page` (from api.me() — V125), else the refusal the database would give. */
export async function requireLevel(page: string, level: Level): Promise<Me> {
  const me = await signedIn();
  if (LEVEL_ORDER.indexOf(me.levels[page] ?? 'none') < LEVEL_ORDER.indexOf(level))
    throw new DbError('PermissionDenied', 'access.needs_level', JSON.stringify({ page, level }));
  return me;
}

/** The caller holding `capability`, else the refusal the database would give. */
export async function requireCapability(capability: string): Promise<Me> {
  const me = await signedIn();
  if (!me.capabilities.includes(capability))
    throw new DbError('PermissionDenied', 'access.needs_capability', JSON.stringify({ capability }));
  return me;
}

export function uuidArg(body: Record<string, unknown>, name: string, optional = false): string | undefined {
  const v = body[name];
  if ((v === undefined || v === null) && optional) return undefined;
  if (typeof v !== 'string' || !UUID.test(v)) throw new DbError('RuleBroken', 'common.bad_request', name);
  return v;
}

export function emailArg(body: Record<string, unknown>, name: string): string {
  const v = typeof body[name] === 'string' ? (body[name] as string).trim().toLowerCase() : '';
  if (!EMAIL.test(v) || v.length > 254) throw new DbError('RuleBroken', 'sign_in.error.invalid_email', name);
  return v;
}

export function textArg(body: Record<string, unknown>, name: string): string | undefined {
  const v = body[name];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * The auth user for an allowed email: created confirmed (a door never makes a person — the person exists first), or the
 * one already there for that email, found and never made twice (`existed`: made outside the app — the owner's accounts,
 * made in the dashboard with the passwords he typed himself, V166).
 */
async function ensureAuthUser(email: string): Promise<{ id: string; existed: boolean }> {
  const admin = serviceDb().auth.admin;
  const created = await admin.createUser({ email, email_confirm: true });
  if (created.data.user) return { id: created.data.user.id, existed: false };
  const existing = unwrap(await serviceDb().rpc('auth_user_of', { p_email: email }));
  if (!existing) throw new DbError('Unavailable', 'common.unavailable', created.error?.message);
  return { id: existing, existed: true };
}

/** Links an allowed email to its auth user; one found already there keeps its own password (core.person_auth_found). */
async function linkAuthUser(db: Awaited<ReturnType<typeof serverDb>>, email: string): Promise<string> {
  const user = await ensureAuthUser(email);
  unwrap(await db.rpc('person_auth_link', { p_email: email, p_auth_user_id: user.id }));
  if (user.existed) unwrap(await db.rpc('person_auth_found', { p_auth_user: user.id }));
  return user.id;
}

async function setBanned(authUserId: string, banned: boolean) {
  const { error } = await serviceDb().auth.admin.updateUserById(authUserId, { ban_duration: banned ? BANNED : 'none' });
  if (error) throw new DbError('Unavailable', 'common.unavailable', error.message);
}

/** Allow an email: the database row (logged), then its auth user, then the link — and the person's state re-synced. */
export async function addEmail(personId: string, email: string, primary: boolean, reason?: string) {
  const db = await serverDb();
  const added = unwrap(
    await db.rpc('person_email_add', { p_person: personId, p_email: email, p_primary: primary, p_reason: reason }),
  ) as { id: string; version: number; request_id: string };
  const authUserId = await linkAuthUser(db, email);
  await syncPerson(personId);
  return { ...added, auth_user_id: authUserId };
}

type Generated = { person_id: string; auth_user_ids: string[]; signed_out: number; request_id: string };

/**
 * An admin generates a person's temporary password (V441 — nobody types a password for someone else). First every
 * allowed e-mail of the person is linked to its auth user — the one that already exists for that e-mail (one the owner
 * made in the dashboard, say), found by e-mail and never made twice. The database then decides (admins only), logs it
 * with its reason, marks every sign-in of the person "must change password" and signs the person's devices out; a
 * person who already holds a password — one the owner typed himself (V166), or one generated before — keeps it unless
 * `replace` says otherwise (the screen's Reset, asked explicitly). Then the secret key sets the one generated password on
 * each of those sign-ins, confirmed. The password goes back to the admin once, in this answer (`temporary_password`) —
 * never stored or logged.
 */
export async function generatePassword(personId: string, reason: string, replace = false) {
  if (!reason.trim()) throw new DbError('RuleBroken', 'common.reason_required');
  const db = await serverDb();
  const unlinked = unwrap(await db.rpc('person_emails_unlinked', { p_person: personId })) as string[];
  for (const email of unlinked) await linkAuthUser(db, email);
  const set = unwrap(
    await db.rpc('person_password_set', { p_person: personId, p_reason: reason, p_replace: replace }),
  ) as Generated;
  const password = temporaryPassword();
  for (const authUserId of set.auth_user_ids) {
    const { error } = await serviceDb().auth.admin.updateUserById(authUserId, { password, email_confirm: true });
    if (error) throw new DbError('Unavailable', 'common.unavailable', error.message);
  }
  return { ...set, temporary_password: password };
}

/**
 * "Generate for everyone without a password" (V441): one temporary password for each allowed, switched-on person who
 * holds none in Auth (so never the accounts whose passwords the owner typed himself — V166), each its own logged
 * request; the list goes back to the admin once. Anyone who changed in between (an e-mail removed, a password given)
 * is skipped, named.
 */
export async function generateForEveryoneWithout(reason: string) {
  if (!reason.trim()) throw new DbError('RuleBroken', 'common.reason_required');
  const db = await serverDb();
  const people = unwrap(await db.rpc('people_without_password', {})) as {
    person_id: string;
    full_name_en: string;
    full_name_ar: string | null;
  }[];
  const out = [];
  const skipped = [];
  for (const p of people) {
    try {
      const { temporary_password } = await generatePassword(p.person_id, reason);
      out.push({ ...p, temporary_password });
    } catch (e) {
      if (
        !(e instanceof DbError) ||
        !['person_password.no_sign_in', 'person_password.has_one', 'common.not_found'].includes(e.key)
      )
        throw e;
      skipped.push({ ...p, key: e.key });
    }
  }
  return { people: out, skipped };
}

/** Remove an allowed email (soft, logged): its sign-in is refused at once, and its auth user is banned. */
export async function removeEmail(id: string, reason: string) {
  const db = await serverDb();
  const removed = unwrap(await db.rpc('person_email_remove', { p_id: id, p_reason: reason })) as {
    id: string;
    version: number;
    request_id: string;
    ban: string[];
  };
  for (const authUserId of removed.ban) await setBanned(authUserId, true);
  return removed;
}

/** After any access change to a person: each of their auth users banned or unbanned to match the database. */
export async function syncPerson(personId: string) {
  const state = unwrap(await serviceDb().rpc('person_auth_state', { p_person: personId }));
  for (const row of state) await setBanned(row.auth_user_id, !row.allowed);
  return { synced: state.length };
}

/**
 * Undo from Settings (P3-6d): the database undoes the request — a change of access, an allowed e-mail or a switch is an
 * admin's to undo (V128) — and names the people whose sign-ins it changed; their auth users are banned or unbanned to
 * match, as after any other allow-list change.
 */
export async function undoAndSync(requestId: string) {
  const me = await signedIn();
  const db = await serverDb();
  // The database undoes a sign-in change only against a one-time ticket for this person and this request, named in the
  // call — so Auth is never left behind, and a ticket a failed call leaves serves nobody else (V162, QA-94).
  const ticket = unwrap(
    await serviceDb().rpc('auth_ticket_issue', { p_kind: 'undo', p_target: requestId, p_person: me.person.id }),
  ) as string;
  const done = unwrap(await db.rpc('undo_ticketed', { p_request: requestId, p_ticket: ticket })) as {
    auth_resync?: string[];
  };
  let synced = 0;
  for (const personId of done.auth_resync ?? []) synced += (await syncPerson(personId)).synced;
  return { ...done, synced };
}

/**
 * Restore a removed allowed e-mail or sign-in link, then keep Supabase Auth in step (V162): the database restores a
 * sign-in record only against this route's ticket — for this person and this record, named in the call — and names whose
 * sign-in to re-sync. Any other record restores the same.
 */
export async function restoreAndSync(entity: string, id: string, reason?: string) {
  const me = await signedIn();
  const db = await serverDb();
  const ticket = unwrap(
    await serviceDb().rpc('auth_ticket_issue', {
      p_kind: 'restore',
      p_target: `${entity}:${id}`,
      p_person: me.person.id,
    }),
  ) as string;
  const done = unwrap(
    await db.rpc('restore_ticketed', { p_entity: entity, p_id: id, p_ticket: ticket, p_reason: reason }),
  ) as { auth_resync?: string[] };
  let synced = 0;
  for (const person of done.auth_resync ?? []) synced += (await syncPerson(person)).synced;
  return { ...done, synced };
}

/** An admin signs a person out — every device, or one (logged; the database deletes the sessions). */
export async function signOutPerson(personId: string, deviceId?: string) {
  const db = await serverDb();
  const n = unwrap(await db.rpc('person_sign_out', { p_person: personId, p_device: deviceId }));
  return { signed_out: n };
}
