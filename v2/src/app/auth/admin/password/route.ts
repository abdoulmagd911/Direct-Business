import { adminRoute, setPassword, textArg, uuidArg } from '@/core/auth/allow-list';

// Settings → Organization & access → the person → Emails → Set password (V166): an admin gives the sign-in of an
// allowed e-mail its starting password, or resets it. The database decides who may and logs it; the person changes it
// at the next sign-in. Body: email_id (the person_email id), password, reason. The password is never logged.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    const password = typeof body.password === 'string' ? body.password : '';
    const reason = textArg(body, 'reason') ?? '';
    return setPassword(uuidArg(body, 'email_id') as string, password, reason);
  });
}
