import { addEmail, adminRoute, emailArg, requireLevel, textArg, uuidArg } from '@/core/auth/allow-list';

// Settings → Organization & access → the person → Emails → Add (P3-5's screen). Body: person_id, email, primary?, reason?
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireLevel('settings.org', 'full');
    const personId = uuidArg(body, 'person_id') as string;
    return addEmail(personId, emailArg(body, 'email'), body.primary === true, textArg(body, 'reason'));
  });
}
