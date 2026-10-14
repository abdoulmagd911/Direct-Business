'use client';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/core/i18n/format';
import { cn } from '@/ui/cn';
import { Input } from '@/ui/Input';
import { hasPassed, laterToday, TIME_CHIPS, WHEN_KEYS, whenFor, type When, type WhenKey } from '../when';

const chip = (on: boolean) =>
  cn(
    'inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus',
    on ? 'border-accent bg-accent-soft text-text' : 'border-border bg-raised text-muted hover:text-text',
  );

/** "Wed 14 Oct · 09:00": the Riyadh day and time, Gregorian, Latin digits, in Arabic too (V40). */
export function whenLine(w: When, locale: 'en' | 'ar'): string {
  const day = formatDate(`${w.day}T12:00:00+03:00`, locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: undefined,
  });
  return `${day.replace(/[,،]/g, '')} · ${w.time}`;
}

/**
 * When (productivity stage 2): Later today · Tomorrow · Next week · Pick a day, and always one line saying the result.
 * Pick a day opens a Day field, a Time field and five time chips. Later today is not drawn when too little of the day is
 * left. `dayOnly` is for a Follow up, which is kept for a day: the time chips and the Time field are left out.
 */
export function WhenPicker({
  value,
  onChange,
  pick,
  onPick,
  now,
  dayOnly = false,
}: {
  value: WhenKey;
  onChange: (k: WhenKey) => void;
  pick: When;
  onPick: (w: When) => void;
  now: Date;
  dayOnly?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const keys = WHEN_KEYS.filter((k) => k !== 'later_today' || laterToday(now));
  const chosen = whenFor(value, now, pick);
  return (
    <div className="flex flex-col gap-2" data-when>
      <span className="text-sm font-medium">{t('pages.myDay.quick.when')}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.myDay.quick.when')}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            className={chip(value === k)}
            onClick={() => onChange(k)}
            data-when-chip={k}
          >
            {t(`pages.myDay.quick.whenChips.${k}`)}
          </button>
        ))}
      </div>
      {value === 'pick' ? (
        <div className="flex flex-col gap-2" data-when-pick>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
              {t('pages.myDay.quick.day')}
              <Input
                type="date"
                value={pick.day}
                onChange={(e) => e.target.value && onPick({ ...pick, day: e.target.value })}
                data-when-day
              />
            </label>
            {dayOnly ? null : (
              <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
                {t('pages.myDay.quick.time')}
                <Input
                  type="time"
                  value={pick.time}
                  onChange={(e) => e.target.value && onPick({ ...pick, time: e.target.value })}
                  data-when-time-field
                />
              </label>
            )}
          </div>
          {dayOnly ? null : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('pages.myDay.quick.time')}>
              {TIME_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={pick.time === c}
                  className={chip(pick.time === c)}
                  onClick={() => onPick({ ...pick, time: c })}
                  data-when-time={c}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {chosen ? (
        <p className="text-sm text-muted" data-when-result>
          {dayOnly ? whenLine({ ...chosen, time: '' }, locale).replace(/ · $/, '') : whenLine(chosen, locale)}
          {!dayOnly && hasPassed(chosen, now) ? (
            <span className="ms-2 text-danger">{t('pages.myDay.quick.passed')}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
