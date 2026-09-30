import { adminRoute, generateForEveryoneWithout, textArg } from '@/core/auth/allow-list';

// Settings → People → Generate for everyone without a password (V441): admins only, with a reason. One temporary
// password for each allowed, switched-on person who never had one; the list is answered once, to copy. Body: reason.
export async function POST(request: Request) {
  return adminRoute(request, async (body) => generateForEveryoneWithout(textArg(body, 'reason') ?? ''));
}
