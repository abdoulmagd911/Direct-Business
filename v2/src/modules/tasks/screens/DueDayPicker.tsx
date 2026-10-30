'use client';
import { CalendarDays, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { formatDate } from '@/core/i18n/format';
import { whenChip } from '@/modules/my-day/screens/WhenPicker';
import { nextWeek, riyadhNow, tomorrow, tomorrowDayName } from '@/modules/my-day/when';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { parseDueDay } from '../rules';

/** A four-digit year on the browser's date boxes: without a max, Chrome lets the year part take six digits (V286). */
export const DATE_MAX = '9999-12-31';

/**
 * Due on the task form (V286): the When chips' Today, Tomorrow and Next week (the same Riyadh days My day's When gives),
 * a box that reads a typed day ("20261020", "2026-10-20", "20/10/2026") and says it back in words, the browser's calendar
 * behind a button, and Clear. Typed text is read here, not by the browser's date box, whose parts follow the computer's
 * own settings — typed digits landed in the wrong parts and left junk. Due stays optional: nothing typed saves no due
 * day. What is typed but is not a day goes up as typed, so the form says "Pick a date" under Due.
 */
export function DueDayPicker({
  id,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  value: string | undefined;
  onChange: (due: string | undefined) => void;
  describedBy?: string;
  invalid?: true;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const [now] = useState(() => new Date());
  // a day is shown the one way the app writes it (`20 Oct 2026`), never as 2026-10-20 (W-daily 13)
  const written = (d: string) => formatDate(`${d}T12:00:00+03:00`, locale);
  const [text, setText] = useState(() => (value && parseDueDay(value) ? written(parseDueDay(value)!) : (value ?? '')));
  const calendar = useRef<HTMLInputElement>(null);
  const day = parseDueDay(text);
  const set = (typed: string) => {
    setText(typed);
    onChange(parseDueDay(typed) ?? (typed.trim() || undefined));
  };
  // a day that is picked (a chip, the calendar) is written back as the app writes a date
  const pick = (d: string) => set(parseDueDay(d) ? written(parseDueDay(d)!) : d);
  const chips = [
    { key: 'today', day: riyadhNow(now).day, label: t('pages.tasks.add.dueToday') },
    {
      key: 'tomorrow',
      day: tomorrow(now).day,
      label: tomorrowDayName(now, locale) ?? t('pages.myDay.quick.whenChips.tomorrow'),
    },
    { key: 'next_week', day: nextWeek(now).day, label: t('pages.myDay.quick.whenChips.next_week') },
  ];
  return (
    <div className="flex flex-col gap-2" data-due-picker>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.tasks.fields.due')}>
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={day === c.day}
            className={whenChip(day === c.day)}
            onClick={() => pick(c.day)}
            data-due-chip={c.key}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('pages.tasks.add.duePlaceholder')}
          value={text}
          onChange={(e) => set(e.target.value)}
          onBlur={() => day && setText(written(day))}
          name="due"
          className="min-w-0 flex-1"
        />
        <IconButton
          label={t('pages.tasks.add.dueCalendar')}
          icon={<CalendarDays />}
          onClick={() => {
            const box = calendar.current;
            if (!box) return;
            if (typeof box.showPicker === 'function') box.showPicker();
            else box.click();
          }}
          data-due-calendar
        />
        <input
          ref={calendar}
          type="date" /* check-allow: one-date-format — never seen: it only opens the browser's calendar; the day is shown in words below */
          max={DATE_MAX}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          value={day ?? ''}
          onChange={(e) => pick(e.target.value)}
        />
        {text ? (
          <Button type="button" variant="ghost" onClick={() => set('')} data-due-clear>
            <X aria-hidden className="size-4" />
            {t('pages.tasks.add.dueClear')}
          </Button>
        ) : null}
      </div>
      {day ? (
        <p className="text-sm text-muted" data-due-result>
          {formatDate(`${day}T12:00:00+03:00`, locale, { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      ) : null}
    </div>
  );
}
