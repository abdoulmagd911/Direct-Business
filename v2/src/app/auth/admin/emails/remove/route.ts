import { adminRoute, removeEmail, requireAdmin, textArg, uuidArg } from '@/core/auth/allow-list';

// The person's allowed email → Remove (asks by name, D19; the reason is required). Body: id, reason.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireAdmin();
    return removeEmail(uuidArg(body, 'id') as string, textArg(body, 'reason') ?? '');
  });
}
