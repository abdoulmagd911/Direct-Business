import { adminRoute, requireAdmin, signOutPerson, uuidArg } from '@/core/auth/allow-list';

// An admin signs a person out — every device, or one (V74). Body: person_id, device_id?.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireAdmin();
    return signOutPerson(uuidArg(body, 'person_id') as string, uuidArg(body, 'device_id', true));
  });
}
