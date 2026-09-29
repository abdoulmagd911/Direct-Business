import { DbError, unwrap } from '@/core/db/errors';
import { serviceDb } from '@/core/db/service';
import { adminRoute, requireLevel, textArg, uuidArg } from '@/core/auth/allow-list';
import { MUST_CHANGE, passwordOk } from '@/core/auth/password-rules';

/** Letters and digits nobody misreads: no 0/O, 1/l/I. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function temporaryPassword(length = 14): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/**
 * Settings → People: Set password (the admin types it) or Reset password (a temporary one, shown once) for a person —
 * admins only, with a reason (owner, 29 Sep 13:50). Every auth user of the person gets the password and the
 * must-change flag, so their next sign-in asks them to set their own. Body: person_id, mode ('set' | 'reset'),
 * password (set only), reason.
 */
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireLevel('settings.org', 'full');
    const personId = uuidArg(body, 'person_id') as string;
    const mode = body.mode === 'reset' ? 'reset' : body.mode === 'set' ? 'set' : null;
    if (!mode) throw new DbError('RuleBroken', 'common.bad_request', 'mode');
    const reason = textArg(body, 'reason');
    if (!reason) throw new DbError('RuleBroken', 'common.reason_required');
    const password = mode === 'set' ? String(body.password ?? '') : temporaryPassword();
    if (!passwordOk(password)) throw new DbError('RuleBroken', 'password.too_short');
    const state = unwrap(await serviceDb().rpc('person_auth_state', { p_person: personId }));
    if (!state.length) throw new DbError('RuleBroken', 'password.no_email');
    const admin = serviceDb().auth.admin;
    for (const row of state) {
      const { data: current } = await admin.getUserById(row.auth_user_id);
      const { error } = await admin.updateUserById(row.auth_user_id, {
        password,
        app_metadata: { ...(current?.user?.app_metadata ?? {}), [MUST_CHANGE]: true },
      });
      if (error) throw new DbError('Unavailable', 'common.unavailable', error.message);
    }
    // NEED (builder A): a logged request for "password set / reset by <admin>, reason" — the sign-in log's results
    // do not include it yet; until then the change is visible only in the person's next sign-in.
    return mode === 'reset' ? { temporary_password: password } : {};
  });
}
