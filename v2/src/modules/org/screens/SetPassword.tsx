'use client';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { setOwnPassword, type PasswordError } from '@/core/auth/password-actions';
import { MIN_PASSWORD } from '@/core/auth/password-rules';
import { DoorFrame } from './DoorFrame';

/**
 * Choose a new password (owner, 29 Sep 13:50): the first sign-in, or after an admin's reset. The rule is one line of
 * fact (at least ten characters) — no strength meter. Drawn in the door frame, like sign-in (V213).
 */
export function SetPassword({ next, arabicEnabled = false }: { next: string; arabicEnabled?: boolean }) {
  const t = useTranslations();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<PasswordError | null>(null);
  const [pending, start] = useTransition();
  const ids = { password: useId(), again: useId() };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      try {
        const r = await setOwnPassword(password, again, next);
        if (r && !r.ok) setError(r.error);
      } catch (err) {
        if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err;
        setError('unavailable');
      }
    });
  };
  const line = error ? t(`sign_in.password.error.${error}`) : null;
  return (
    <DoorFrame
      arabicEnabled={arabicEnabled}
      footer={t('sign_in.footer', { year: new Date().getFullYear() })}
      data-set-password
    >
      <div className="flex flex-col gap-2 pb-8">
        <h1 className="font-display text-2xl font-semibold leading-8 sm:text-[28px] sm:leading-9">
          {t('sign_in.password.setTitle')}
        </h1>
        <p className="door-muted text-[15px] leading-[22px]">{t('sign_in.password.rule', { min: MIN_PASSWORD })}</p>
      </div>
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        {line ? (
          <div role="alert" className="door-alert">
            {line}
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.password} className="text-sm font-medium">
            {t('sign_in.password.new')}
          </label>
          <input
            id={ids.password}
            type="password"
            name="new-password"
            autoComplete="new-password"
            required
            dir="ltr"
            autoFocus
            value={password}
            readOnly={pending}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setPassword(e.target.value)}
            className="door-field"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.again} className="text-sm font-medium">
            {t('sign_in.password.again')}
          </label>
          <input
            id={ids.again}
            type="password"
            name="new-password-again"
            autoComplete="new-password"
            required
            dir="ltr"
            value={again}
            readOnly={pending}
            onChange={(e) => setAgain(e.target.value)}
            className="door-field"
          />
        </div>
        <button
          type="submit"
          className="door-button"
          disabled={pending || password.length < MIN_PASSWORD || again.length < MIN_PASSWORD}
          aria-busy={pending || undefined}
          data-set-password-save
        >
          {t('sign_in.password.setAndContinue')}
        </button>
      </form>
    </DoorFrame>
  );
}
