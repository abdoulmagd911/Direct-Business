import { redirect } from 'next/navigation';
import { getMe } from '@/core/auth/get-me';
import { safeNext } from '@/core/auth/safe-next';
import { word } from '@/core/auth/words';
import { SignInForm } from './sign-in-form';

// The sign-in page says only this (TECH-SPEC §4, V59, V75): the workspace name, the brand line, the form and © Direct.
// The logo, the brand panel and the language toggle come with P3-3's styled page; Arabic stays off until approved.
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

  return (
    <main>
      <h1>{word('app.name')}</h1>
      <p>{word('app.brand_line')}</p>
      <SignInForm next={next} refusal={reason ? word(`sign_in.error.${reason}`) : null} />
      <footer>{word('app.copyright')}</footer>
    </main>
  );
}
