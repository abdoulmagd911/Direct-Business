'use client';
import * as RD from '@radix-ui/react-dialog';
import { MoreHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/MeProvider';
import { Avatar } from '../Avatar';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { CreateMenu } from './CreateMenu';
import { NAV_PAGES } from './nav';

/** The phone's five (< 640 px, V85): My day · Tasks · Partners · KPIs · More; More opens a sheet with the rest. */
const PRIMARY = ['my-day', 'tasks', 'partners', 'kpis'];

export function BottomBar() {
  const t = useTranslations('nav');
  const me = useMe();
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  // The More button is the sheet's Radix trigger, so Escape returns focus to it (M93).
  const visible = NAV_PAGES.filter((p) => (me.levels[p.key] ?? 'none') !== 'none');
  const primary = PRIMARY.map((k) => visible.find((p) => p.key === k)).filter(
    (p): p is (typeof NAV_PAGES)[number] => !!p,
  );
  const rest = visible.filter((p) => !PRIMARY.includes(p.key));
  const isActive = (route: string) => pathname === route || pathname.startsWith(route + '/');
  const restActive = rest.some((p) => isActive(p.route));

  return (
    <RD.Root open={more} onOpenChange={setMore}>
      <CreateMenu floating />
      <nav
        aria-label={t('main')}
        data-bottom-bar
        className="flex h-[60px] shrink-0 items-stretch border-t border-nav-border bg-nav-bg pb-[env(safe-area-inset-bottom)] text-nav-text sm:hidden"
      >
        {primary.map((p) => {
          const Icon = p.icon;
          const active = isActive(p.route);
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
              <span className="truncate">{t(p.key)}</span>
            </Link>
          );
        })}
        <RD.Trigger asChild>
          <button
            type="button"
            data-bottom-more
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
              restActive ? 'text-nav-active-text' : 'text-nav-muted',
            )}
          >
            <span className={cn('inline-grid h-7 w-12 place-items-center rounded-pill', restActive && 'bg-nav-active')}>
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </span>
            <span className="truncate">{t('more')}</span>
          </button>
        </RD.Trigger>
      </nav>

      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-scrim sm:hidden" />
        <RD.Content
          aria-describedby={undefined}
          data-more-sheet
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-lg bg-nav-bg pb-[env(safe-area-inset-bottom)] text-nav-text shadow-2 focus:outline-none sm:hidden"
        >
          <header className="flex items-center gap-3 px-4 pb-1 pt-3">
            <RD.Title className="flex-1 font-display text-lg font-semibold">{t('more')}</RD.Title>
            <RD.Close asChild>
              <IconButton label={t('close')} icon={<X />} size="sm" />
            </RD.Close>
          </header>
          <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-3">
            {rest.map((p) => {
              const Icon = p.icon;
              const active = isActive(p.route);
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
                  {t(p.key)}
                </Link>
              );
            })}
            <Link
              href="/settings/profile"
              data-entity="person"
              onClick={() => setMore(false)}
              className="mt-2 flex h-12 items-center gap-3 rounded-md border-t border-nav-border px-3 pt-2 text-base"
            >
              <Avatar person={me.person} size="sm" ring="nav" />
              <span className="min-w-0 leading-tight">
                <b className="block truncate font-semibold">{me.person.displayName}</b>
                {me.person.jobTitle ? (
                  <small className="block truncate text-xs text-nav-muted">{me.person.jobTitle}</small>
                ) : null}
              </span>
            </Link>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
