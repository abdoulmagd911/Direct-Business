import type { ReactNode } from 'react';
import { cn } from './cn';
import { StatusChip, type Tone } from './Chip';

/**
 * KPI card (V21): a card with a 4 px start border in the KPI colour, an optional 40 px icon circle beside the label,
 * the figure the biggest thing on it (Readex 600 28/36, tabular; 22/30 on a phone), unit muted, and one explaining
 * line under it; a delta with arrow + colour, and either a target bar or a sparkline slot — never both. "—" with the
 * words "not measured" when nothing was measured (M60). `tone` is for the two money figures that carry colour: Revenue
 * is `success`, a loss is `danger`; every other figure stays neutral. A tile that is a link deepens its shadow on
 * hover and shrinks to 99% while pressed; it never lifts.
 */
export function KpiTile({
  label,
  value,
  unit,
  delta,
  target,
  chip,
  footnote,
  sparkline,
  href,
  icon,
  tone,
  className,
}: {
  label: ReactNode;
  value: ReactNode | null;
  unit?: string;
  delta?: { text: string; tone: 'up' | 'down' | 'flat' };
  /** 0–100 */
  target?: number;
  chip?: { tone: Tone; text: string };
  footnote?: ReactNode;
  sparkline?: ReactNode;
  href?: string;
  /** A line icon, drawn on the peach circle before the label. */
  icon?: ReactNode;
  tone?: 'success' | 'danger';
  className?: string;
}) {
  const Tag: 'a' | 'div' = href ? 'a' : 'div';
  return (
    <Tag
      href={href}
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-lg border border-border border-s-4 bg-raised px-[18px] pb-[18px] pt-4 text-text shadow-1 max-sm:gap-2 max-sm:px-3.5 max-sm:pb-4 max-sm:pt-3.5',
        tone === 'success' ? 'border-s-success' : tone === 'danger' ? 'border-s-danger' : 'border-s-kpi',
        href && 'press-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      data-kpi-tile
      data-tone={tone}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'inline-grid size-[var(--icon-circle)] shrink-0 place-items-center rounded-pill max-sm:size-8 [&_svg]:size-5 max-sm:[&_svg]:size-4',
              tone === 'success'
                ? 'bg-success-soft text-success'
                : tone === 'danger'
                  ? 'bg-danger-soft text-danger'
                  : 'bg-accent-soft text-accent-ink',
            )}
            data-kpi-icon
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-base font-medium leading-5 max-sm:text-sm">{label}</span>
        {chip ? <StatusChip tone={chip.tone}>{chip.text}</StatusChip> : null}
      </div>
      <div
        className={cn(
          'font-display text-[28px] font-semibold leading-9 tabular max-sm:text-[22px] max-sm:leading-[30px]',
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-strong',
        )}
      >
        {value === null ? <span className="text-muted">—</span> : value}
        {unit && value !== null ? (
          <small className="ms-1 font-ui text-base font-medium leading-5 text-muted max-sm:text-xs">{unit}</small>
        ) : null}
      </div>
      {sparkline ??
        (target !== undefined ? (
          <div
            className="flex h-1.5 overflow-hidden rounded-pill bg-pressed"
            role="progressbar"
            aria-label={typeof label === 'string' ? label : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(target)}
          >
            <i
              className="block h-full rounded-pill bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, target))}%` }}
            />
          </div>
        ) : null)}
      {delta || footnote ? (
        <div className="-mt-1 flex flex-wrap items-center gap-x-1.5 text-sm leading-[18px] tabular max-sm:text-xs">
          {delta ? (
            <span
              className={cn(
                delta.tone === 'up' && 'text-success',
                delta.tone === 'down' && 'text-danger',
                delta.tone === 'flat' && 'text-muted',
              )}
            >
              {delta.tone === 'up' ? '▲ ' : delta.tone === 'down' ? '▼ ' : ''}
              {delta.text}
            </span>
          ) : null}
          {footnote ? <span className="text-muted">{footnote}</span> : null}
        </div>
      ) : null}
    </Tag>
  );
}
