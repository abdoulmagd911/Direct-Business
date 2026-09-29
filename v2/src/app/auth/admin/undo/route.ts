import { adminRoute, undoAndSync, uuidArg } from '@/core/auth/allow-list';

// Undo, then keep Supabase Auth in step (P3-6d): undoing an allowed e-mail, a sign-in link or a switch re-syncs the
// bans of the people it touched. The database decides who may undo (V128). Body: request_id.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => undoAndSync(uuidArg(body, 'request_id') as string));
}
