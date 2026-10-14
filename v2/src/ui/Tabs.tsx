'use client';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { LinkPending } from './LinkPending';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu';

/** `more` puts a link tab under the row's one "More" control on a phone (V630); a wide screen shows every tab. */
export type TabDef = { value: string; label: ReactNode; count?: number; href?: string; more?: boolean };

/**
 * ONE tab row, underline style, counts in mono. Never tabs inside tabs (V11): a detail has at most
 * one, and its state lives in the URL — pass `href` per tab and the row renders links (a navigation
 * list). Without hrefs it is a tablist whose panel is whatever the page renders below it.
 */
export function Tabs({
  tabs,
  value,
  onValueChange,
  label,
  moreLabel,
  className,
}: {
  tabs: TabDef[];
  value: string;
  onValueChange?: (v: string) => void;
  label: string;
  /** The word on the phone's overflow control; needed when any tab has `more`. */
  moreLabel?: string;
  className?: string;
}) {
  const tabClass = (active: boolean) =>
    cn(
      '-mb-px inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap border-b-2 px-0 pb-3 pt-2.5 text-base transition-colors duration-[var(--dur)] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
      active ? 'border-accent font-semibold text-text' : 'border-transparent text-muted hover:text-text',
    );
  const count = (n?: number) =>
    n !== undefined ? <span className="ms-1.5 font-data text-xs font-normal text-muted">{n}</span> : null;

  if (tabs.every((t) => t.href)) {
    const folded = moreLabel ? tabs.filter((t) => t.more) : [];
    const foldedOn = folded.some((t) => t.value === value);
    return (
      <nav
        aria-label={label}
        className={cn('flex gap-6 overflow-x-auto border-b border-border max-sm:flex-wrap max-sm:gap-x-4', className)}
        data-tabs
      >
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.href!}
            aria-current={t.value === value ? 'page' : undefined}
            className={cn(tabClass(t.value === value), folded.includes(t) && 'max-sm:hidden')}
          >
            {t.label}
            {count(t.count)}
            <LinkPending />
          </Link>
        ))}
        {folded.length ? (
          <Menu>
            <MenuTrigger
              className={cn(tabClass(foldedOn), 'gap-1 sm:hidden')}
              data-tabs-more
              aria-current={foldedOn ? 'true' : undefined}
            >
              {moreLabel}
              <ChevronDown className="size-4" aria-hidden="true" />
            </MenuTrigger>
            <MenuContent align="end">
              {folded.map((t) => (
                <MenuItem key={t.value} asChild className="h-11">
                  <Link
                    href={t.href!}
                    aria-current={t.value === value ? 'page' : undefined}
                    data-tabs-more-item={t.value}
                  >
                    {t.label}
                    {count(t.count)}
                  </Link>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        ) : null}
      </nav>
    );
  }
  const move = (from: number, dir: 1 | -1) => {
    const next = tabs[(from + dir + tabs.length) % tabs.length]!;
    onValueChange?.(next.value);
    document.getElementById(`tab-${next.value}`)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex gap-6 overflow-x-auto border-b border-border max-sm:flex-wrap max-sm:gap-x-4', className)}
      data-tabs
    >
      {tabs.map((t, i) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            id={`tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange?.(t.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(i, 1);
              if (e.key === 'ArrowLeft') move(i, -1);
            }}
            className={tabClass(active)}
          >
            {t.label}
            {count(t.count)}
          </button>
        );
      })}
    </div>
  );
}
