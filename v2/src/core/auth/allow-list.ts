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

/** The auth user for an allowed email: created confirmed (a door never makes a person — the person exists first). */
async function ensureAuthUser(email: string): Promise<string> {
  const admin = serviceDb().auth.admin;
  const created = await admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  const existing = unwrap(await serviceDb().rpc('auth_user_of', { p_email: email }));
  if (!existing) throw new DbError('Unavailable', 'common.unavailable', created.error?.message);
  return existing;
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
  const authUserId = await ensureAuthUser(email);
  unwrap(await db.rpc('person_auth_link', { p_email: email, p_auth_user_id: authUserId }));
  await syncPerson(personId);
  return { ...added, auth_user_id: authUserId };
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
  const db = await serverDb();
  // The database undoes a sign-in change only against this route's one-time ticket, so Auth is never left behind (V162).
  unwrap(await serviceDb().rpc('auth_ticket_issue', { p_kind: 'undo', p_target: requestId }));
  const done = unwrap(await db.rpc('undo', { p_request: requestId })) as { auth_resync?: string[] };
  let synced = 0;
  for (const personId of done.auth_resync ?? []) synced += (await syncPerson(personId)).synced;
  return { ...done, synced };
}

/**
 * Restore a removed allowed e-mail or sign-in link, then keep Supabase Auth in step (V162): the database restores a
 * sign-in record only against this route's ticket, and names whose sign-in to re-sync. Any other record restores the same.
 */
export async function restoreAndSync(entity: string, id: string, reason?: string) {
  const db = await serverDb();
  unwrap(await serviceDb().rpc('auth_ticket_issue', { p_kind: 'restore', p_target: `${entity}:${id}` }));
  const done = unwrap(await db.rpc('restore', { p_entity: entity, p_id: id, p_reason: reason })) as {
    auth_resync?: string[];
  };
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
