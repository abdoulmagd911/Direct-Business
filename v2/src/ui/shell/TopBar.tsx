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
 * Top bar, 60 px: search (Ctrl K), Create, the bell with its unread count, the profile chip.
 * No page titles here (spec §2.5). In Direct it is slate with white text, like the drawer.
 */
export function TopBar({
  onOpenSearch,
  onOpenBell,
  bellOpen,
  arabicEnabled = false,
  unread = 0,
}: {
  onOpenSearch: () => void;
  onOpenBell?: () => void;
  bellOpen?: boolean;
  /** The language switch shows once Arabic is on (`app.arabic_enabled`, V122). */
  arabicEnabled?: boolean;
  /** api.notifications_unread, kept live by the shell (P3-7). */
  unread?: number;
}) {
  const t = useTranslations('top');
  const pathname = usePathname();
  return (
    <header
      className="flex h-[var(--topbar-h)] shrink-0 items-center gap-3 border-b border-top-border bg-top-bg px-4 text-top-text sm:px-6"
      data-topbar
    >
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={t('searchLabel')}
        aria-keyshortcuts="Control+K"
        data-search
        className={cn(
          'flex h-[38px] min-w-0 flex-1 items-center gap-2.5 rounded-md border border-search-border bg-search-bg px-3 text-base text-search-text focus-visible:outline-2 focus-visible:outline-focus sm:max-w-[440px]',
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden min-w-0 flex-1 truncate text-start sm:inline">{t('search')}</span>
        <Kbd className="ms-auto hidden sm:inline">Ctrl K</Kbd>
      </button>
      <div className="flex-1 sm:hidden" />
      <CreateMenu />
      <IconButton
        label={unread ? t('notificationsUnread', { count: unread }) : t('notifications')}
        icon={<Bell />}
        pressed={bellOpen}
        onClick={onOpenBell}
        data-bell
        data-unread={unread}
      >
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute end-[3px] top-1 inline-grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-primary px-1 font-ui text-[11px] font-semibold text-on-primary shadow-[0_0_0_2px_var(--top-bg)]"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </IconButton>
      <ProfileMenu arabicEnabled={arabicEnabled} />
      <span data-testid="address" className="sr-only">
        {pathname}
      </span>
    </header>
  );
}
