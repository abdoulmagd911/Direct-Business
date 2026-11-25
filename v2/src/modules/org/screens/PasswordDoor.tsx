'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { signInWithPassword, type PasswordError } from '@/core/auth/password-actions';
import { cn } from '@/ui/cn';

/**
 * The password door's form (the visual spec of 29 Sep, V213): Work email and Password, each 48 px; the password has
 * a 40×40 show/hide button and says when Caps Lock is on; an empty field is refused in place, in words, and gets the
 * focus; the button is full width, slate, "Signing in…" while the server answers (the fields read-only meanwhile);
 * every refusal from the server is one banner (role="alert") — and a server that cannot be reached is said as that,
 * never as a wrong password. "Forgot your password? Ask your admin." is plain text under the password, never a link.
 *
 * Landing 52 (FIX-19, the F1 live re-test of 25 Nov): under that line the door now carries one link, "Have a
 * temporary password? Set your password", to /set-password — the page where someone whose admin has just given them
 * a temporary password signs in with it and chooses their own. No e-mail is sent by either page (owner, 29 Sep).
 * That page draws this same form as its first step (`temporary`): the password box is named "Temporary password", the
 * button says "Continue", and the link under the box is "Back to sign in".
 */
export function PasswordDoor({
  next,
  refusal,
  temporary = false,
}: {
  next: string | null;
  refusal: string | null;
  /** The first step of /set-password: the same form and the same server check, worded for a temporary password. */
  temporary?: boolean;
}) {
  const t = useTranslations();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const [missing, setMissing] = useState<{ email?: true; password?: true }>({});
  const [error, setError] = useState<PasswordError | null>(null);
  const [shownRefusal, setShownRefusal] = useState(refusal);
  const [pending, start] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ids = { email: useId(), password: useId() };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const need: { email?: true; password?: true } = {};
    if (!email.trim()) need.email = true;
    if (!password) need.password = true;
    setMissing(need);
    if (need.email) return emailRef.current?.focus();
    if (need.password) return passwordRef.current?.focus();
    start(async () => {
      setError(null);
      setShownRefusal(null);
      try {
        const r = await signInWithPassword(email, password, next);
        if (r && !r.ok) {
          if (r.error === 'invalid_email') {
            setMissing({ email: true });
            emailRef.current?.focus();
          } else setError(r.error);
        }
      } catch (err) {
        // a redirect is how a success leaves; anything else means the server was not reached
        if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err;
        setError('unavailable');
      }
    });
  };

  const capsOf = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'));
  const banner = error ? t(`sign_in.password.error.${error}`) : (shownRefusal ?? null);

  return (
    // method="post": a sign-in pressed before the page's script has loaded is the browser's own submit — a POST keeps
    // the e-mail and password out of the address (a GET wrote them into the address bar, the history and the server's
    // request log). The page answers it by drawing the door again, and the next press signs in.
    <form method="post" className="flex flex-col gap-5" onSubmit={submit} noValidate data-step="password">
      {banner ? (
        <div role="alert" className="door-alert" data-door-alert>
          {banner}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.email} className="door-label">
          {t('sign_in.email_label')}
        </label>
        <input
          ref={emailRef}
          id={ids.email}
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          dir="ltr"
          value={email}
          readOnly={pending}
          aria-invalid={missing.email || undefined}
          aria-describedby={missing.email ? `${ids.email}-error` : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (missing.email) setMissing((m) => ({ ...m, email: undefined }));
          }}
          className="door-field"
        />
        {missing.email ? (
          <p id={`${ids.email}-error`} className="door-field-error">
            {t('sign_in.password.error.email_required')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.password} className="door-label">
          {temporary ? t('sign_in.password.temporary') : t('sign_in.password.label')}
        </label>
        {/* dir="ltr" with the box: a password is typed left to right, so its room for the eye is on the right — in
            Arabic the eye sat at the page's end (the left) on top of the first characters */}
        <div className="relative" dir="ltr">
          <input
            ref={passwordRef}
            id={ids.password}
            type={shown ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            required
            dir="ltr"
            value={password}
            readOnly={pending}
            aria-invalid={missing.password || undefined}
            aria-describedby={
              [missing.password ? `${ids.password}-error` : null, caps ? `${ids.password}-caps` : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(e) => {
              setPassword(e.target.value);
              if (missing.password) setMissing((m) => ({ ...m, password: undefined }));
            }}
            onKeyDown={capsOf}
            onKeyUp={capsOf}
            onBlur={() => setCaps(false)}
            className="door-field pe-20"
          />
          <button
            type="button"
            aria-label={shown ? t('sign_in.password.hide') : t('sign_in.password.show')}
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
            className={cn(
              'door-eye absolute end-1.5 top-1.5 inline-flex h-8 min-w-11 items-center justify-center px-3',
            )}
            data-password-eye
          >
            {shown ? t('sign_in.password.hideWord') : t('sign_in.password.showWord')}
          </button>
        </div>
        {caps ? (
          <p id={`${ids.password}-caps`} className="door-caps" data-caps-lock>
            {t('sign_in.password.capsLock')}
          </p>
        ) : null}
        {missing.password ? (
          <p id={`${ids.password}-error`} className="door-field-error">
            {t('sign_in.password.error.password_required')}
          </p>
        ) : null}
        <p className="door-muted text-[13px] leading-[18px]">{t('sign_in.password.forgot')}</p>
        <p className="text-[13px] leading-[18px]">
          {temporary ? (
            <Link href="/sign-in" className="door-link" data-door-back>
              {t('sign_in.password.backToSignIn')}
            </Link>
          ) : (
            <Link href="/set-password" className="door-link" data-door-set-password>
              {t('sign_in.password.setLink')}
            </Link>
          )}
        </p>
      </div>
      <button
        type="submit"
        className="door-button"
        disabled={pending}
        aria-busy={pending || undefined}
        data-door={temporary ? 'temporary-password' : 'password'}
      >
        {pending
          ? t('sign_in.password.signingIn')
          : temporary
            ? t('sign_in.password.continue')
            : t('sign_in.password.signIn')}
      </button>
    </form>
  );
}
