import { adminRoute, generatePassword, textArg, uuidArg } from '@/core/auth/allow-list';

// Settings → People → a person → Generate temporary password (V441): admins only, with a reason. The server links every
// allowed e-mail of the person to its existing auth user (never a second), makes the password (16 characters), sets it
// on every sign-in with "must change password", and answers it once — the screen shows it with Copy. A person who
// already holds a password keeps it (person_password.has_one) unless the admin asks for a Reset: `replace: true`.
// Body: person_id, reason, replace?. Nothing is mailed or logged.
export async function POST(request: Request) {
  return adminRoute(request, async (body) =>
    generatePassword(uuidArg(body, 'person_id') as string, textArg(body, 'reason') ?? '', body.replace === true),
  );
}
