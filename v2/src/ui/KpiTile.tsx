import type { ReactNode } from 'react';
import { cn } from './cn';
import { StatusChip, type Tone } from './Chip';

/**
 * KPI card: label, value (Readex 24), unit muted, delta with arrow + colour, and either a target bar
 * or a sparkline slot — never both. "—" with the words "not measured" when nothing was measured (M60).
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
  className,
}: {
  label: ReactNode;
  value: string | null;
  unit?: string;
  delta?: { text: string; tone: 'up' | 'down' | 'flat' };
  /** 0–100 */
  target?: number;
  chip?: { tone: Tone; text: string };
  footnote?: ReactNode;
  sparkline?: ReactNode;
  href?: string;
  className?: string;
}) {
  const Tag: 'a' | 'div' = href ? 'a' : 'div';
  return (
    <Tag
      href={href}
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-raised px-3.5 py-3 text-text shadow-1',
        href && 'hover:border-border-strong',
        className,
      )}
      data-kpi-tile
    >
      <div className="flex items-center justify-between gap-1.5 text-xs text-muted">
        <span className="truncate">{label}</span>
        {chip ? <StatusChip tone={chip.tone}>{chip.text}</StatusChip> : null}
      </div>
      <div className="font-display text-2xl font-semibold leading-[1.1] tracking-[-.01em] tabular">
        {value === null ? <span className="text-muted">—</span> : value}
        {unit && value !== null ? <small className="ms-1 text-xs font-medium text-muted">{unit}</small> : null}
      </div>
      {sparkline ??
        (target !== undefined ? (
          <div
            className="flex h-1.5 overflow-hidden rounded-[3px] bg-border"
            role="progressbar"
            aria-label={typeof label === 'string' ? label : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(target)}
          >
            <i
              className="block h-full rounded-[3px] bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, target))}%` }}
            />
          </div>
        ) : null)}
      {delta || footnote ? (
        <div className="flex items-center gap-1.5 text-xs tabular">
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
