import 'server-only';
import { serverDb } from '@/core/db/server';

/**
 * Whether this session's person must set their own password first (first sign-in, or after an admin's reset). The
 * flag rides in the access token's `app_metadata` (set with the secret key by the admin route, cleared by
 * setOwnPassword), so reading it costs no request: the token the cookie holds says so.
 */
export async function mustChangePassword(): Promise<boolean> {
  const db = await serverDb();
  const { data } = await db.auth.getSession();
  return data.session?.user.app_metadata?.must_change_password === true;
}
