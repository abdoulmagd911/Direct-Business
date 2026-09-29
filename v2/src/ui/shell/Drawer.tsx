'use client';
import { PanelLeftClose, PanelLeftOpen, Pin, PinOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { usePrefs } from '@/core/prefs/usePrefs';
import { Avatar } from '../Avatar';
import { BrandLogo } from '../BrandLogo';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { personOf } from '../person';
import { Tooltip } from '../Tooltip';
import { SETTINGS_ENTRY, isActiveEntry, isAdmin, navFor, type NavEntry } from './nav';

/**
 * The side drawer (spec §2.5): 232 px pinned, 56 px collapsed icon rail with tooltips; unpinned it
 * opens as an overlay on hover or focus and closes on Escape; below 640 px the bottom bar replaces it (V85)
 * (oversight, 29 Sep). The entries come from the module registry (nav.ts); Settings at the foot for admins, above
 * the profile.
 * The active item carries a 3 px mark in --nav-mark. The logo is the white variant on the slate
 * (Direct) and dark drawers, the slate variant on light ones.
 */
export function Drawer() {
  const t = useTranslations();
  const me = useMe();
  const { prefs, set } = usePrefs();
  const pathname = usePathname();
  const view = useSearchParams().get('view');
  const pinned = prefs.drawer === 'pinned';
  const [peek, setPeek] = useState(false);
  const expanded = pinned || peek;

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

  const person = personOf(me);
  const main = navFor(me);
  const foot = isAdmin(me) ? [SETTINGS_ENTRY] : [];

  const item = (p: NavEntry) => {
    const active = isActiveEntry(p, pathname, view);
    const Icon = p.icon;
    const link = (
      <Link
        key={p.key}
        href={p.route}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex h-10 items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-3 text-base text-nav-text transition-colors duration-[var(--dur)] hover:bg-[color-mix(in_srgb,var(--nav-text)_10%,transparent)] focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2',
          active &&
            'bg-nav-active font-semibold text-nav-active-text shadow-1 before:absolute before:start-0 before:bottom-2.5 before:top-2.5 before:w-[3px] before:rounded-[2px] before:bg-nav-mark',
          !expanded && 'justify-center px-0',
        )}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className={cn(!expanded && 'sr-only')}>{t(p.label)}</span>
      </Link>
    );
    return expanded ? (
      link
    ) : (
      <Tooltip key={p.key} content={t(p.label)} side="right">
        {link}
      </Tooltip>
    );
  };

  const CollapseIcon = pinned ? PanelLeftClose : PanelLeftOpen;

  const content = (
    <nav
      aria-label={t('nav.main')}
      data-drawer
      data-expanded={expanded}
      className={cn(
        'flex h-full flex-col gap-0.5 bg-nav-bg px-2 pb-4 pt-[18px] text-nav-text',
        expanded ? 'w-[var(--drawer-w)]' : 'w-[var(--drawer-w-collapsed)]',
      )}
      onMouseEnter={() => !pinned && setPeek(true)}
      onMouseLeave={() => !pinned && setPeek(false)}
      onFocusCapture={() => !pinned && setPeek(true)}
      onBlurCapture={(e) => {
        if (!pinned && !e.currentTarget.contains(e.relatedTarget as Node)) setPeek(false);
      }}
    >
      <div className={cn('flex flex-col gap-2.5 pb-5', expanded ? 'px-2.5' : 'items-center px-0')}>
        <Link
          href="/my-day"
          aria-label={t('nav.my_day')}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-focus"
        >
          {expanded ? (
            <>
              <BrandLogo variant="on-dark" height={28} className="[[data-theme=light]_&]:hidden" />
              <BrandLogo variant="light" height={28} className="hidden [[data-theme=light]_&]:block" />
            </>
          ) : (
            <span className="inline-grid size-8 place-items-center rounded-md bg-nav-active font-display text-sm font-bold text-nav-active-text">
              D
            </span>
          )}
        </Link>
        {expanded ? (
          <div className="leading-tight">
            <b className="block font-display text-[14.5px] font-semibold">
              <DepartmentName />
            </b>
          </div>
        ) : null}
      </div>
      {main.map(item)}
      <div className="mt-auto" />
      {foot.map(item)}
      <div
        className={cn(
          'mt-2 flex items-center gap-1.5 border-t border-nav-border pt-3',
          expanded ? 'px-1' : 'flex-col px-0',
        )}
      >
        <Link
          href="/settings/profile"
          data-entity="person"
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-nav-text focus-visible:outline-2 focus-visible:outline-focus',
            !expanded && 'flex-none',
          )}
          aria-label={person.fullName}
        >
          <Avatar person={person} size="sm" ring="nav" />
          {expanded ? (
            <span className="min-w-0 leading-tight">
              <b className="block truncate text-[13.5px] font-semibold">{person.displayName}</b>
              {person.jobTitle ? (
                <small className="block truncate text-xs text-nav-muted">{person.jobTitle}</small>
              ) : null}
            </span>
          ) : null}
        </Link>
        <div className={cn('flex', expanded ? 'gap-0.5' : 'flex-col gap-0.5')}>
          <IconButton
            size="sm"
            label={pinned ? t('nav.unpin') : t('nav.pin')}
            pressed={pinned}
            icon={pinned ? <Pin /> : <PinOff />}
            onClick={() => set('drawer', pinned ? 'collapsed' : 'pinned')}
            data-drawer-pin
          />
          <IconButton
            size="sm"
            label={pinned ? t('nav.collapse') : t('nav.expand')}
            icon={<CollapseIcon className="flip-rtl" />}
            onClick={() => set('drawer', pinned ? 'collapsed' : 'pinned')}
            data-drawer-collapse
          />
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* ≥ 1024 px: the rail; its width is reserved when pinned, otherwise it overlays on hover */}
      <div
        className={cn(
          'relative hidden h-full shrink-0 sm:block',
          pinned ? 'w-[var(--drawer-w)]' : 'w-[var(--drawer-w-collapsed)]',
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
