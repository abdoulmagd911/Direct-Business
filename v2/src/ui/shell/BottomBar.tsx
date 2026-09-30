'use client';
import * as RD from '@radix-ui/react-dialog';
import { LogOut, MoreHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { Avatar } from '../Avatar';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { personOf } from '../person';
import { CreateMenu } from './CreateMenu';
import { isActiveEntry, menuFor, type NavEntry } from './nav';
import { signOut } from './ProfileMenu';

/**
 * The phone's bar (< 640 px, V85) follows the menu (V217): its first four entries, then More — which holds the rest,
 * My profile and Sign out. A bar of four with nothing left needs no More (a Viewer's); the profile is on the avatar.
 */
const BAR = 4;

export function BottomBar() {
  const t = useTranslations();
  const me = useMe();
  const pathname = usePathname();
  const view = useSearchParams().get('view');
  const [more, setMore] = useState(false);
  // The More button is the sheet's Radix trigger, so Escape returns focus to it (M93).
  const person = personOf(me);
  const menu = menuFor(me);
  const primary = menu.slice(0, BAR);
  const rest = menu.slice(BAR);
  const withMore = rest.length > 0 || primary.length < BAR;
  const isActive = (p: NavEntry) => isActiveEntry(p, pathname, view);
  const restActive = rest.some(isActive);

  return (
    <RD.Root open={more} onOpenChange={setMore}>
      <CreateMenu floating />
      <nav
        aria-label={t('nav.main')}
        data-bottom-bar
        className="flex h-[60px] shrink-0 items-stretch border-t border-nav-border bg-nav-bg pb-[env(safe-area-inset-bottom)] text-nav-text sm:hidden"
      >
        {primary.map((p) => {
          const Icon = p.icon;
          const active = isActive(p);
          return (
            <Link
              key={p.key}
              href={p.route}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                active ? 'text-nav-active-text' : 'text-nav-muted',
              )}
            >
              <span className={cn('inline-grid h-7 w-12 place-items-center rounded-pill', active && 'bg-nav-active')}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="truncate">{t(p.label)}</span>
            </Link>
          );
        })}
        {withMore ? (
          <RD.Trigger asChild>
            <button
              type="button"
              data-bottom-more
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                restActive ? 'text-nav-active-text' : 'text-nav-muted',
              )}
            >
              <span
                className={cn('inline-grid h-7 w-12 place-items-center rounded-pill', restActive && 'bg-nav-active')}
              >
                <MoreHorizontal className="size-5" aria-hidden="true" />
              </span>
              <span className="truncate">{t('nav.more')}</span>
            </button>
          </RD.Trigger>
        ) : null}
      </nav>

      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-scrim sm:hidden" />
        <RD.Content
          aria-describedby={undefined}
          data-more-sheet
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-lg bg-nav-bg pb-[env(safe-area-inset-bottom)] text-nav-text shadow-2 focus:outline-none sm:hidden"
        >
          <header className="flex items-center gap-3 px-4 pb-1 pt-3">
            <RD.Title className="flex-1 font-display text-lg font-semibold">{t('nav.more')}</RD.Title>
            <RD.Close asChild>
              <IconButton label={t('nav.close')} icon={<X />} size="sm" />
            </RD.Close>
          </header>
          <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-3">
            {rest.map((p) => {
              const Icon = p.icon;
              const active = isActive(p);
              return (
                <Link
                  key={p.key}
                  href={p.route}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMore(false)}
                  className={cn(
                    'flex h-11 items-center gap-3 rounded-md px-3 text-base focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                    active && 'bg-nav-active font-semibold text-nav-active-text',
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                  {t(p.label)}
                </Link>
              );
            })}
            <Link
              href="/profile"
              data-entity="person"
              onClick={() => setMore(false)}
              className="mt-2 flex h-12 items-center gap-3 rounded-md border-t border-nav-border px-3 pt-2 text-base"
            >
              <Avatar person={person} size="sm" ring="nav" />
              <span className="min-w-0 leading-tight">
                <b className="block truncate font-semibold">{person.displayName}</b>
                {person.jobTitle ? (
                  <small className="block truncate text-xs text-nav-muted">{person.jobTitle}</small>
                ) : null}
              </span>
            </Link>
            <button
              type="button"
              onClick={signOut}
              data-more-sign-out
              className="flex h-11 items-center gap-3 rounded-md px-3 text-start text-base focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              <LogOut className="size-[18px]" aria-hidden="true" />
              {t('profileMenu.signOut')}
            </button>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
