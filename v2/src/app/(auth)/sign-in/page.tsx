import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getMe } from '@/core/auth/get-me';
import { signInMethod } from '@/core/auth/password-rules';
import { safeNext } from '@/core/auth/safe-next';
import { SignIn } from '@/modules/org/screens/SignIn';

// The sign-in page (TECH-SPEC §4, V59, V75, V204): the brand panel, the workspace name, the two-step form and © Direct.
// A refused session arrives here with ?reason= and is told why in one line (P3-2).
const REFUSALS = new Set(['not_listed', 'switched_off', 'inactive', 'signed_out_elsewhere', 'signed_out_by_admin']);

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; reason?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : null;
  const reason = typeof params.reason === 'string' && REFUSALS.has(params.reason) ? params.reason : null;

  const me = await getMe();
  if (me?.status === 'ok') redirect(safeNext(next));

  const t = await getTranslations();
  return <SignIn next={next} refusal={reason ? t(`sign_in.error.${reason}`) : null} method={signInMethod()} />;
}
