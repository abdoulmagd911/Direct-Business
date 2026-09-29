import { adminRoute, removeEmail, requireLevel, textArg, uuidArg } from '@/core/auth/allow-list';

// The person's allowed email → Remove (asks by name, D19; the reason is required). Body: id, reason.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireLevel('settings.org', 'full');
    return removeEmail(uuidArg(body, 'id') as string, textArg(body, 'reason') ?? '');
  });
}
