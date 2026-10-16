'use client';
import * as RD from '@radix-ui/react-dialog';
import { LogOut, MoreHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { CreateMenu } from './CreateMenu';
import { barFor, isActiveEntry, type NavEntry } from './nav';
import { signOut } from './ProfileMenu';

/**
 * The phone's bar (< 640 px, V85) follows the menu: `barFor` in nav.ts says what it holds (V217). More lists the rest
 * and Sign out; My profile is in the avatar menu at the top, its one place (daily use 10). Create is the last slot
 * (the architect's ruling of 15 Oct, option C), so at most six slots share the width: about 62 px each at 375 px.
 */

export function BottomBar() {
  const t = useTranslations();
  const me = useMe();
  const pathname = usePathname();
  const view = useSearchParams().get('view');
  const [more, setMore] = useState(false);
  // The More button is the sheet's Radix trigger, so Escape returns focus to it (M93).
  const { bar: primary, rest, more: withMore } = barFor(me);
  const isActive = (p: NavEntry) => isActiveEntry(p, pathname, view);
  const restActive = rest.some(isActive);

  return (
    <RD.Root open={more} onOpenChange={setMore}>
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
        {/* Create is the bar's last slot: it floats over nothing, so nothing can sit under it (ruling of 15 Oct) */}
        <CreateMenu bar />
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
