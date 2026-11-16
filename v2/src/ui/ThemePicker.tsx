'use client';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { THEMES, type Theme } from '@/core/prefs';
import { cn } from './cn';
import { StatusChip } from './Chip';

/**
 * A small drawing of a theme, in that theme's own colours: the frame, the page, a card with its orange start border
 * and a primary button. It carries data-theme itself, so the tokens inside are the drawn theme's whatever the app
 * is showing; System is drawn half light, half dark.
 */
function Drawing({ theme, small = false }: { theme: Theme; small?: boolean }) {
  const one = (name: Exclude<Theme, 'system'>, className?: string) => (
    <span data-theme={name} className={cn('flex h-full min-w-0 flex-1 bg-bg', className)}>
      <span className="h-full w-1/5 bg-nav-bg" />
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-2">
        <span className="h-1.5 w-2/3 rounded-pill bg-strong" />
        <span className="flex h-5 items-center rounded-sm border border-border border-s-2 border-s-kpi bg-raised px-1.5">
          <span className="h-1 w-1/2 rounded-pill bg-muted" />
        </span>
        <span className="h-2.5 w-1/3 rounded-pill bg-primary" />
      </span>
    </span>
  );
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 overflow-hidden rounded-md border border-border',
        small ? 'h-14 w-[84px]' : 'h-[84px] w-full',
      )}
      data-theme-drawing={theme}
    >
      {theme === 'system' ? (
        <>
          {one('light')}
          {one('dark')}
        </>
      ) : (
        one(theme)
      )}
    </span>
  );
}

const selected = 'border-sel shadow-[inset_0_0_0_2px_var(--sel)]';

/**
 * The five theme cards of My profile → Look (Landing 31): a radio group; picking one changes the app at once.
 * Turquoise is marked Opt-in; the admin's default is marked Default.
 */
export function ThemeCards({
  value,
  onChange,
  defaultTheme,
}: {
  value: Theme;
  onChange: (t: Theme) => void;
  defaultTheme?: Theme;
}) {
  const t = useTranslations();
  return (
    <div
      role="radiogroup"
      aria-label={t('themePicker.title')}
      className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"
      data-theme-cards
    >
      {THEMES.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          data-theme-card={k}
          className={cn(
            'flex min-w-0 flex-col gap-2 rounded-lg border border-border-strong bg-raised px-2.5 pb-3 pt-2.5 text-start transition-shadow duration-[var(--dur-fast)] hover:shadow-hover focus-visible:outline-2 focus-visible:outline-focus',
            value === k && selected,
          )}
        >
          <Drawing theme={k} />
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-strong">{t(`theme.${k}`)}</span>
            {k === 'turquoise' ? <StatusChip tone="info">{t('themePicker.optIn')}</StatusChip> : null}
            {k === defaultTheme ? <StatusChip tone="neutral">{t('themePicker.default')}</StatusChip> : null}
          </span>
          <span className="text-sm text-muted">{t(`themePicker.line.${k}`)}</span>
        </button>
      ))}
    </div>
  );
}

/** The colour bars beside a theme's name in the profile menu. */
export function ThemeSwatch({ theme }: { theme: Theme }) {
  const bars = (name: Exclude<Theme, 'system'>) => (
    <span data-theme={name} className="flex">
      <span className="h-[18px] w-2.5 bg-nav-bg" />
      <span className="h-[18px] w-2.5 bg-bg" />
      <span className="h-[18px] w-2.5 bg-primary" />
      <span className="h-[18px] w-2.5 bg-success" />
    </span>
  );
  return (
    <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-pill border border-border">
      {theme === 'system' ? (
        <>
          {bars('light')}
          {bars('dark')}
        </>
      ) : (
        bars(theme)
      )}
    </span>
  );
}

/** The phone sheet's five rows (More → Theme): a small drawing, the name and one line each; the current one ringed. */
export function ThemeRows({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  const t = useTranslations();
  return (
    <div role="radiogroup" aria-label={t('themePicker.title')} className="flex flex-col gap-2" data-theme-rows>
      {THEMES.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          data-theme-row={k}
          className={cn(
            'flex min-h-11 items-center gap-3.5 rounded-lg border border-border-strong bg-raised p-2.5 text-start focus-visible:outline-2 focus-visible:outline-focus',
            value === k && selected,
          )}
        >
          <Drawing theme={k} small />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2 font-semibold text-strong">
              {t(`theme.${k}`)}
              {k === 'turquoise' ? <StatusChip tone="info">{t('themePicker.optIn')}</StatusChip> : null}
            </span>
            <span className="text-sm text-muted">{t(`themePicker.line.${k}`)}</span>
          </span>
          {value === k ? <Check className="size-5 shrink-0 text-strong" aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  );
}
