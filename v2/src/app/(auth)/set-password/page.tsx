import { redirect } from 'next/navigation';
import { getMe } from '@/core/auth/get-me';
import { mustChangePassword } from '@/core/auth/must-change';
import { safeNext } from '@/core/auth/safe-next';
import { SetPassword } from '@/modules/org/screens/SetPassword';

/**
 * "Set your own password" (owner, 29 Sep 13:50): shown to a signed-in person whose password must change — the first
 * sign-in, or after an admin's reset. No shell: the person is not in yet. Someone with nothing to change goes on.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(typeof next === 'string' ? next : null);
  const me = await getMe();
  if (!me) redirect(`/sign-in?next=${encodeURIComponent('/set-password')}`);
  if (me.status === 'ok') redirect(target);
  // api.me() answers must_change_password for exactly this person (V166); any other refusal is the sign-out's to word.
  if (!(await mustChangePassword())) redirect('/auth/sign-out');
  return <SetPassword next={target} />;
}
