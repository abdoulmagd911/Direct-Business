'use client';

// The two steps of the sign-in page (TECH-SPEC §4): the work email, then the 6-digit code. Plain on purpose — P3-3
// gives the page its split layout and styles (artboards 1 and 1b). Every refusal is one line (role="alert").
import { useRef, useState, useTransition, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { sendCode, verifyCode, type SignInError } from '@/core/auth/actions';
import { maskEmail } from '@/core/auth/mask';
import { clock, useCountdown } from '@/core/auth/use-countdown';
import { word } from '@/core/auth/words';

const RESEND_AFTER_S = 60;
const EMPTY = ['', '', '', '', '', ''];

export function SignInForm({ next, refusal }: { next: string | null; refusal: string | null }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const [error, setError] = useState<SignInError | null>(null);
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

  const onEmail = (e: FormEvent) => {
    e.preventDefault();
    ask(() => requestAnimationFrame(() => boxes.current[0]?.focus()));
  };

  const onCode = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await verifyCode(email, digits.join(''), next, sentAt ?? 0);
      if (r && !r.ok) setError(r.error);
    });
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

  const line = error ? word(`sign_in.error.${error}`) : shownRefusal;

  if (step === 'email')
    return (
      <form onSubmit={onEmail} noValidate>
        <label htmlFor="sign-in-email">{word('sign_in.email_label')}</label>
        <input
          id="sign-in-email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={line ? 'sign-in-error' : undefined}
        />
        {line && (
          <p id="sign-in-error" role="alert">
            {line}
          </p>
        )}
        <button type="submit" disabled={pending}>
          {word('sign_in.send_code')}
        </button>
      </form>
    );

  return (
    <form onSubmit={onCode} noValidate>
      <p>{word('sign_in.code_label')}</p>
      <p>
        {word('sign_in.sent_to', { email: maskEmail(email) })} ·{' '}
        <button
          type="button"
          onClick={() => {
            setStep('email');
            setError(null);
            setSentAt(null);
          }}
        >
          {word('sign_in.change')}
        </button>
      </p>
      <div role="group" aria-label={word('sign_in.code_label')}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            aria-label={word('sign_in.digit', { n: i + 1 })}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={i === 0 ? 6 : 1}
            value={d}
            onChange={(e) => put(i, e.target.value)}
            onPaste={(e) => onPaste(i, e)}
            onKeyDown={(e) => onKey(i, e)}
          />
        ))}
      </div>
      {line && <p role="alert">{line}</p>}
      <button type="submit" disabled={pending || digits.some((d) => !d)}>
        {word('sign_in.verify')}
      </button>
      <button type="button" disabled={pending || wait > 0} onClick={() => ask()}>
        {wait > 0 ? word('sign_in.resend_in', { time: clock(wait) }) : word('sign_in.resend')}
      </button>
    </form>
  );
}
