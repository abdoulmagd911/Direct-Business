'use client';
import { DbError, type DbErrorKind } from '@/core/db/errors';
import { rpc } from '@/core/db/rpc';

// Undo and Restore from the browser (V128, V162). A request or a record that changes who may sign in — an allowed
// e-mail, a sign-in link, a person switched on or off — is undone or restored only by the server's admin route, which
// keeps Supabase Auth in step; the database refuses it anywhere else (undo.via_admin_route / restore.via_admin_route,
// the route in its detail). Every screen calls these two, so that refusal is simply followed.

async function viaRoute<T>(route: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as
    ({ ok: true } & T) | { ok: false; error: { kind: DbErrorKind; key: string } } | null;
  if (!json) throw new DbError('Unavailable', 'common.unavailable', String(res.status));
  if (!json.ok) throw new DbError(json.error.kind, json.error.key);
  return json;
}

/** Undo a whole request (all or nothing). */
export async function undoRequest(requestId: string): Promise<{ request_id?: string | null } | null> {
  try {
    return (await rpc('undo', { p_request: requestId })) as { request_id?: string | null } | null;
  } catch (e) {
    if (!(e instanceof DbError) || e.key !== 'undo.via_admin_route') throw e;
    return viaRoute('/auth/admin/undo', { request_id: requestId });
  }
}

/** Restore a removed record from Recently deleted. */
export async function restoreRecord(
  entity: string,
  id: string,
  reason?: string,
): Promise<{ request_id?: string | null }> {
  try {
    return (await rpc('restore', { p_entity: entity, p_id: id, p_reason: reason })) as { request_id?: string | null };
  } catch (e) {
    if (!(e instanceof DbError) || e.key !== 'restore.via_admin_route') throw e;
    return viaRoute('/auth/admin/restore', { entity, id, reason });
  }
}
