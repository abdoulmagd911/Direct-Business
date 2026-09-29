import 'server-only';
import { serverDb } from '@/core/db/server';

/**
 * Whether this session's person must set their own password first (first sign-in, or after an admin's reset). The
 * flag rides in the auth user's `app_metadata` (set with the secret key by the admin route, cleared by setOwnPassword)
 * and is read from the user Supabase Auth verifies for this request — never from the cookie's stored copy, which the
 * browser could edit (QA-92). Until builder A's flag on `api.me()` lands, this is the one extra request of the gate.
 */
export async function mustChangePassword(): Promise<boolean> {
  const db = await serverDb();
  const { data } = await db.auth.getUser();
  return data.user?.app_metadata?.must_change_password === true;
}
