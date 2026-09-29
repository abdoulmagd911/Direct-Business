import { addEmail, adminRoute, emailArg, requireLevel, textArg, uuidArg } from '@/core/auth/allow-list';

// Settings → Organization & access → the person → Emails → Add (P3-5's screen). Body: person_id, email, primary?, reason?,
// password? — with a password (and then a reason), the sign-in is created with it as its starting password (V166).
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireLevel('settings.org', 'full');
    const personId = uuidArg(body, 'person_id') as string;
    const password = typeof body.password === 'string' ? body.password : undefined;
    return addEmail(personId, emailArg(body, 'email'), body.primary === true, textArg(body, 'reason'), password);
  });
}
