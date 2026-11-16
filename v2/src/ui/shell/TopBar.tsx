'use client';
import { Bell, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { cn } from '../cn';
import { IconButton } from '../IconButton';
import { Kbd } from '../Kbd';
import { CreateMenu } from './CreateMenu';
import { ProfileMenu } from './ProfileMenu';

/**
 * Top bar, 56 px: search (Ctrl K), Create, the bell with its unread count, the profile chip.
 * No page titles here (spec §2.5). The look (V21): the card colour in every theme, no line under it — a 1 px shadow
 * instead; its row sits in the same 1,280 px box as the page, with the page's gutters (40 px, 24 px under 1,280,
 * 16 px on a phone), so the bar's two edges are the content's two edges. From 640 px to 1,023 px the search is an icon;
 * from 1,024 px it is a 320 px pill.
 * From 640 px the four sit together at the END edge of the bar — the right in English, the left in Arabic — with the
 * bar's own 24 px margin (owner, 13 Nov): the search stops growing at 440 px, and the space it leaves goes BEFORE
 * the group (justify-end), never after the profile chip, which had left the chip in the middle of a wide bar. On a
 * phone the search takes the start and the bell and the chip keep the end, as before.
 */
export function TopBar({
  onOpenSearch,
  onOpenBell,
  bellOpen,
  unread = 0,
}: {
  onOpenSearch: () => void;
  onOpenBell?: () => void;
  bellOpen?: boolean;
  /** The bell's unread count, from the same read as its list (D36(c)), kept live by the shell (P3-7). */
  unread?: number;
}) {
  const t = useTranslations('top');
  const pathname = usePathname();
  return (
    <header className="relative z-10 h-[var(--topbar-h)] shrink-0 bg-top-bg text-top-text shadow-topbar" data-topbar>
      <div className="mx-auto flex h-full w-full max-w-[var(--page-max)] items-center gap-3 px-4 sm:justify-end sm:px-6 xl:px-10">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={t('searchLabel')}
          aria-keyshortcuts="Control+K"
          data-search
          className={cn(
            'flex h-11 min-w-0 flex-1 items-center gap-2 rounded-pill border border-transparent bg-search-bg pe-2 ps-3.5 text-base text-search-text transition-colors duration-[var(--dur-fast)] hover:border-search-border focus-visible:outline-2 focus-visible:outline-focus sm:h-10 sm:w-10 sm:flex-none sm:justify-center sm:px-0 lg:w-[320px] lg:flex-[0_1_320px] lg:justify-start lg:pe-2 lg:ps-3.5',
          )}
        >
          <Search className="size-4 shrink-0 sm:max-lg:size-5" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-start sm:hidden">{t('searchShort')}</span>
          <span className="hidden min-w-0 flex-1 truncate text-start lg:inline">{t('search')}</span>
          <Kbd className="ms-auto hidden lg:inline">Ctrl K</Kbd>
        </button>
        <div className="flex-1 sm:hidden" />
        <CreateMenu />
        <IconButton
          label={unread ? t('notificationsUnread', { count: unread }) : t('notifications')}
          icon={<Bell />}
          pressed={bellOpen}
          onClick={onOpenBell}
          className="max-sm:size-11"
          data-bell
          data-unread={unread}
        >
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute end-0 top-0 inline-grid h-5 min-w-5 place-items-center rounded-pill bg-primary px-1 font-ui text-[12px] font-semibold leading-none text-on-primary shadow-[0_0_0_2px_var(--top-bg)]"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </IconButton>
        <ProfileMenu />
        <span data-testid="address" className="sr-only">
          {pathname}
        </span>
      </div>
    </header>
  );
}
