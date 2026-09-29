import { adminRoute, createPerson, requireLevel, textArg } from '@/core/auth/allow-list';

// Settings → Organization & access → People → Add (ACC-093): the person with their allowed e-mail, role and sign-in
// switch, one request. Body: person (full_name_en, department_id, email?, role_id?, can_sign_in?, …), reason?.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireLevel('settings.org', 'full');
    const person = body.person && typeof body.person === 'object' ? (body.person as Record<string, unknown>) : {};
    return createPerson(person, textArg(body, 'reason'));
  });
}
