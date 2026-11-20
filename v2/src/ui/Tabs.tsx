'use client';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';
import { LinkPending } from './LinkPending';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu';
import { useScrollMore } from './use-scroll-more';

/** `more` puts a link tab under the row's one "More" control on a phone (V630); a wide screen shows every tab. */
export type TabDef = { value: string; label: ReactNode; count?: number; href?: string; more?: boolean };

/**
 * ONE tab row, pill tabs on a soft track (V21): the track holds its tabs 4 px apart and scrolls inside itself when it
 * must; the open tab is a white pill with a soft shadow. Counts in mono. Never tabs inside tabs (V11): a detail has at most
 * one, and its state lives in the URL — pass `href` per tab and the row renders links (a navigation
 * list). Without hrefs it is a tablist whose panel is whatever the page renders below it.
 */
export function Tabs({
  tabs,
  value,
  onValueChange,
  label,
  moreLabel,
  fill = false,
  className,
}: {
  tabs: TabDef[];
  value: string;
  onValueChange?: (v: string) => void;
  label: string;
  /** The word on the phone's overflow control; needed when any tab has `more`. */
  moreLabel?: string;
  /** The tabs fill one row, each as wide as its words need and sharing the rest, and never wrap (a short strip in a narrow place, like the bell's). */
  fill?: boolean;
  className?: string;
}) {
  const scroll = useScrollMore();
  // each row's own tab ids: two rows on one screen (a page's and the bell's) may share a value such as "all"
  const rowId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // A link tab's active state is read from the address, which only changes when the next page has arrived — so
  // without this the new tab's content renders under the old tab's underline for the whole round trip (F218). The
  // underline follows the click at once; the address takes over when it lands (the render-phase sync, as in
  // MyProfile: the pressed tab is cleared the render the address's tab changes).
  const [pressed, setPressed] = useState<string | null>(null);
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    setPressed(null);
  }
  const tabClass = (active: boolean) =>
    cn(
      'inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill px-4 text-base font-medium leading-5 transition-[background-color,color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2 sm:min-h-9 shrink-0',
      fill && 'min-w-0 flex-auto px-1',
      fill && 'shrink',
      active ? 'bg-raised font-semibold text-strong shadow-tab' : 'text-muted hover:text-strong',
    );
  // The track: as wide as its tabs and never wider than its place (its wrapper holds the row's full width, so the
  // track starts where the page's content starts); full width on a phone, where a row too long for the screen wraps
  // inside the same soft ground (so its corners are 26 px there, a pill while it is one row).
  const trackClass =
    'flex min-w-0 max-w-full gap-1 overflow-x-auto overflow-y-hidden rounded-pill bg-surface p-1 [scrollbar-width:none] max-sm:flex-1 max-sm:rounded-[26px]';
  // A tab's name and its count are ONE run of words with a real space between them (Landing 34, item 15): as two
  // flex children of the tab they had only a margin, so the text read "Action items0" to a screen reader, a copy and
  // a test. The space is the gap now (with 2 px, the 6 px it was).
  const count = (n?: number) =>
    n !== undefined ? (
      <span className="ms-0.5 font-data text-xs font-normal text-muted" data-tab-count>
        {n}
      </span>
    ) : null;
  const face = (t: TabDef) =>
    t.count === undefined ? (
      t.label
    ) : (
      <span data-tab-face>
        {t.label} {count(t.count)}
      </span>
    );

  if (tabs.every((t) => t.href)) {
    const folded = moreLabel ? tabs.filter((t) => t.more) : [];
    const foldedOn = folded.some((t) => t.value === value);
    return (
      <div className={cn('flex min-w-0', className)}>
        <nav aria-label={label} className={cn(trackClass, 'max-sm:flex-wrap')} data-tabs {...scroll}>
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={t.href!}
              aria-current={t.value === value ? 'page' : undefined}
              onClick={() => setPressed(t.value)}
              className={cn(tabClass(t.value === value || t.value === pressed), folded.includes(t) && 'max-sm:hidden')}
            >
              {face(t)}
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
                      {face(t)}
                    </Link>
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          ) : null}
        </nav>
      </div>
    );
  }
  const go = (to: number) => {
    const next = tabs[(to + tabs.length) % tabs.length]!;
    onValueChange?.(next.value);
    buttons.current.get(next.value)?.focus();
  };
  // The arrows follow the row as drawn: in Arabic the next tab is on the left, so ArrowLeft moves on; Home and End
  // go to the first and the last tab.
  const onArrow = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const on = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const to =
      e.key === on ? i + 1 : e.key === back ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    go(to);
  };
  return (
    <div className={cn('flex min-w-0', className)}>
      <div
        role="tablist"
        aria-label={label}
        className={cn(trackClass, fill ? 'flex-1' : 'max-sm:flex-wrap')}
        data-tabs
        {...scroll}
      >
        {tabs.map((t, i) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              id={`${rowId}-tab-${t.value}`}
              ref={(el) => {
                if (el) buttons.current.set(t.value, el);
                else buttons.current.delete(t.value);
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onValueChange?.(t.value)}
              onKeyDown={(e) => onArrow(e, i)}
              className={tabClass(active)}
            >
              {face(t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
