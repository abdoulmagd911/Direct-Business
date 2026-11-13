'use client';
import * as RP from '@radix-ui/react-popover';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { formatDate } from '@/core/i18n/format';
import { whenChip } from '@/modules/my-day/screens/WhenPicker';
import { nextWeek, riyadhNow, tomorrow, tomorrowDayName } from '@/modules/my-day/when';
import { monthWeeks, parseDueDay, shiftMonth } from '@/modules/tasks/rules';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { cn } from '@/ui/cn';

/** A four-digit year on a date box: without a max, Chrome lets the year part take six digits (V286). */
export const DATE_MAX = '9999-12-31';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Riyadh's today, as YYYY-MM-DD (the day a date applies from is never the browser's clock, PRF-139). */
function riyadhToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

function stepDay(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + by));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function stepMonth(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1 + by, 1));
  const yy = t.getUTCFullYear();
  const mm = t.getUTCMonth() + 1;
  return iso(yy, mm, Math.min(d, daysIn(yy, mm)));
}
function stepYear(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return iso(y + by, m, Math.min(d, daysIn(y + by, m)));
}

/**
 * The app's own date box (FIX-02): a typed box that reads a day ("20261020", "2026-10-20", "20/10/2026",
 * "20 Oct 2026") and says it back in words, quick chips, and a calendar popup whose day-click SETS the date —
 * never dismisses without applying. No native date input anywhere: the browser's own picker dismissed on a day-click
 * without setting the value (F002, F096, F116, F186, F214, F236). A day is shown the one way the app writes it
 * (`20 Oct 2026`), never as 2026-10-20. The value carried up is `YYYY-MM-DD`, or the raw typed text while it is not
 * a day yet (so the form can say so), or undefined when empty — the DueDayPicker contract. `min`/`max` bound both the
 * typed box and the calendar grid.
 */
export function DatePicker({
  id: idProp,
  value,
  onChange,
  describedBy,
  invalid,
  min,
  max,
  chips = 'today',
  name,
  testId = 'date',
  className,
  readOnly,
  disabled,
  inputProps,
}: {
  /** The input's id (the label points at it). When left out, one is made up. */
  id?: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  describedBy?: string;
  invalid?: true;
  min?: string;
  max?: string;
  /** 'due' = Today / Tomorrow / Next week (the task due-date set); 'today' = Today only; 'none' = no chips. */
  chips?: 'due' | 'today' | 'none';
  name?: string;
  /** The namespace of the test attributes (`data-<testId>-picker`, `-chip`, `-calendar`, `-clear`, `-result`):
   * 'date' everywhere except the task form's Due, which is 'due' (the specs read `data-due-*` there, FIX-02). */
  testId?: string;
  /** Passed to the typed box (width, font). */
  className?: string;
  /** The value is shown but cannot be changed (chips, calendar and Clear are off too). */
  readOnly?: boolean;
  disabled?: boolean;
  /** Extra attributes for the typed box (aria-label, data-* markers the tests read). */
  inputProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    | 'id'
    | 'value'
    | 'onChange'
    | 'type'
    | 'aria-describedby'
    | 'aria-invalid'
    | 'onBlur'
    | 'onKeyDown'
    | 'name'
    | 'placeholder'
    | 'inputMode'
    | 'autoComplete'
    | 'readOnly'
    | 'disabled'
  > & { [key: `data-${string}`]: string | undefined };
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  /** One test attribute, namespaced (`data-<testId>-<name>`); a plain string value renders as `data-…=""`. */
  const at = (name: string, value = '') => ({ [`data-${testId}-${name}`]: value });
  const [now] = useState(() => new Date());
  const written = (d: string) => formatDate(`${d}T12:00:00+03:00`, locale);
  const [text, setText] = useState(() => (value && parseDueDay(value) ? written(parseDueDay(value)!) : (value ?? '')));
  const [seen, setSeen] = useState(value);
  // a day chosen elsewhere (a chip, the calendar) is written into the box
  if (value !== seen) {
    setSeen(value);
    if (value && parseDueDay(value) && parseDueDay(text) !== value) setText(written(parseDueDay(value)!));
    else if (!value) setText('');
  }
  const day = parseDueDay(text);
  const inRange = (d: string | null) => !!d && (!min || d >= min) && (!max || d <= max);
  const locked = !!readOnly || !!disabled;
  // The typed box writes back the date it parses to, even outside min/max — the native box did the same (it held
  // the out-of-range day and left the range to the form). Only text that is not a date yet stays as typed text, so
  // half-typed input is not lost.
  const set = (typed: string) => {
    if (locked) return;
    setText(typed);
    const parsed = parseDueDay(typed);
    onChange(parsed ?? (typed.trim() || undefined));
  };
  // a day that is picked (a chip, the calendar) is written back as the app writes a date
  const pick = (d: string) => {
    if (locked || !inRange(d)) return;
    set(written(d));
    setOpen(false);
  };
  const [open, setOpen] = useState(false);
  const today = riyadhToday();
  const viewMonth = (day && day.slice(0, 7)) || today.slice(0, 7);
  const [shownMonth, setShownMonth] = useState(viewMonth);
  // the popup follows the value while it is closed; while open it stays where the user put it
  if (!open && shownMonth !== viewMonth) setShownMonth(viewMonth);
  const weeks = monthWeeks(shownMonth);
  const part = (d: string, opts: Intl.DateTimeFormatOptions) =>
    formatDate(`${d}T12:00:00Z`, locale, { day: undefined, month: undefined, year: undefined, ...opts });
  const monthName = part(`${shownMonth}-01`, { month: 'long', year: 'numeric' });
  const weekdays = weeks[0]!.map((d) => part(d.day, { weekday: 'short' }).replace(/[,،]/g, ''));
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const focus = (d: string) => {
    setFocusDay(d);
    dayRefs.current.get(d)?.focus();
  };
  // arrow keys step the segment the cursor sits in (day / month / year of the written date); otherwise the day
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!day || !inRange(day)) return;
    const by = e.key === 'ArrowUp' ? 1 : -1;
    const input = e.currentTarget;
    const at = input.selectionStart ?? 0;
    const writtenDay = written(day);
    const parts = writtenDay.split(' ');
    let stepped = day;
    if (parts.length === 3) {
      const firstEnd = parts[0]!.length;
      const secondEnd = firstEnd + 1 + parts[1]!.length;
      if (at <= firstEnd) stepped = stepDay(day, by);
      else if (at <= secondEnd) stepped = stepMonth(day, by);
      else stepped = stepYear(day, by);
    } else {
      stepped = stepDay(day, by);
    }
    if (!inRange(stepped)) return;
    e.preventDefault();
    set(written(stepped));
  };
  const chipList =
    chips === 'none'
      ? []
      : chips === 'due'
        ? [
            { key: 'today', day: riyadhNow(now).day, label: t('pages.tasks.add.dueToday') },
            {
              key: 'tomorrow',
              day: tomorrow(now).day,
              label: tomorrowDayName(now, locale) ?? t('pages.myDay.quick.whenChips.tomorrow'),
            },
            { key: 'next_week', day: nextWeek(now).day, label: t('pages.myDay.quick.whenChips.next_week') },
          ]
        : [{ key: 'today', day: riyadhNow(now).day, label: t('common.today') }];
  return (
    <div className="flex flex-col gap-2" {...at('picker')}>
      {chipList.length ? (
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          // a task's Due chips are its due day; anywhere else (a contract's start, a review date) they are quick dates
          aria-label={chips === 'due' ? t('pages.tasks.fields.due') : t('datePicker.quickDates')}
        >
          {chipList.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={day === c.day}
              disabled={locked || !inRange(c.day)}
              className={whenChip(day === c.day)}
              onClick={() => pick(c.day)}
              {...at('chip', c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || (text.trim() !== '' && !day ? true : undefined)}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('datePicker.placeholder')}
          value={text}
          onChange={(e) => set(e.target.value)}
          onBlur={() => day && setText(written(day))}
          onKeyDown={onKeyDown}
          name={name}
          readOnly={readOnly}
          disabled={disabled}
          className={cn('min-w-0 flex-1', className)}
          {...inputProps}
        />
        <RP.Root open={open && !locked} onOpenChange={setOpen}>
          <RP.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              disabled={locked}
              aria-label={t('datePicker.openCalendar')}
              {...at('calendar')}
            >
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
                  aria-label={t('datePicker.previousMonth')}
                  onClick={() => setShownMonth(shiftMonth(shownMonth, -1))}
                  className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
                </button>
                <p className="text-base font-semibold" data-calendar-month>
                  {monthName}
                </p>
                <button
                  type="button"
                  aria-label={t('datePicker.nextMonth')}
                  onClick={() => setShownMonth(shiftMonth(shownMonth, 1))}
                  className="inline-flex size-9 items-center justify-center rounded-md hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
                </button>
              </div>
              <div
                role="grid"
                aria-label={monthName}
                onKeyDown={(e) => {
                  const current = focusDay ?? day ?? today;
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) return;
                  e.preventDefault();
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (inRange(current)) pick(current);
                    return;
                  }
                  // the arrows follow the grid as drawn: in Arabic the week runs right to left, so ArrowLeft is the
                  // next day
                  const ltr = getComputedStyle(e.currentTarget).direction !== 'rtl';
                  const steps: Record<string, number> = {
                    ArrowLeft: ltr ? -1 : 1,
                    ArrowRight: ltr ? 1 : -1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  };
                  const by = steps[e.key] ?? 0;
                  const next = stepDay(current, by);
                  if (next.slice(0, 7) !== shownMonth) setShownMonth(next.slice(0, 7));
                  focus(next);
                }}
              >
                <div
                  className="mt-2 grid grid-cols-7 gap-px text-center text-xs font-medium text-muted"
                  aria-hidden="true"
                >
                  {weekdays.map((w, i) => (
                    <span key={i}>{w}</span>
                  ))}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-px" role="row">
                    {week.map((cell) => {
                      const disabled = !cell.inMonth || !inRange(cell.day);
                      const selected = day === cell.day;
                      const isToday = cell.day === today;
                      return disabled ? (
                        <span
                          key={cell.day}
                          aria-hidden="true"
                          className={cn(
                            'grid size-9 place-items-center text-sm',
                            !cell.inMonth && 'text-muted/40',
                            cell.inMonth && 'text-muted/60',
                          )}
                        >
                          {Number(cell.day.slice(8))}
                        </span>
                      ) : (
                        <button
                          key={cell.day}
                          type="button"
                          role="gridcell"
                          tabIndex={focusDay === cell.day || (!focusDay && selected) ? 0 : -1}
                          ref={(el) => {
                            if (el) dayRefs.current.set(cell.day, el);
                            else dayRefs.current.delete(cell.day);
                          }}
                          aria-label={written(cell.day)}
                          aria-current={isToday ? 'date' : undefined}
                          onClick={() => pick(cell.day)}
                          onFocus={() => setFocusDay(cell.day)}
                          className={cn(
                            'grid size-9 place-items-center rounded-md text-sm hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus',
                            selected && 'bg-text font-medium text-raised',
                            isToday && !selected && 'font-medium text-link',
                          )}
                        >
                          {Number(cell.day.slice(8))}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => pick(today)}>
                  {t('common.today')}
                </Button>
                {text && !locked ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('')}>
                    <X aria-hidden className="size-4" />
                    {t('datePicker.clear')}
                  </Button>
                ) : null}
              </div>
            </RP.Content>
          </RP.Portal>
        </RP.Root>
        {text && !locked ? (
          <Button type="button" variant="ghost" onClick={() => set('')} {...at('clear')}>
            <X aria-hidden className="size-4" />
            {t('datePicker.clear')}
          </Button>
        ) : null}
      </div>
      {day ? (
        <p className="text-sm text-muted" {...at('result')}>
          {formatDate(`${day}T12:00:00+03:00`, locale, { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      ) : null}
    </div>
  );
}
