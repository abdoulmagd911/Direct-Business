'use client';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import { setOwnPassword, type PasswordError } from '@/core/auth/password-actions';
import { MIN_PASSWORD } from '@/core/auth/password-rules';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { BrandPanel } from './BrandPanel';

/**
 * Set your own password (owner, 29 Sep 13:50): the first sign-in, or after an admin's reset. The rule is one line of
 * fact (at least ten characters) — no strength meter. Same layout as the sign-in page (V75, V204).
 */
export function SetPassword({ next }: { next: string }) {
  const t = useTranslations();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<PasswordError | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await setOwnPassword(password, again, next);
      if (r && !r.ok) setError(r.error);
    });
  };
  const line = error ? t(`sign_in.password.error.${error}`) : undefined;
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text md:flex-row" data-set-password>
      <BrandPanel />
      <main className="flex min-w-0 flex-1 flex-col px-6 py-6 sm:px-10">
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="flex w-full max-w-[440px] flex-col gap-8">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-3xl">{t('sign_in.password.setTitle')}</h1>
              <p className="text-base text-muted">{t('sign_in.password.rule', { min: MIN_PASSWORD })}</p>
            </div>
            <form
              className="flex flex-col gap-5 rounded-lg border border-border bg-raised p-6 shadow-2 sm:p-8"
              onSubmit={submit}
              noValidate
            >
              <Field label={t('sign_in.password.new')} error={line}>
                {(p) => (
                  <Input
                    {...p}
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 text-[15px]"
                    autoFocus
                  />
                )}
              </Field>
              <Field label={t('sign_in.password.again')}>
                {(p) => (
                  <Input
                    {...p}
                    type="password"
                    name="new-password-again"
                    autoComplete="new-password"
                    value={again}
                    onChange={(e) => setAgain(e.target.value)}
                    className="h-12 text-[15px]"
                  />
                )}
              </Field>
              <Button
                type="submit"
                variant="primary"
                className="h-12 text-[15px]"
                loading={pending}
                disabled={password.length < MIN_PASSWORD || again.length < MIN_PASSWORD}
                data-set-password-save
              >
                {t('sign_in.password.setAndContinue')}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
