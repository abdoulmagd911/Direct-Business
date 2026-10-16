'use client';
import { useLocale } from 'next-intl';
import {
  forwardRef,
  useCallback,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { formatDate } from '@/core/i18n/format';
import { cn } from './cn';

export const inputClass =
  'w-full rounded-md border border-border-strong bg-raised px-3 text-base text-text placeholder:text-muted disabled:bg-surface disabled:text-muted focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 aria-invalid:border-danger';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean };

/**
 * A date box (W-daily 13): the browser draws a date input in its own format (`10/14/2026`, `14/10/2026`, `2026-10-14`),
 * so the box shows the date the way the whole app writes it — `14 Oct 2026` — and the real date input sits invisibly
 * on top of it, keeping the label, the keyboard, the value (always `YYYY-MM-DD`, or `YYYY-MM-DDThh:mm` with a time)
 * and the native picker. While the field has keyboard focus the real input is shown and the written date hidden, so
 * a date typed by keyboard is seen as it goes in (QA-569), and the date it holds is written beside it the app's way
 * (`14 Oct 2026`), so a typed day can be checked against the way the app reads it.
 */
const DateInput = forwardRef<HTMLInputElement, InputProps>(function DateInput(
  { className, mono, placeholder, value, defaultValue, onChange, onClick, type, ...rest },
  ref,
) {
  const locale = useLocale() as 'en' | 'ar';
  const [own, setOwn] = useState(String(defaultValue ?? ''));
  const shown = value !== undefined ? String(value) : own;
  const change = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setOwn(e.target.value);
      onChange?.(e);
    },
    [onChange],
  );
  const written = !shown
    ? '—'
    : type === 'datetime-local'
      ? formatDate(`${shown.slice(0, 16)}:00+03:00`, locale, { dateStyle: 'medium', timeStyle: 'short' })
      : formatDate(`${shown}T12:00:00+03:00`, locale);
  const open = (e: MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    try {
      e.currentTarget.showPicker?.();
    } catch {
      // a browser that will not open it from here still has its own control
    }
  };
  return (
    <div className={cn('relative', className)} data-date-box>
      <input
        ref={ref}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={change}
        onClick={open}
        className={cn(
          inputClass,
          'peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 focus-visible:opacity-100',
          mono && 'font-data tabular',
        )}
        {...rest}
      />
      <div
        aria-hidden="true"
        data-date-text
        className={cn(
          inputClass,
          'flex min-h-[var(--control-h)] items-center peer-focus-visible:invisible peer-aria-invalid:border-danger peer-disabled:bg-surface peer-disabled:text-muted',
          mono && 'font-data tabular',
          !shown && 'text-muted',
        )}
      >
        {!shown ? (placeholder ?? '—') : written}
      </div>
      {/* while the real field is up (keyboard focus) the date it holds is written beside its calendar button the app's way,
          as it changes; over the box, so nothing moves (a control just below it would shift away from a click) */}
      <p
        aria-hidden="true"
        data-date-echo
        className="pointer-events-none absolute inset-y-0 end-10 z-20 hidden items-center text-sm text-muted peer-focus-visible:flex"
      >
        {written}
      </p>
    </div>
  );
});

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, mono, ...rest }, ref) {
  if (rest.type === 'date' || rest.type === 'datetime-local')
    return <DateInput ref={ref} className={className} mono={mono} {...rest} />;
  return (
    <input
      ref={ref}
      className={cn(inputClass, 'h-[var(--control-h)]', mono && 'font-data tabular', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(inputClass, 'py-2 leading-normal', className)} {...rest} />;
});
