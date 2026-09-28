'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { devSignInApi, type SignInApi, type SignInRefusal } from '@/core/auth/signIn';
import { setPref } from '@/core/prefs';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { BrandPanel } from './BrandPanel';

/**
 * Sign-in (canvas artboards 1 and 1b, spec §4, V59, V204): the brand panel at the inline start, the
 * form at the inline end; on a phone the panel is a band on top. The only door is the emailed code:
 * the work email and "Send code", then the 6-digit step with "Keep me signed in", Resend and Change.
 * One step at a time. Every refusal is a sentence in place of the data.
 */
export function SignIn({ next, api = devSignInApi }: { next: string; api?: SignInApi }) {
  const t = useTranslations('signIn');
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<SignInRefusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [keep, setKeep] = useState(true);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [resendIn, setResendIn] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  const sendCode = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('invalidEmail');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await api.sendCode(email.trim());
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    setStep('code');
    setDigits(Array(6).fill(''));
    setResendIn(45);
    window.setTimeout(() => inputs.current[0]?.focus(), 0);
  };

  const verify = async (code = digits.join('')) => {
    if (code.length < 6) return;
    setBusy(true);
    setError(null);
    const r = await api.verifyCode(email.trim(), code, keep);
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    router.replace(next.startsWith('/') ? next : '/my-day');
  };

  const onDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    const nextDigits = [...digits];
    if (clean.length > 1) {
      clean
        .split('')
        .slice(0, 6 - i)
        .forEach((c, k) => (nextDigits[i + k] = c));
      setDigits(nextDigits);
      inputs.current[Math.min(5, i + clean.length - 1)]?.focus();
    } else {
      nextDigits[i] = clean;
      setDigits(nextDigits);
      if (clean && i < 5) inputs.current[i + 1]?.focus();
    }
    if (nextDigits.every(Boolean)) void verify(nextDigits.join(''));
  };

  const maskedEmail = email.replace(/^(.)[^@]*@(.)[^.]*/, '$1•••••@$2•••');
  const errorText = error ? t(`errors.${error}`) : undefined;
  const card = 'flex flex-col gap-5 rounded-lg border border-border bg-raised p-6 shadow-2 sm:p-8';

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text md:flex-row" data-sign-in>
      <BrandPanel />
      <div className="flex min-w-0 flex-1 flex-col px-6 py-6 sm:px-10">
        <div className="flex justify-end">
          <div
            role="group"
            aria-label={t('language')}
            className="inline-flex rounded-md border border-border bg-raised p-0.5"
          >
            {(['en', 'ar'] as const).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={locale === l}
                onClick={() => {
                  setPref('locale', l);
                  window.location.reload();
                }}
                className={cn(
                  'h-8 rounded-[5px] px-3 text-sm',
                  locale === l ? 'bg-text font-medium text-raised' : 'text-muted',
                )}
              >
                {l === 'en' ? 'EN' : 'ع'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="flex w-full max-w-[440px] flex-col gap-8">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-3xl">{t('title')}</h1>
              <p
                lang={locale === 'ar' ? 'en' : 'ar'}
                dir={locale === 'ar' ? 'ltr' : 'rtl'}
                className="text-end text-lg text-muted"
              >
                {locale === 'ar' ? 'Commercial Workspace' : 'مساحة العمل التجارية'}
              </p>
            </div>

            {step === 'email' ? (
              <form
                className={card}
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendCode();
                }}
                data-step="email"
              >
                <Field label={t('email')} error={errorText}>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-[15px]"
                      autoFocus
                    />
                  )}
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 text-[15px]"
                  loading={busy}
                  data-door="code"
                >
                  {t('sendCode')}
                </Button>
              </form>
            ) : (
              <form
                className={card}
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify();
                }}
                data-step="code"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold">{t('codeTitle')}</span>
                  <span className="text-base text-muted">
                    {t('codeSent', { email: maskedEmail })} ·{' '}
                    <button
                      type="button"
                      className="font-medium text-link hover:underline"
                      onClick={() => setStep('email')}
                    >
                      {t('change')}
                    </button>
                  </span>
                </div>
                <div className="flex justify-between gap-2.5" dir="ltr">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={t('digit', { n: i + 1 })}
                      aria-invalid={error ? true : undefined}
                      value={d}
                      onChange={(e) => onDigit(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                      }}
                      className="h-14 w-full rounded-md border border-border-strong bg-raised text-center font-data text-2xl text-text focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 aria-invalid:border-danger"
                    />
                  ))}
                </div>
                {errorText ? (
                  <p role="alert" className="text-sm text-danger">
                    {errorText}
                  </p>
                ) : null}
                <label className="flex items-center gap-2.5 text-base">
                  <Checkbox checked={keep} onCheckedChange={setKeep} label={t('keepSignedIn')} />
                  {t('keepSignedIn')}
                </label>
                <Button type="submit" variant="primary" className="h-12 text-[15px]" loading={busy}>
                  {t('verify')}
                </Button>
                <div className="flex items-center justify-center gap-2 text-base">
                  <button
                    type="button"
                    disabled={resendIn > 0}
                    className="font-medium text-link hover:underline disabled:text-muted disabled:no-underline"
                    onClick={() => void sendCode()}
                  >
                    {t('resend')}
                  </button>
                  {resendIn > 0 ? (
                    <span className="font-data text-sm text-muted">
                      0:{String(resendIn).padStart(2, '0')}
                    </span>
                  ) : null}
                </div>
              </form>
            )}
          </div>
        </div>
        <p className="text-center text-sm text-muted md:hidden">{t('footer')}</p>
      </div>
    </div>
  );
}
