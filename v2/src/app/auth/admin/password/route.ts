import { adminRoute, generatePassword, textArg, uuidArg } from '@/core/auth/allow-list';

// Settings → People → a person → Generate temporary password (V441): admins only, with a reason, for a person who holds
// no password yet. The server links every allowed e-mail of the person to its existing auth user (never a second),
// makes the password (16 characters), sets it on every sign-in with "must change password", and answers it once as
// `temporary_password` — the screen shows it with Copy. A person who already holds one is refused
// (person_password.has_one): replacing it is a Reset, /auth/admin/password/reset (V451, ACC-029). Body: person_id,
// reason. Nothing is mailed; the generate is logged, never the password.
export async function POST(request: Request) {
  return adminRoute(request, async (body) =>
    generatePassword(uuidArg(body, 'person_id') as string, textArg(body, 'reason') ?? ''),
  );
}
