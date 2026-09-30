import { DbError } from '@/core/db/errors';
import { adminRoute, requireLevel, switchPerson, textArg, uuidArg } from '@/core/auth/allow-list';

// Settings → People → a person → Switch sign-in off / on (P3-5): the database's switch and Auth's ban in one call, so a
// switched-off person's auth users are banned at once and an Undo (/auth/admin/undo) lifts it (ACC-100).
// Body: person_id, on, reason.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireLevel('settings.org', 'full');
    if (typeof body.on !== 'boolean') throw new DbError('RuleBroken', 'common.bad_request', 'on');
    return switchPerson(uuidArg(body, 'person_id') as string, body.on, textArg(body, 'reason') ?? '');
  });
}
