import 'server-only';
import { getMe } from './get-me';

/**
 * Whether this session's person must set their own password first (first sign-in, or after an admin's generate). The
 * database decides and says so: api.me() answers `must_change_password` until the server records the change (V166) —
 * never the browser, and never a copy the cookie carries (QA-92). Answered from the request's one api.me() (getMe is
 * cached), so it costs no extra request.
 */
export async function mustChangePassword(): Promise<boolean> {
  return (await getMe())?.status === 'must_change_password';
}
