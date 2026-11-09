'use client';
import * as RP from '@radix-ui/react-popover';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { formatDate } from '@/core/i18n/format';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { cn } from '@/ui/cn';

const pad = (n: number) => String(n).padStart(2, '0');

/** A month as YYYY-MM, read from what was typed ("2026-10", "10/2026", "Oct 2026", "202610"). */
export function parseMonth(typed: string): string | null {
  const s = typed
    .trim()
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
  const ymd = /^(\d{4})(\d{2})$/.exec(s) ?? /^(\d{4})[-/.](\d{1,2})$/.exec(s);
  const mdy = ymd ? null : /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  const word = ymd || mdy ? null : /^(\S+?)\.?,?\s+(\d{4})$/.exec(s);
  const wordMonth = word ? monthNumber(word[1]!) : null;
  const parts = ymd
    ? [ymd[1], ymd[2]]
    : mdy
      ? [mdy[2], mdy[1]]
      : word && wordMonth
        ? [word[2], String(wordMonth)]
        : null;
  if (!parts) return null;
  const [y, mo] = parts;
  const year = Number(y);
  const month = Number(mo);
  if (year < 2000 || year > 2099 || month < 1 || month > 12) return null;
  return `${year}-${pad(month)}`;
}

function monthNumber(name: string): number | null {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const at = months.indexOf(name.slice(0, 3).toLowerCase());
  return at === -1 ? null : at + 1;
}

/**
 * The app's own month picker (FIX-02): a month grid that commits on click, a typed month/year box that commits on
 * blur/Enter, "This month" and "Clear" — no day grid. No native month input anywhere: the browser's own month popup
 * dismissed on a month-click without setting the value (F080, F186). The value carried up is `YYYY-MM`, or the raw
 * typed text while it is not a month yet, or undefined when empty.
 */
export function MonthPicker({
  id: idProp,
  value,
  onChange,
  describedBy,
  invalid,
  className,
  emptyLabel,
}: {
  /** The input's id (the label points at it). When left out, one is made up. */
  id?: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  describedBy?: string;
  invalid?: true;
  /** Passed to the outer wrapper (width). */
  className?: string;
  /** Said back as the result line while no month is set (the Achievements list's "Any month", FIX-02): a
   * placeholder is not text content, so the list's hint has to be a real text node. */
  emptyLabel?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const written = (m: string) =>
    // check-allow: one-date-format — a month's own name (a label), not a date
    formatDate(`${m}-01T12:00:00+03:00`, locale, { day: undefined, month: 'long', year: 'numeric' });
  const [text, setText] = useState(() => (value && parseMonth(value) ? written(parseMonth(value)!) : (value ?? '')));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value && parseMonth(value) && parseMonth(text) !== value) setText(written(parseMonth(value)!));
    else if (!value) setText('');
  }
  const month = parseMonth(text);
  const set = (typed: string) => {
    setText(typed);
    const parsed = parseMonth(typed);
    onChange(parsed ?? (typed.trim() || undefined));
  };
  const pick = (m: string) => {
    set(written(m));
    setOpen(false);
  };
  const [open, setOpen] = useState(false);
  const todayMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }).slice(0, 7);
  const viewYear = Number((month ?? todayMonth).slice(0, 4));
  const [shownYear, setShownYear] = useState(viewYear);
  if (!open && shownYear !== viewYear) setShownYear(viewYear);
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = `${shownYear}-${pad(i + 1)}`;
    return {
      value: m,
      // check-allow: one-date-format — a month's own name (a label), not a date
      label: formatDate(`${m}-01T12:00:00+03:00`, locale, { day: undefined, month: 'short', year: undefined }),
    };
  });
  return (
    <div className={cn('flex flex-col gap-2', className)} data-month-picker>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || (text.trim() !== '' && !month ? true : undefined)}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('datePicker.monthPlaceholder')}
          value={text}
          onChange={(e) => set(e.target.value)}
          onBlur={() => month && setText(written(month))}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            if (month) setText(written(month));
          }}
          className="min-w-0 flex-1"
        />
        <RP.Root open={open} onOpenChange={setOpen}>
          <RP.Trigger asChild>
            <Button type="button" variant="ghost" aria-label={t('datePicker.openCalendar')} data-month-calendar>
              <Calendar aria-hidden className="size-4" />
            </Button>
          </RP.Trigger>
          <RP.Portal>
            <RP.Content
              sideOffset={4}
              align="start"
              className="z-50 w-72 rounded-lg border border-border bg-raised p-3 shadow-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label={t('datePicker.previousYear')}
                  onClick={() => setShownYear(shownYear - 1)}
                  className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
                </button>
                <p className="text-base font-semibold" data-month-year>
                  {shownYear}
                </p>
                <button
                  type="button"
                  aria-label={t('datePicker.nextYear')}
                  onClick={() => setShownYear(shownYear + 1)}
                  className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1" role="grid" aria-label={String(shownYear)}>
                {months.map((m) => {
                  const selected = month === m.value;
                  const isCurrent = m.value === todayMonth;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      role="gridcell"
                      aria-label={written(m.value)}
                      onClick={() => pick(m.value)}
                      className={cn(
                        'rounded-md px-2 py-2 text-sm hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus',
                        selected && 'bg-text font-medium text-raised',
                        isCurrent && !selected && 'font-medium text-link',
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => pick(todayMonth)}>
                  {t('datePicker.thisMonth')}
                </Button>
                {text ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('')}>
                    <X aria-hidden className="size-4" />
                    {t('datePicker.clear')}
                  </Button>
                ) : null}
              </div>
            </RP.Content>
          </RP.Portal>
        </RP.Root>
        {text ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => set('')}
            data-month-clear
            data-clear-month
            aria-label={t('datePicker.clearMonth')}
          >
            <X aria-hidden className="size-4" />
            {t('datePicker.clear')}
          </Button>
        ) : null}
      </div>
      {month ? (
        <p className="text-sm text-muted" data-month-result>
          {written(month)}
        </p>
      ) : emptyLabel ? (
        <p className="text-sm text-muted" data-month-result>
          {emptyLabel}
        </p>
      ) : null}
    </div>
  );
}
