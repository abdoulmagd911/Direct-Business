import { adminRoute, requireAdmin, syncPerson, uuidArg } from '@/core/auth/allow-list';

// After switching a person off or on (P3-5): their auth users banned or unbanned to match the database. Body: person_id.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    await requireAdmin();
    return syncPerson(uuidArg(body, 'person_id') as string);
  });
}
