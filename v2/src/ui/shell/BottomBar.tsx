'use client';
import * as RD from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, LogOut, MoreHorizontal, Palette, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { useThemeChoice } from '@/core/prefs/use-theme-choice';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { ThemeRows } from '../ThemePicker';
import { CreateMenu } from './CreateMenu';
import { barFor, isActiveEntry, type NavEntry } from './nav';
import { NavPending } from './NavPending';
import { signOut } from './ProfileMenu';

/**
 * The phone's bar (< 640 px, V85) follows the menu: `barFor` in nav.ts says what it holds (V217). More lists the rest
 * and Sign out; My profile is in the avatar menu at the top, its one place (daily use 10). Create is the last slot
 * (the architect's ruling of 15 Oct, option C), so at most six slots share the width: about 62 px each at 375 px.
 * The look (V21): 64 px on the card colour with a soft lift instead of a line; a tab is its 24 px icon over its word
 * (500 12/16, muted); the open tab is the accent text colour under a short mark in the action colour. More is a sheet:
 * 24 px top corners, rows 56 px tall between hairlines; it travels up its own height in 320 ms and down in 240 ms.
 */

export function BottomBar() {
  const t = useTranslations();
  const me = useMe();
  const pathname = usePathname();
  const view = useSearchParams().get('view');
  const [more, setMoreOpen] = useState(false);
  // More → Theme: the same sheet shows the five themes; closing the sheet returns it to the list.
  const [themes, setThemes] = useState(false);
  const setMore = (open: boolean) => {
    setMoreOpen(open);
    if (!open) setThemes(false);
  };
  const { theme, choose } = useThemeChoice();
  // The More button is the sheet's Radix trigger, so Escape returns focus to it (M93).
  const { bar: primary, rest, more: withMore } = barFor(me);
  const isActive = (p: NavEntry) => isActiveEntry(p, pathname, view);
  const restActive = rest.some(isActive);
  // the open tab's mark: a short bar in the action colour at the top of its slot
  const markClass =
    "before:absolute before:top-0 before:h-[3px] before:w-6 before:rounded-b-[2px] before:bg-primary before:content-['']";

  return (
    <RD.Root open={more} onOpenChange={setMore}>
      <nav
        aria-label={t('nav.main')}
        data-bottom-bar
        className="relative z-10 box-content flex h-16 shrink-0 items-stretch bg-raised pb-[env(safe-area-inset-bottom)] text-muted shadow-bottombar sm:hidden"
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
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium leading-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                active ? cn('text-accent-text', markClass) : 'text-muted',
              )}
            >
              <span className="relative inline-grid h-7 w-12 place-items-center rounded-pill">
                {/* the tapped tab lights up at once, until its page arrives (owner, 13 Nov) */}
                <NavPending className="absolute inset-0 rounded-pill !bg-accent-soft" />
                <Icon className="relative size-6" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate px-0.5">{t(p.label)}</span>
            </Link>
          );
        })}
        {withMore ? (
          <RD.Trigger asChild>
            <button
              type="button"
              data-bottom-more
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium leading-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                restActive ? cn('text-accent-text', markClass) : 'text-muted',
              )}
            >
              <span className="inline-grid h-7 w-12 place-items-center rounded-pill">
                <MoreHorizontal className="size-6" aria-hidden="true" />
              </span>
              <span className="max-w-full truncate px-0.5">{t('nav.more')}</span>
            </button>
          </RD.Trigger>
        ) : null}
        {/* Create is the bar's last slot: it floats over nothing, so nothing can sit under it (ruling of 15 Oct) */}
        <CreateMenu bar />
      </nav>

      <RD.Portal>
        <RD.Overlay className="motion-scrim fixed inset-0 z-40 bg-scrim sm:hidden" />
        <RD.Content
          aria-describedby={undefined}
          data-more-sheet
          className="motion-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-sheet bg-raised pb-[env(safe-area-inset-bottom)] text-text shadow-2 focus:outline-none sm:hidden"
        >
          <span aria-hidden="true" className="mx-auto mb-1 mt-2 h-1 w-9 shrink-0 rounded-pill bg-border-strong" />
          <header className={cn('flex items-center gap-2 pb-1 pe-2 pt-1', themes ? 'ps-2' : 'ps-4')}>
            {themes ? (
              <IconButton
                label={t('nav.back')}
                icon={<ChevronLeft className="rtl:-scale-x-100" />}
                size="sm"
                onClick={() => setThemes(false)}
                data-more-theme-back
              />
            ) : null}
            <RD.Title className="flex-1 font-display text-xl font-semibold leading-7 text-strong">
              {themes ? t('themePicker.title') : t('nav.more')}
            </RD.Title>
            <RD.Close asChild>
              <IconButton label={t('nav.close')} icon={<X />} size="sm" />
            </RD.Close>
          </header>
          {themes ? (
            <div className="overflow-y-auto px-4 pb-4 pt-1" data-more-theme-sheet>
              <ThemeRows value={theme} onChange={choose} />
            </div>
          ) : (
            <div className="flex flex-col overflow-y-auto pb-2">
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
                      'relative flex min-h-14 items-center gap-3 border-t border-border px-4 text-base font-medium text-strong first:border-t-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&_svg]:text-muted',
                      active && 'font-semibold text-accent-text [&_svg]:text-accent-text',
                    )}
                  >
                    <NavPending className="absolute inset-0 !bg-accent-soft" />
                    <Icon className="relative size-5" aria-hidden="true" />
                    <span className="relative">{t(p.label)}</span>
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => setThemes(true)}
                data-more-theme
                className="flex min-h-14 items-center gap-3 border-t border-border px-4 text-start text-base font-medium text-strong first:border-t-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&_svg]:text-muted"
              >
                <Palette className="size-5" aria-hidden="true" />
                <span className="flex-1">{t('themePicker.title')}</span>
                <span className="text-sm font-normal text-muted">{t(`theme.${theme}`)}</span>
                <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={signOut}
                data-more-sign-out
                className="flex min-h-14 items-center gap-3 border-t border-border px-4 text-start text-base font-medium text-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus [&_svg]:text-muted"
              >
                <LogOut className="size-5" aria-hidden="true" />
                {t('profileMenu.signOut')}
              </button>
            </div>
          )}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
