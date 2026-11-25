import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMe } from '@/core/auth/get-me';
import { mustChangePassword } from '@/core/auth/must-change';
import { safeNext } from '@/core/auth/safe-next';
import { SetPassword } from '@/modules/org/screens/SetPassword';
import { SetPasswordStart } from '@/modules/org/screens/SetPasswordStart';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('sign_in.password.startTitle') };
}

/**
 * "Set your own password" (owner, 29 Sep 13:50): shown to a signed-in person whose password must change — the first
 * sign-in, or after an admin's reset. No shell: the person is not in yet. Someone with nothing to change goes on.
 *
 * Landing 52 (FIX-19): the sign-in page links here, so a visitor who is NOT signed in is no longer bounced back to
 * the sign-in page (the link would have led nowhere). They get the first step — work email and the temporary
 * password from their admin, the sign-in door's own form and server check — and, once signed in with it, the step
 * below. No e-mail is sent; a person without a temporary password is told, as on the door, to ask their admin.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(typeof next === 'string' ? next : null);
  const me = await getMe();
  if (!me) return <SetPasswordStart next={typeof next === 'string' ? next : null} />;
  if (me.status === 'ok') redirect(target);
  // api.me() answers must_change_password for exactly this person (V166); any other refusal is the sign-out's to word.
  if (!(await mustChangePassword())) redirect('/auth/sign-out');
  return <SetPassword next={target} />;
}
