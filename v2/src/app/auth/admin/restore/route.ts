import { adminRoute, restoreAndSync, uuidArg } from '@/core/auth/allow-list';

// Restore from Recently deleted, then keep Supabase Auth in step (V162): restoring an allowed e-mail or a sign-in link
// re-syncs that person's ban. The database decides who may restore. Body: entity, id, reason.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => {
    const entity = typeof body.entity === 'string' && /^[a-z][a-z0-9_]*$/.test(body.entity) ? body.entity : '';
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    return restoreAndSync(entity, uuidArg(body, 'id') as string, reason);
  });
}
