import { word } from '@/core/auth/words';

// Every signed-in address until P3-3's shell and the modules' own pages exist (theirs win over this catch-all): the
// workspace name, the address asked for — so a deep link can be seen to come back — and Sign out.
export default async function Placeholder({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return (
    <main>
      <h1>{word('app.name')}</h1>
      <p data-testid="address">/{(path ?? []).join('/')}</p>
      <form method="post" action="/auth/sign-out">
        <button type="submit">{word('session.sign_out')}</button>
      </form>
    </main>
  );
}
