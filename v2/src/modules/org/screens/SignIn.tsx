'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, useTransition, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { sendCode, verifyCode, type SignInError } from '@/core/auth/actions';
import { signInWithPassword, type PasswordError } from '@/core/auth/password-actions';
import type { SignInMethod } from '@/core/auth/password-rules';
import { maskEmail } from '@/core/auth/mask';
import { clock, useCountdown } from '@/core/auth/use-countdown';
import { setPref } from '@/core/prefs';
import { Button } from '@/ui/Button';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/Field';
import { Input } from '@/ui/Input';
import { BrandPanel } from './BrandPanel';

/**
 * Sign-in (canvas artboards 1 and 1b, TECH-SPEC §4, V59, V74, V75, V204): the brand panel at the inline start, the
 * form at the inline end; on a phone the panel is a band on top. The door is the work email and the **password**
 * (owner, 29 Sep 13:50: no emails are sent; "Forgot your password? Ask an admin"), run on the server
 * (core/auth/password-actions.ts). The emailed-code door (Send code, then the 6-digit step with Resend and Change;
 * core/auth/actions.ts, P3-2) stays in the code behind SIGN_IN_METHOD=code. Devices stay signed in until sign-out
 * (V74); every refusal is one line in place (role="alert"). The language switch waits for Arabic (V122).
 */
const RESEND_AFTER_S = 60;
const EMPTY = ['', '', '', '', '', ''];

export function SignIn({
  next,
  refusal,
  arabicEnabled = false,
  method = 'password',
}: {
  next: string | null;
  refusal: string | null;
  /** The EN | ع switch shows once the owner switches Arabic on (`app.arabic_enabled`, P6-7; V122). */
  arabicEnabled?: boolean;
  method?: SignInMethod;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [error, setError] = useState<SignInError | PasswordError | null>(null);
  const [password, setPassword] = useState('');
  const [shownRefusal, setShownRefusal] = useState(refusal);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [wait, startWait] = useCountdown();

  const ask = (then?: () => void) =>
    start(async () => {
      setError(null);
      setShownRefusal(null);
      const r = await sendCode(email);
      if (!r.ok) return setError(r.error);
      setEmail(r.email);
      setSentAt(Date.now());
      startWait(RESEND_AFTER_S);
      setDigits(EMPTY);
      setStep('code');
      then?.();
    });

  const verify = (code: string) =>
    start(async () => {
      setError(null);
      const r = await verifyCode(email, code, next, sentAt ?? 0);
      if (r && !r.ok) setError(r.error);
    });

  const onEmail = (e: FormEvent) => {
    e.preventDefault();
    ask(() => requestAnimationFrame(() => boxes.current[0]?.focus()));
  };

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      setShownRefusal(null);
      const r = await signInWithPassword(email, password, next);
      if (r && !r.ok) setError(r.error);
    });
  };

  const onCode = (e: FormEvent) => {
    e.preventDefault();
    if (digits.every(Boolean)) verify(digits.join(''));
  };

  const put = (i: number, value: string) => {
    const got = value.replace(/\D/g, '');
    if (got.length > 1) return fill(i, got);
    setDigits((d) => d.map((x, j) => (j === i ? got : x)));
    if (got && i < 5) boxes.current[i + 1]?.focus();
  };

  const fill = (from: number, text: string) => {
    const got = text
      .replace(/\D/g, '')
      .slice(0, 6 - from)
      .split('');
    setDigits((d) => d.map((x, j) => (j >= from && j - from < got.length ? (got[j - from] ?? x) : x)));
    boxes.current[Math.min(5, from + got.length)]?.focus();
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fill(i, e.clipboardData.getData('text'));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
  };

  const line = error
    ? t.has(`sign_in.error.${error}`)
      ? t(`sign_in.error.${error}`)
      : t(`sign_in.password.error.${error}`)
    : (shownRefusal ?? undefined);
  const card = 'flex flex-col gap-5 rounded-lg border border-border bg-raised p-6 shadow-2 sm:p-8';

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text md:flex-row" data-sign-in>
      <BrandPanel />
      <main className="flex min-w-0 flex-1 flex-col px-6 py-6 sm:px-10">
        <div className="flex min-h-8 justify-end">
          {arabicEnabled ? (
            <div
              role="group"
              aria-label={t('sign_in.language')}
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
          ) : null}
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="flex w-full max-w-[440px] flex-col gap-8">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-3xl">{t('app.name')}</h1>
              <p
                lang={locale === 'ar' ? 'en' : 'ar'}
                dir={locale === 'ar' ? 'ltr' : 'rtl'}
                className="text-end text-lg text-muted"
              >
                {t('app.name_other')}
              </p>
            </div>

            {method === 'password' ? (
              <form className={card} onSubmit={onPassword} noValidate data-step="password">
                <Field label={t('sign_in.email_label')}>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      name="email"
                      autoComplete="username"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-[15px]"
                      autoFocus
                    />
                  )}
                </Field>
                <Field label={t('sign_in.password.label')} error={line}>
                  {(p) => (
                    <Input
                      {...p}
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 text-[15px]"
                    />
                  )}
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 text-[15px]"
                  loading={pending}
                  disabled={!email || !password}
                  data-door="password"
                >
                  {t('sign_in.password.signIn')}
                </Button>
                <p className="text-center text-sm text-muted">{t('sign_in.password.forgot')}</p>
              </form>
            ) : step === 'email' ? (
              <form className={card} onSubmit={onEmail} noValidate data-step="email">
                <Field label={t('sign_in.email_label')} error={line}>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      name="email"
                      autoComplete="username"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-[15px]"
                      autoFocus
                    />
                  )}
                </Field>
                <Button type="submit" variant="primary" className="h-12 text-[15px]" loading={pending} data-door="code">
                  {t('sign_in.send_code')}
                </Button>
              </form>
            ) : (
              <form className={card} onSubmit={onCode} noValidate data-step="code">
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold">{t('sign_in.code_label')}</span>
                  <span className="text-base text-muted">
                    {t('sign_in.sent_to', { email: maskEmail(email) })} ·{' '}
                    <button
                      type="button"
                      className="font-medium text-link hover:underline"
                      onClick={() => {
                        setStep('email');
                        setError(null);
                        setSentAt(null);
                      }}
                    >
                      {t('sign_in.change')}
                    </button>
                  </span>
                </div>
                <div
                  role="group"
                  aria-label={t('sign_in.code_label')}
                  className="flex justify-between gap-2.5"
                  dir="ltr"
                >
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        boxes.current[i] = el;
                      }}
                      aria-label={t('sign_in.digit', { n: i + 1 })}
                      aria-invalid={error ? true : undefined}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      pattern="[0-9]*"
                      maxLength={i === 0 ? 6 : 1}
                      value={d}
                      onChange={(e) => put(i, e.target.value)}
                      onPaste={(e) => onPaste(i, e)}
                      onKeyDown={(e) => onKey(i, e)}
                      className="h-14 w-full rounded-md border border-border-strong bg-raised text-center font-data text-2xl text-text focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 aria-invalid:border-danger"
                    />
                  ))}
                </div>
                {line ? (
                  <p role="alert" className="text-sm text-danger">
                    {line}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 text-[15px]"
                  loading={pending}
                  disabled={digits.some((d) => !d)}
                >
                  {t('sign_in.verify')}
                </Button>
                <div className="flex items-center justify-center text-base">
                  <button
                    type="button"
                    disabled={pending || wait > 0}
                    className="font-medium text-link hover:underline disabled:text-muted disabled:no-underline"
                    onClick={() => ask()}
                  >
                    {wait > 0 ? t('sign_in.resend_in', { time: clock(wait) }) : t('sign_in.resend')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        <p className="text-center text-sm text-muted md:hidden">{t('app.copyright')}</p>
      </main>
    </div>
  );
}
