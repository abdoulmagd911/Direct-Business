'use client';
import { Pin, PinOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, type FocusEvent, type PointerEvent } from 'react';
import { useMe } from '@/core/auth/me-context';
import { usePrefs } from '@/core/prefs/usePrefs';
import { BrandLogo } from '../BrandLogo';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { Tooltip } from '../Tooltip';
import { useMediaQuery } from '../useMediaQuery';
import { SETTINGS_ENTRY, isActiveEntry, isAdmin, navFor, type NavEntry } from './nav';
import { NavPending } from './NavPending';

/**
 * The side drawer (spec §2.5): 232 px pinned, 56 px collapsed icon rail with tooltips; unpinned it opens on hover
 * or focus and closes on Escape or when the pointer leaves — and while it is open it reserves its width, so it
 * never floats over the page's heading, tabs and search (FIX-47, D23); below 640 px the bottom bar replaces it (V85)
 * (oversight, 29 Sep). The entries come from the module registry (nav.ts); Settings at the foot for admins. My profile
 * is not here: it is in the avatar menu at the top, its one place (daily use 10).
 * The look (V21): 14 × 12 px inside, items 42 px tall with 12 px corners, hover on --nav-hover; the active item is the
 * --nav-active fill with its own label colour and no side mark. Under 1,024 px the drawer is always the 56 px rail,
 * whatever is pinned (it still opens under a mouse or the keyboard). The logo is the white variant in every theme: the
 * drawer is slate in Light, orange in Direct and dark elsewhere.
 *
 * Touch (owner, 13 Nov): on a tablet, or a phone on its side, a tap on a rail item did NOTHING — the tap focused the
 * link, the focus opened the drawer, and opening it redrew the items 24 px lower and swapped each link for a new
 * element, so the finger was lifted over another item and no click was ever made. Now the drawer opens only for a
 * mouse that hovers and for the KEYBOARD's focus, never for a finger; each link stays the same element open or
 * closed (its tooltip is switched off, not unwrapped); and the head is the same height open or closed, so no item
 * moves under a mouse either. A tapped item shows that its page is on its way (NavPending) until the page arrives.
 */
export function Drawer() {
  const t = useTranslations();
  const me = useMe();
  const { prefs, set } = usePrefs();
  const pathname = usePathname();
  const view = useSearchParams().get('view');
  // under 1,024 px there is no room for a pinned drawer: it is the rail there, and pinning waits for a wider screen
  const narrow = useMediaQuery('(max-width: 1023px)');
  const pinned = prefs.drawer === 'pinned' && !narrow;
  const [peek, setPeek] = useState(false);
  const expanded = pinned || peek;
  // the collapsed rail's tooltips open towards the page: right of a rail on the left (English), left of one on the right
  const tipSide = useLocale() === 'ar' ? 'left' : 'right';

  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPeek(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [peek]);

  // a navigation closes the hover overlay
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setPeek(false);
  }

  const main = navFor(me);
  const foot = isAdmin(me) ? [SETTINGS_ENTRY] : [];

  const item = (p: NavEntry) => {
    const active = isActiveEntry(p, pathname, view);
    const Icon = p.icon;
    // One element whether the drawer is open or not: the tooltip is switched off while the words show, never
    // unwrapped — unwrapping replaced the link under the pointer, and a tap that began on the old one was lost.
    return (
      <Tooltip key={p.key} content={t(p.label)} side={tipSide} disabled={expanded}>
        <Link
          href={p.route}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex h-[42px] shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-2.5 text-base font-medium leading-5 text-nav-muted transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)] hover:bg-nav-hover hover:text-nav-text focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2',
            active && 'bg-nav-active text-nav-active-text hover:bg-nav-active hover:text-nav-active-text',
            !expanded && 'justify-center px-0',
          )}
        >
          <NavPending />
          <Icon className="relative size-5 shrink-0" aria-hidden="true" />
          <span className={cn('relative', !expanded && 'sr-only')}>{t(p.label)}</span>
        </Link>
      </Tooltip>
    );
  };

  // A mouse that hovers opens the rail; a finger never does (its tap is a press on the item, see above).
  const onPointerEnter = (e: PointerEvent) => {
    if (!pinned && e.pointerType === 'mouse') setPeek(true);
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (!pinned && e.pointerType === 'mouse') setPeek(false);
  };
  // The keyboard's focus opens it (Tab into the rail); the focus a tap or a click gives the link does not.
  const onFocusCapture = (e: FocusEvent) => {
    if (!pinned && byKeyboard(e.target)) setPeek(true);
  };

  const content = (
    <nav
      aria-label={t('nav.main')}
      data-drawer
      data-expanded={expanded}
      className={cn(
        'flex h-full flex-col gap-0.5 overflow-y-auto overflow-x-hidden bg-nav-bg py-3.5 text-nav-text [scrollbar-width:none]',
        expanded ? 'px-3' : 'px-2',
        expanded ? 'w-[var(--drawer-w)]' : 'w-[var(--drawer-w-collapsed)]',
      )}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={(e) => {
        if (!pinned && !e.currentTarget.contains(e.relatedTarget as Node)) setPeek(false);
      }}
    >
      {/* The head keeps ONE height, open or closed, in English and in Arabic (the logo and the department's name on
          one line, or the D), so the items below never move when the rail opens under a mouse — they moved 24 px,
          and a click aimed at Tasks opened My day. 84 px holds the open head in both languages (77 / 82 px). */}
      <div
        className={cn('flex h-[84px] shrink-0 flex-col gap-2.5 pb-5', expanded ? 'px-2.5' : 'items-center px-0')}
        data-drawer-head
      >
        <Link
          href="/my-day"
          aria-label={t('nav.my_day')}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-focus"
        >
          {expanded ? (
            // the drawer is a dark or coloured frame in every theme of the look (slate in Light), so the logo is the
            // white-wordmark variant everywhere
            <BrandLogo variant="on-dark" height={28} />
          ) : (
            <span className="inline-grid size-8 place-items-center rounded-md bg-nav-active font-display text-sm font-bold text-nav-active-text">
              D
            </span>
          )}
        </Link>
        {expanded ? (
          <div className="leading-tight">
            <b className="block truncate font-display text-base font-semibold">
              <DepartmentName />
            </b>
          </div>
        ) : null}
      </div>
      {main.map(item)}
      <div className="mt-auto" />
      {foot.map(item)}
      {/* pinning is for 1,024 px and up: under it the drawer is the rail, so the control would do nothing */}
      {narrow ? null : (
        <div
          className={cn(
            'mt-2 flex shrink-0 items-center justify-end gap-1.5 border-t border-nav-border pt-3',
            expanded ? 'px-0' : 'flex-col px-0',
          )}
        >
          <div className={cn('flex', expanded ? 'w-full flex-col gap-0.5' : 'flex-col gap-0.5')}>
            <FootButton
              expanded={expanded}
              label={pinned ? t('nav.unpin') : t('nav.pin')}
              pressed={pinned}
              icon={pinned ? <Pin /> : <PinOff />}
              onClick={() => set('drawer', pinned ? 'collapsed' : 'pinned')}
              data-drawer-pin
            />
          </div>
        </div>
      )}
    </nav>
  );

  return (
    <>
      {/* ≥ 1024 px: the rail. FIX-47 (D23): the width the drawer reserves follows whether it is EXPANDED, not
          whether it is pinned — an expanded-but-unpinned drawer used to float over the page and hide the heading,
          tabs and search, and it stayed there. Now expanding it reflows the page to the right, exactly as pinning
          does, so it can never cover the page; it still collapses when the pointer leaves (the nav's onMouseLeave). */}
      <div
        className={cn(
          'relative hidden h-full shrink-0 sm:block',
          expanded ? 'w-[var(--drawer-w)]' : 'w-[var(--drawer-w-collapsed)]',
        )}
      >
        <div className={cn('absolute inset-y-0 start-0 z-30 h-full', !pinned && peek && 'shadow-2')}>{content}</div>
      </div>
    </>
  );
}

function DepartmentName() {
  const t = useTranslations('app');
  return <>{t('department')}</>;
}

/**
 * Whether a focus came from the keyboard: the browser says so with :focus-visible (every browser of the last three
 * years). One too old to know it answers yes, which is what the drawer always did.
 */
function byKeyboard(target: EventTarget): boolean {
  try {
    return target instanceof Element && target.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * A drawer-foot control: with the drawer open it says what it does in words beside its icon (QA 2, the architect's
 * ruling of 14 Oct: no unlabelled icons at the foot); on the 56 px rail there is room for the icon alone, named by
 * its tooltip and accessible name.
 */
function FootButton({
  expanded,
  label,
  icon,
  pressed,
  ...rest
}: {
  expanded: boolean;
  label: string;
  icon: React.ReactNode;
  pressed?: boolean;
  onClick: () => void;
} & Record<`data-${string}`, boolean>) {
  if (!expanded) return <IconButton size="sm" label={label} pressed={pressed} icon={icon} {...rest} />;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className="flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-start text-sm font-medium text-nav-muted transition-colors duration-[var(--dur-fast)] hover:bg-nav-hover hover:text-nav-text focus-visible:outline-2 focus-visible:outline-focus [&_svg]:size-[18px] [&_svg]:shrink-0"
      {...rest}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}
