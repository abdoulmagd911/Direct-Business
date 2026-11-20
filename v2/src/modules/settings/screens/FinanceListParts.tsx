'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { formatMoney } from '@/core/i18n/format';
import { cn } from '@/ui/cn';

/** A rule's value as it was typed: a number or a code reads left to right in both languages; a name in its own direction. */
export function RuleValue({ kind, value }: { kind: string; value: string }) {
  return kind === 'name' ? (
    <span dir="auto" className="[overflow-wrap:anywhere]">
      {value}
    </span>
  ) : (
    <bdi dir="ltr" className="font-data tabular [overflow-wrap:anywhere]">
      {value}
    </bdi>
  );
}

/**
 * What a rule catches now: "N rows · SAR amount" — the rows it takes in today and their revenue in whole riyals, the
 * way the app writes money. An amount the read did not give is left out, never drawn as 0.
 */
export function CatchesNow({ rows, amount }: { rows: number | null; amount: number | null }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="whitespace-nowrap">{t('settings.financeLists.rows', { count: rows ?? 0 })}</span>
      {amount !== null && amount !== undefined ? (
        <>
          <span aria-hidden="true">·</span>
          <bdi dir="ltr" className="whitespace-nowrap font-data tabular">
            <span className="font-ui text-xs font-medium text-muted">{t('common.sar')}</span>{' '}
            {formatMoney(amount, locale)}
          </bdi>
        </>
      ) : null}
    </span>
  );
}

/**
 * One cell of a list's table. From 640 px it is a table cell under its column heading; on a phone the row stacks and
 * each cell carries its own heading in small grey above the value, so nothing scrolls sideways.
 */
export function Cell({
  label,
  children,
  className,
  ...rest
}: { label?: string; children: ReactNode; className?: string } & Record<`data-${string}`, string | undefined>) {
  return (
    <div
      role="cell"
      className={cn(
        'py-2.5 pe-4 align-top max-sm:block max-sm:p-0 sm:table-cell sm:border-t sm:border-border',
        className,
      )}
      {...rest}
    >
      {label ? <span className="block text-xs text-muted sm:hidden">{label}</span> : null}
      {children}
    </div>
  );
}

// The lists are drawn with plain boxes that take a table's roles and, from 640 px, a table's layout — never the
// table tags: on a phone a Settings list is cards, not a table (settings-tables-on-a-phone), and a table tag laid
// out as blocks is neither.
export const tableClass = 'w-full text-sm max-sm:block sm:table';
export const headClass = 'text-xs text-muted max-sm:sr-only sm:table-header-group';
export const headRowClass = 'sm:table-row';
export const bodyClass = 'max-sm:block sm:table-row-group';
export const rowClass =
  'max-sm:flex max-sm:flex-col max-sm:gap-2 max-sm:border-t max-sm:border-border max-sm:py-3 max-sm:first:border-t-0 sm:table-row';
export const thClass = 'py-2 pe-4 text-start font-medium sm:table-cell';
