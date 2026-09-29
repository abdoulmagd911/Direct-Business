'use client';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { signInWithPassword, type PasswordError } from '@/core/auth/password-actions';
import { cn } from '@/ui/cn';

/**
 * The password door's form (the visual spec of 29 Sep, V213): Work email and Password, each 48 px; the password has
 * a 40×40 show/hide button and says when Caps Lock is on; an empty field is refused in place, in words, and gets the
 * focus; the button is full width, slate, "Signing in…" while the server answers (the fields read-only meanwhile);
 * every refusal from the server is one banner (role="alert") — and a server that cannot be reached is said as that,
 * never as a wrong password. "Forgot your password? Ask your admin." is plain text under the password, never a link.
 */
export function PasswordDoor({ next, refusal }: { next: string | null; refusal: string | null }) {
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
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate data-step="password">
      {banner ? (
        <div role="alert" className="door-alert" data-door-alert>
          {banner}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.email} className="text-sm font-medium">
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
        <label htmlFor={ids.password} className="text-sm font-medium">
          {t('sign_in.password.label')}
        </label>
        <div className="relative">
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
            className="door-field pe-12"
          />
          <button
            type="button"
            aria-label={shown ? t('sign_in.password.hide') : t('sign_in.password.show')}
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
            className={cn('door-eye absolute end-1 top-1 inline-flex size-10 items-center justify-center rounded-md')}
            data-password-eye
          >
            {shown ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
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
        <p className="door-muted text-[13px]">{t('sign_in.password.forgot')}</p>
      </div>
      <button
        type="submit"
        className="door-button"
        disabled={pending}
        aria-busy={pending || undefined}
        data-door="password"
      >
        {pending ? t('sign_in.password.signingIn') : t('sign_in.password.signIn')}
      </button>
    </form>
  );
}
