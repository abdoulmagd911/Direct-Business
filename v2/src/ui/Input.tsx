'use client';
import { useLocale, useTranslations } from 'next-intl';
import {
  forwardRef,
  useCallback,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { formatClock, formatDate, parseClock } from '@/core/i18n/format';
import { cn } from './cn';

export const inputClass =
  'w-full rounded-md border border-border-strong bg-raised px-3 text-base text-text placeholder:text-muted disabled:bg-surface disabled:text-muted focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 aria-invalid:border-danger';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean };

/**
 * A date or time box (W-daily 13, V643 (4)): an empty date box reads `dd mmm yyyy` in English (V653 (2)); a time is shown 24-hour (`09:00`) whatever the device says. The browser draws a date input in its own format (`10/14/2026`, `14/10/2026`, `2026-10-14`),
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
  const t = useTranslations();
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
    : type === 'time'
      ? shown.slice(0, 5)
      : type === 'datetime-local'
        ? formatDate(`${shown.slice(0, 16)}:00+03:00`, locale, { dateStyle: 'medium', timeStyle: 'short' })
        : formatDate(`${shown}T12:00:00+03:00`, locale);
  // an empty box says how the date will be written (V653 (2)), in the language of the screen (QA-600)
  const hint =
    type === 'time' ? '—' : type === 'datetime-local' ? t('common.dateTimePlaceholder') : t('common.datePlaceholder');
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
        {!shown ? (placeholder ?? hint) : written}
      </div>
      {/* while the real field is up (keyboard focus) the date it holds is written in a chip just above its end, the app's
          way, as it changes: out of the browser's own text (a box can be narrow, a time long, the page right to left) and
          out of the flow, so nothing moves (a control just below would shift away from a click) */}
      <p
        aria-hidden="true"
        data-date-echo
        className="pointer-events-none absolute bottom-full end-0 z-30 mb-0.5 hidden rounded-md border border-border bg-raised px-2 py-0.5 text-sm text-muted shadow-2 peer-focus-visible:block"
      >
        {/* the chip keeps the box's own direction, so its end is the side away from the label; only its words order themselves */}
        <span dir="auto">{written}</span>
      </p>
    </div>
  );
});

/**
 * A time box (W-daily 13): the browser draws a time input in the computer's own clock (`9:30 AM`), so this is a text box
 * that reads the time typed in any common way ("9", "930", "21.05", "9:30 pm") and writes it back as 24-hour `HH:MM`
 * (`09:30`), in Arabic too. `value` and `onChange` carry `HH:MM`; a half-typed time is held in the box and not sent.
 */
export function TimeInput({
  value,
  onChange,
  onReadable,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (hhmm: string) => void;
  /** Told after every keystroke whether the box now holds a time, so a screen can keep Save off on a half-typed one. */
  onReadable?: (readable: boolean) => void;
  mono?: boolean;
}) {
  const locale = useLocale() as 'en' | 'ar';
  const [text, setText] = useState(() => (parseClock(value) ? formatClock(parseClock(value)!, locale) : value));
  const [seen, setSeen] = useState(value);
  // a time chosen elsewhere (a chip) is written into the box
  if (value !== seen) {
    setSeen(value);
    if (parseClock(value) && parseClock(text) !== value) setText(formatClock(value, locale));
  }
  const read = parseClock(text);
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="09:30"
      value={text}
      aria-invalid={text.trim() !== '' && !read ? true : undefined}
      onChange={(e) => {
        setText(e.target.value);
        const t = parseClock(e.target.value);
        onReadable?.(!!t);
        if (t) {
          setSeen(t);
          onChange(t);
        }
      }}
      onBlur={() => read && setText(formatClock(read, locale))}
      className={cn(inputClass, 'h-[var(--control-h)] font-data tabular', className)}
      {...rest}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, mono, ...rest }, ref) {
  if (rest.type === 'date' || rest.type === 'datetime-local' || rest.type === 'time')
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
