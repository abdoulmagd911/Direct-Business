import { DbError } from '@/core/db/errors';
import { adminRoute, generatePassword, textArg, uuidArg } from '@/core/auth/allow-list';

// Settings → People → a person → Reset password (V451, ACC-029): the admin's explicit action, apart from Generate. It
// replaces a password the person holds — one they chose, or one the owner typed himself — so the screen names the
// person and asks to confirm, and the body carries `confirm: true`; without it nothing changes
// (person_password.confirm_required). Logged as a reset, with its reason. Body: person_id, reason, confirm.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    if (body.confirm !== true) throw new DbError('RuleBroken', 'person_password.confirm_required');
    return generatePassword(uuidArg(body, 'person_id') as string, textArg(body, 'reason') ?? '', true);
  });
}
