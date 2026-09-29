import { cn } from './cn';

/** A money figure: mono, tabular, currency muted beside it. Never a VAT amount (M1). */
export function Money({
  value,
  currency = 'SAR',
  className,
  size = 'base',
}: {
  value: string;
  currency?: string;
  className?: string;
  size?: 'base' | 'lg';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 font-data tabular',
        size === 'lg' ? 'text-2xl font-semibold' : 'text-sm',
        className,
      )}
    >
      {value}
      <span className="font-ui text-[.75em] font-medium text-muted">{currency}</span>
    </span>
  );
}
